// main.js — bootstrap and game loop for Teluk Kirana: Heat Season.
// Wires every system together: city, traffic, pedestrians, police, combat,
// jobs, HUD, audio, save — plus the day/night cycle, the rain, and the
// deterministic ?shot= staging used for the screenshot set.

import * as THREE from 'three';
import { CITY, DAY, WANTED, ECONOMY, districtAt } from './config.js';
import { makeRng, clamp, lerp, distance2d } from './rng.js';
import { buildCity } from './city.js';
import { Vehicle, createTraffic, createParkedVehicles } from './vehicles.js';
import { Player, CameraRig } from './player.js';
import { PedestrianCrowd } from './pedestrians.js';
import { PoliceSystem } from './police.js';
import { Combat, SHOT_VEHICLE_DAMAGE } from './combat.js';
import { JobManager } from './jobs.js';
import { Hud } from './hud.js';
import { GameAudio } from './audio.js';
import { loadSave, storeSave, freshState } from './save.js';

// ---------------------------------------------------------------- setup
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = params.get('seed') || '7';
const rng = makeRng(`teluk-kirana-${seed}`);

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6fc3e8);
scene.fog = new THREE.Fog(0x6fc3e8, 120, 420);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(150, 6, 60);

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x51683f, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
scene.add(sun);
scene.add(sun.target);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- world
const city = buildCity(scene, rng);
const traffic = createTraffic(scene, rng, 14, city.colliders);
const parked = createParkedVehicles(scene, rng, 16);
const crowd = new PedestrianCrowd(scene, rng, 38);
const player = new Player(scene, city.colliders);
const police = new PoliceSystem(scene, rng, city.colliders);
const audio = new GameAudio();
const hud = new Hud();
const rig = new CameraRig(camera);

// Objective / giver marker beams.
function makeMarkerBeam(colour) {
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 26, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 13;
  const group = new THREE.Group();
  group.add(beam);
  scene.add(group);
  return group;
}
const objectiveMarker = makeMarkerBeam(0xffb347);
const giverMarker = makeMarkerBeam(0x2ee6c8);

// Rain: a box of falling streaks that follows the camera.
const RAIN_COUNT = 1400;
const rainPositions = new Float32Array(RAIN_COUNT * 3);
for (let i = 0; i < RAIN_COUNT; i++) {
  rainPositions[i * 3] = rng.range(-45, 45);
  rainPositions[i * 3 + 1] = rng.range(0, 42);
  rainPositions[i * 3 + 2] = rng.range(-45, 45);
}
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaad4e8, size: 0.14, transparent: true, opacity: 0.75 }));
rain.visible = false;
scene.add(rain);

// ---------------------------------------------------------------- state
const saved = loadSave();
const base = freshState();
let cash = saved?.cash ?? base.cash;
let respect = saved?.respect ?? base.respect;
let hour = saved?.hour ?? DAY.startHour;
if (saved?.position) player.teleport(saved.position.x, saved.position.z);
let gameTime = 0;
let started = false;
let dead = false;
let lastDamageAt = -99;
let invulnerableUntil = 0;
let raining = false;
let wetFactor = 0;
let nextRainAt = rng.range(45, 120);
let rainEndsAt = 0;
let saveTimer = 0;
let wasNight = null;

const jobs = new JobManager({
  now: () => gameTime,
  notify: (text) => hud.notify(text),
  startDialogue: (lines, done) => hud.startDialogue(lines, done),
  addCash: (n) => { cash += n; if (n > 0) audio.cashRegister(); },
  addRespect: (n) => { respect += n; },
  addHeat: (n) => police.addHeat(n),
  save: () => persist(),
});

function persist() {
  storeSave({ cash, respect, jobs: jobs.snapshot(), position: player.pos, hour });
}
jobs.restore(saved ? { storyIndex: saved.storyIndex, completedStory: saved.completedStory } : null);
if (saved) document.getElementById('continue-note').classList.remove('hidden');

// ---------------------------------------------------------------- combat
const combat = new Combat(scene, {
  onShotFired: (x, z) => { audio.gunshot(); crowd.scareAt(x, z, 17); },
  onCrime: (kind) => police.addHeat(WANTED.crimeHeat[kind] || 4),
  onPedestrianDown: (target) => {
    crowd.knockDown(target.pos.x, target.pos.z, 1.2);
    police.addHeat(WANTED.crimeHeat.hitPedestrian);
    hud.notify('You shot a pedestrian. The city saw that.');
  },
  onVehicleHit: (vehicle, isPolice) => {
    vehicle.health -= SHOT_VEHICLE_DAMAGE;
    if (isPolice) police.addHeat(10);
    if (vehicle.health <= 0 && vehicle.driver === 'traffic') vehicle.driver = null;
  },
});

function shootTargets() {
  const targets = [];
  for (const m of crowd.members) {
    if (!m.down) targets.push({ pos: m.mesh.position, kind: 'pedestrian' });
  }
  for (const v of [...traffic.vehicles, ...parked]) {
    if (v !== player.vehicle) targets.push({ pos: v.pos, kind: 'vehicle', vehicle: v, isPolice: false });
  }
  for (const c of police.cars) targets.push({ pos: c.pos, kind: 'vehicle', vehicle: c, isPolice: true });
  return targets;
}

// ---------------------------------------------------------------- death
const gameoverEl = document.getElementById('gameover');
function showGameOver(title, text) {
  dead = true;
  document.getElementById('gameover-title').textContent = title;
  document.getElementById('gameover-text').textContent = text;
  gameoverEl.classList.remove('hidden');
}
function respawn() {
  dead = false;
  gameoverEl.classList.add('hidden');
  player.health = PLAYER_HEALTH_FULL;
  police.clearHeat();
  if (player.inVehicle) player.exitVehicle();
  player.teleport(150, 30, Math.PI);
  persist();
}
const PLAYER_HEALTH_FULL = 100;
document.getElementById('respawnbtn').addEventListener('click', respawn);

police.onBusted = () => {
  if (dead) return;
  const fine = Math.round(cash * ECONOMY.bustFineFraction);
  cash = Math.max(0, cash - fine);
  showGameOver('BUSTED', `The Teluk Kirana police walk you to the station. Fine paid: $${fine}. Your wheels are impounded, your pride dented.`);
};

function damagePlayer(amount) {
  if (dead || gameTime < invulnerableUntil) return;
  player.health -= amount;
  lastDamageAt = gameTime;
  invulnerableUntil = gameTime + 0.6;
  hud.flashDamage();
  if (player.health <= 0) {
    const fee = Math.min(cash, ECONOMY.hospitalFee);
    cash -= fee;
    showGameOver('WASTED', `You wake up at the Pantai clinic. Bill: $${fee}. The harbour keeps your tab — and your story — going.`);
  }
}

// ---------------------------------------------------------------- input
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Enter' && hud.dialogueOpen) hud.showNextLine();
  if (started && !dead) {
    if (e.code === 'KeyE') interact();
    if (e.code === 'KeyT' && !jobs.sideActive && !jobs.active) { if (jobs.startTaxi(rng, player.pos)) audio.pickup(); }
    if (e.code === 'KeyR' && !jobs.sideActive && !jobs.active) { jobs.startRace(); }
    if (e.code === 'Digit1') setRadio(0);
    if (e.code === 'Digit2') setRadio(1);
    if (e.code === 'Digit3') setRadio(2);
    if (e.code === 'KeyF' && !player.inVehicle && !hud.dialogueOpen) combat.fire(player, shootTargets());
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
canvas.addEventListener('mousedown', (e) => {
  if (started && !dead && !player.inVehicle && !hud.dialogueOpen && e.button === 0) {
    combat.fire(player, shootTargets());
  }
});
let dragging = false;
canvas.addEventListener('pointerdown', () => { dragging = true; });
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointermove', (e) => {
  if (dragging && started) rig.addDrag(e.movementX, e.movementY);
});

function setRadio(index) {
  audio.setStation(index);
  hud.setRadio(audio.stationName);
  if (audio.stationName) hud.notify(`Radio: ${audio.stationName}`);
}

function nearestVehicle(maxDist) {
  let best = null;
  let bestD = maxDist;
  const all = [...traffic.vehicles, ...parked, ...police.cars];
  for (const v of all) {
    const d = distance2d(player.pos.x, player.pos.z, v.pos.x, v.pos.z);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

function interact() {
  if (hud.dialogueOpen) return;
  if (player.inVehicle) { player.exitVehicle(); return; }
  const giver = jobs.nextGiver;
  if (giver && !jobs.active && distance2d(player.pos.x, player.pos.z, giver.pos.x, giver.pos.z) < 3.4) {
    jobs.startStoryJob();
    return;
  }
  const vehicle = nearestVehicle(3.4);
  if (vehicle) {
    const wasDriven = vehicle.driver === 'traffic';
    const wasPolice = police.cars.includes(vehicle);
    player.enterVehicle(vehicle);
    rig.yaw = vehicle.heading + Math.PI;
    if (wasDriven) {
      police.addHeat(WANTED.crimeHeat.jack);
      crowd.scareAt(vehicle.pos.x, vehicle.pos.z, 12);
      hud.notify('Carjacked! The heat is coming.');
    } else if (wasPolice) {
      police.addHeat(WANTED.crimeHeat.jack + 6);
      hud.notify('You just stole a police car. Bold.');
    } else {
      hud.notify(vehicle.kind === 'motor' ? 'Motorbike — lean with A/D.' : 'Driving. E to step out.');
    }
  }
}

// ---------------------------------------------------------------- sky
const SKY_STOPS = [
  { h: 0.0, sky: new THREE.Color(0x0a1826), sunI: 0.1, sunC: new THREE.Color(0x8fb4d9), hemiI: 0.26 },
  { h: 5.5, sky: new THREE.Color(0x0e2033), sunI: 0.12, sunC: new THREE.Color(0x8fb4d9), hemiI: 0.28 },
  { h: 7.5, sky: new THREE.Color(0x87b5c9), sunI: 0.8, sunC: new THREE.Color(0xffd9a8), hemiI: 0.55 },
  { h: 12.0, sky: new THREE.Color(0x6fc3e8), sunI: 1.6, sunC: new THREE.Color(0xffffff), hemiI: 0.85 },
  { h: 16.5, sky: new THREE.Color(0x5fb2d9), sunI: 1.35, sunC: new THREE.Color(0xfff2d8), hemiI: 0.78 },
  { h: 18.3, sky: new THREE.Color(0xff9a56), sunI: 0.85, sunC: new THREE.Color(0xff8a4d), hemiI: 0.5 },
  { h: 19.6, sky: new THREE.Color(0x2c3e5e), sunI: 0.25, sunC: new THREE.Color(0xd98a5a), hemiI: 0.33 },
  { h: 24.0, sky: new THREE.Color(0x0a1826), sunI: 0.1, sunC: new THREE.Color(0x8fb4d9), hemiI: 0.26 },
];

function applySky(focus) {
  let a = SKY_STOPS[0];
  let b = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (hour >= SKY_STOPS[i].h && hour <= SKY_STOPS[i + 1].h) { a = SKY_STOPS[i]; b = SKY_STOPS[i + 1]; break; }
  }
  const t = b.h > a.h ? (hour - a.h) / (b.h - a.h) : 0;
  const skyColour = a.sky.clone().lerp(b.sky, t);
  if (raining) skyColour.lerp(new THREE.Color(0x5a6d78), 0.45);
  scene.background.copy(skyColour);
  scene.fog.color.copy(skyColour);
  sun.intensity = lerp(a.sunI, b.sunI, t) * (raining ? 0.6 : 1);
  sun.color.copy(a.sunC.clone().lerp(b.sunC, t));
  hemi.intensity = lerp(a.hemiI, b.hemiI, t) * (raining ? 0.75 : 1);
  const sunAngle = ((hour - 6) / 12) * Math.PI;
  const elev = Math.sin(sunAngle);
  sun.position.set(focus.x + Math.cos(sunAngle) * 140, Math.max(8, elev * 130), focus.z + 46);
  sun.target.position.copy(focus);
  const nightFactor = clamp((0.12 - elev) * 2.4, 0, 1);
  return nightFactor;
}

// ---------------------------------------------------------------- shots
let shotFrames = 0;
let suppressGiverMarker = false;
function stageShot(name) {
  started = true;
  document.getElementById('startscreen').classList.add('hidden');
  hud.show();
  const giveCar = (x, z, heading, colour = 0xd94f38) => {
    const car = new Vehicle(scene, 'car', colour, x, z, heading);
    return car;
  };
  if (name === 'cover') {
    hour = 18.35;
    const car = giveCar(66, 24.6, 0);
    car.speed = 19;
    player.enterVehicle(car);
    const copA = police.spawnCarNear({ x: 30, z: 22 });
    copA.pos.set(50, 0, 20.5); copA.heading = 0; copA.speed = 20;
    const copB = police.spawnCarNear({ x: 30, z: 30 });
    copB.pos.set(54, 0, 29); copB.heading = 0; copB.speed = 20;
    police.setHeat(WANTED.thresholds[5] + 5);
    police.helicopterActive = true;
    police.helicopter.visible = true;
    police.helicopter.position.set(48, 23, 44);
    player.mesh.position.y = -3; // seated in the car, out of frame
    rig.pin(new THREE.Vector3(88, 5.5, 4), new THREE.Vector3(58, 1.2, 26));
    hud.notify('FIVE STARS — the whole city is watching');
  } else if (name === 'city') {
    hour = 10.4;
    player.teleport(-44, 8, 0.6);
    rig.pin(new THREE.Vector3(-120, 92, 158), new THREE.Vector3(30, 0, -30));
  } else if (name === 'foot') {
    hour = 15.4;
    player.teleport(-52, -28, 2.4);
    rig.pin(new THREE.Vector3(-61, 3.2, -17), new THREE.Vector3(-50, 1.3, -31));
  } else if (name === 'harbor') {
    hour = 17.55;
    player.teleport(176, 30, 0.5);
    suppressGiverMarker = true; // the teal beam would swallow this frame
    rig.pin(new THREE.Vector3(160, 4, 30), new THREE.Vector3(220, 1, 30));
    hud.startDialogue([
      ['Kapten Rudi', 'One crate, no questions. It fell off a manifest, not a ship.'],
      ['Kira', 'Everything falls somewhere with you, Kapten.'],
    ], () => {});
  }
}

// ---------------------------------------------------------------- start
document.getElementById('startbtn').addEventListener('click', () => {
  audio.unlock();
  started = true;
  document.getElementById('startscreen').classList.add('hidden');
  hud.show();
  hud.notify('Welcome to Teluk Kirana. Follow the teal marker to your first job.');
});
if (shotName) stageShot(shotName);

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();

function focusInfo() {
  if (player.inVehicle) {
    return { pos: player.vehicle.pos, heading: player.vehicle.heading, speed: player.vehicle.speed, vehicle: player.vehicle };
  }
  return { pos: player.pos, heading: player.heading, speed: player.speedNow, vehicle: null };
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const focus = focusInfo();

  if (!started) {
    // Attract mode: slow orbit over the harbour while the title shows.
    const t = performance.now() / 14000;
    camera.position.set(120 + Math.cos(t) * 60, 26, 60 + Math.sin(t) * 60);
    camera.lookAt(40, 0, 0);
    hour = 17.4;
    applySky(camera.position);
    city.update(performance.now() / 1000, 0.25, 0);
    renderer.render(scene, camera);
    return;
  }

  if (!dead && !shotName) {
    gameTime += dt;
    hour = (hour + DAY.hoursPerRealSecond * dt) % 24;
  } else if (shotName) {
    gameTime += dt;
  }

  // Weather state machine.
  if (!shotName) {
    if (!raining && gameTime > nextRainAt) { raining = true; rainEndsAt = gameTime + rng.range(45, 115); }
    if (raining && gameTime > rainEndsAt) { raining = false; nextRainAt = gameTime + rng.range(150, 420); }
  }
  wetFactor += ((raining ? 1 : 0) - wetFactor) * clamp(dt * 0.5, 0, 1);
  rain.visible = raining;
  if (raining) {
    const pos = rainGeo.attributes.position;
    for (let i = 0; i < RAIN_COUNT; i++) {
      let y = pos.getY(i) - 52 * dt;
      if (y < 0) y = 42;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    rain.position.set(focus.pos.x, 0, focus.pos.z);
  }
  audio.setRainLevel(wetFactor);

  const nightFactor = applySky(focus.pos);
  city.update(gameTime, nightFactor, wetFactor);
  const isNight = nightFactor > 0.5;
  if (isNight !== wasNight) {
    wasNight = isNight;
    for (const v of [...traffic.vehicles, ...parked, ...police.cars]) v.setHeadlights(isNight);
    if (player.vehicle) player.vehicle.setHeadlights(isNight);
  }

  if (!dead) {
    // --- player movement / driving
    const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const side = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
    if (player.inVehicle && !shotName) {
      const vehicle = player.vehicle;
      const prevHealth = vehicle.health;
      vehicle.drive(dt, hud.dialogueOpen ? 0 : fwd, hud.dialogueOpen ? 0 : side, city.colliders);
      if (keys.has('Space')) vehicle.speed -= vehicle.speed * 3.2 * dt;
      if (vehicle.health < prevHealth - 3) {
        audio.crash();
        damagePlayer((prevHealth - vehicle.health) * 0.35);
        crowd.scareAt(vehicle.pos.x, vehicle.pos.z, 10);
      }
    } else if (!hud.dialogueOpen && !shotName) {
      const camYaw = rig.yaw;
      const wishX = Math.cos(camYaw) * -fwd + Math.cos(camYaw - Math.PI / 2) * side * -1;
      const wishZ = Math.sin(camYaw) * -fwd + Math.sin(camYaw - Math.PI / 2) * side * -1;
      player.update(dt, wishX, wishZ, keys.has('ShiftLeft') || keys.has('ShiftRight'));
    } else if (player.inVehicle === false) {
      player.update(dt, 0, 0, false);
    }

    // Traffic may hit a pedestrian player.
    if (!player.inVehicle && gameTime > invulnerableUntil) {
      for (const v of traffic.vehicles) {
        if (Math.abs(v.speed) > 4 && distance2d(player.pos.x, player.pos.z, v.pos.x, v.pos.z) < 1.7) {
          damagePlayer(16);
          crowd.scareAt(player.pos.x, player.pos.z, 9);
          break;
        }
      }
    }

    // Running over a pedestrian in a vehicle: crime + damage.
    if (player.inVehicle && Math.abs(player.vehicle.speed) > 5) {
      const hit = crowd.members.find((m) => !m.down && distance2d(player.vehicle.pos.x, player.vehicle.pos.z, m.mesh.position.x, m.mesh.position.z) < 1.6);
      if (hit) {
        crowd.knockDown(hit.mesh.position.x, hit.mesh.position.z, 1.4);
        police.addHeat(WANTED.crimeHeat.hitPedestrian);
        damagePlayer(3);
        hud.notify('You hit a pedestrian!');
      }
    }

    if (gameTime - lastDamageAt > 4 && player.health > 0) {
      player.health = Math.min(100, player.health + dt * 1.1);
    }
  }

  // --- world systems
  if (!shotName) {
    traffic.update(dt);
    crowd.update(dt);
    police.update(dt, focus);
    jobs.update();
  } else {
    crowd.update(dt);
    // Keep the cover chase frozen in its staged composition, rotor spinning.
    if (police.helicopterActive) {
      police.helicopter.userData.rotor.rotation.y += dt * 26;
      police.helicopter.userData.light.intensity = 1150;
      const hp = police.helicopter.position;
      police.helicopter.userData.light.target.position.set(66 - hp.x, -30, 24.6 - hp.z);
    }
    if (player.inVehicle) { player.vehicle.syncMesh(dt); player.pos.copy(player.vehicle.pos); }
  }
  combat.tryShoot(dt, player);

  // --- objectives & prompts
  const objective = jobs.currentObjective();
  const giver = jobs.nextGiver;
  if (objective) {
    objectiveMarker.visible = true;
    objectiveMarker.position.set(objective.x, 0, objective.z);
    objectiveMarker.rotation.y += dt * 0.8;
    if (!dead && distance2d(focus.pos.x, focus.pos.z, objective.x, objective.z) < (player.inVehicle ? 7 : 4.2)) {
      jobs.reachObjective(player.inVehicle);
    }
  } else objectiveMarker.visible = false;

  if (giver && !jobs.active && !suppressGiverMarker) {
    giverMarker.visible = true;
    giverMarker.position.set(giver.pos.x, 0, giver.pos.z);
    giverMarker.rotation.y -= dt * 0.6;
  } else giverMarker.visible = false;

  // Context prompt line.
  let prompt = null;
  if (!player.inVehicle && !hud.dialogueOpen) {
    if (giver && !jobs.active && distance2d(player.pos.x, player.pos.z, giver.pos.x, giver.pos.z) < 3.4) {
      prompt = `E — Talk to ${giver.name}: ${giver.job.title}`;
    } else if (nearestVehicle(3.4)) {
      prompt = 'E — Enter vehicle';
    } else if (!jobs.active && !jobs.sideActive) {
      prompt = 'T — Taxi work · R — Street race';
    }
  } else if (player.inVehicle) {
    prompt = 'E — Step out · 1/2/3 — Radio';
  }
  hud.setPrompt(prompt);

  // --- HUD refresh
  const mapObjective = objective || (giver && !jobs.active ? { x: giver.pos.x, z: giver.pos.z } : null);
  const blips = [
    ...traffic.vehicles.map((v) => ({ x: v.pos.x, z: v.pos.z, kind: 'traffic' })),
    ...police.blips(),
  ];
  hud.drawMinimap(focus.pos, focus.heading, mapObjective, blips);
  hud.setStars(police.stars, police.bustProgress);
  const district = districtAt(focus.pos.x, focus.pos.z);
  const jobText = jobs.active
    ? `${jobs.active.job.title} — ${jobs.active.job.objective}`
    : jobs.sideActive
      ? (jobs.sideActive.kind === 'taxi' ? 'Taxi fare in progress' : 'Street race in progress')
      : `Free roam — ${district.name} district`;
  hud.setStats(cash, respect, player.health, jobText);
  hud.setClock(hour, raining);
  hud.setSpeed(player.inVehicle ? player.vehicle.speed * 3.6 : 0, player.inVehicle);

  // Camera.
  if (!shotName) {
    rig.update(dt, focus.pos, focus.heading, player.inVehicle);
  }

  saveTimer += dt;
  if (saveTimer > 6 && !shotName) { saveTimer = 0; persist(); }

  renderer.render(scene, camera);

  if (shotName) {
    shotFrames += 1;
    if (shotFrames > 45) window.__TK_READY__ = true;
  }
}

animate();
