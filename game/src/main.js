// main.js - bootstrap and game loop for Teluk Kirana: Heat Season.
// Wires every system together: city, traffic, pedestrians, player,
// police, combat, jobs, HUD, audio and saving. Also stages the
// deterministic screenshot scenes selected with ?shot=name&seed=N
// and raises window.__tkReady once the first frames are stable.

import * as THREE from 'three';
import { Rng, seedFromQuery, shotFromQuery, clamp, distance2d } from './rng.js';
import { POI, gridToWorld, PIER_Z } from './config.js';
import { buildCity } from './city.js';
import { makeTrafficCar, updateTraffic, spawnParkedCars, placeCarMesh, buildCarMesh } from './vehicles.js';
import { Player } from './player.js';
import { spawnPedestrians, scareNearby } from './pedestrians.js';
import { PoliceSystem } from './police.js';
import { Combat } from './combat.js';
import { JobSystem, TaxiActivity, RaceActivity, STORY_JOBS } from './jobs.js';
import { Hud } from './hud.js';
import { GameAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';

const DEFAULT_SEED = 7;
const seed = seedFromQuery(DEFAULT_SEED);
const shotName = shotFromQuery();
const rng = new Rng(seed * 1000 + 17);

// Renderer and scene.
const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
camera.position.set(0, 30, 60);

// World.
const city = buildCity(scene, rng);
const colliders = city.colliders;

// Game state from the save file.
const saved = loadSave();
const state = {
  cash: saved.cash,
  respect: saved.respect,
  jobsDone: saved.jobsDone.slice(),
  sideDone: saved.sideDone,
  station: saved.station || 0,
};

// Actors.
const startX = saved.x || POI.home.x;
const startZ = saved.z || POI.home.z;
const player = new Player(scene, startX, startZ);
const traffic = [];
for (let i = 0; i < 16; i++) traffic.push(makeTrafficCar(scene, rng, colliders));
const parked = spawnParkedCars(scene, rng, 22);
const allCars = () => [...traffic, ...parked, ...police.cars];
const peds = spawnPedestrians(scene, rng, colliders, 30);
const police = new PoliceSystem(scene);
const audio = new GameAudio();
audio.station = state.station;
const hud = new Hud();
const combat = new Combat(scene, audio, police, peds);
const jobs = new JobSystem(scene, state, police);
const taxi = new TaxiActivity(state);
const race = new RaceActivity(state);

jobs.onDialog = (lines) => hud.showDialog(lines);
jobs.onBanner = (title, sub) => { hud.showBanner(title, sub); audio.cashRegister(); };
jobs.onRadio = (text) => hud.showToast(text);

// Job 1 needs a specific coupe near Bimo's bench: the first parked car.
let jobCar = parked[0] || null;

// Input.
const input = {
  forward: false, back: false, left: false, right: false, sprint: false,
  camYaw: Math.PI, camPitch: 0.12,
};
const keys = {};
let started = shotName !== null;
let paused = false;
let gameOver = false;
let pointerLocked = false;

function setKey(code, down) {
  keys[code] = down;
  input.forward = !!(keys.KeyW || keys.ArrowUp);
  input.back = !!(keys.KeyS || keys.ArrowDown);
  input.left = !!(keys.KeyA || keys.ArrowLeft);
  input.right = !!(keys.KeyD || keys.ArrowRight);
  input.sprint = !!(keys.ShiftLeft || keys.ShiftRight);
}

window.addEventListener('keydown', (ev) => {
  if (ev.repeat) return;
  setKey(ev.code, true);
  if (!started) return;
  if (ev.code === 'KeyE') onInteract();
  if (ev.code === 'KeyF') tryShoot();
  if (ev.code === 'KeyR' && player.car) {
    const name = audio.cycleStation();
    state.station = audio.station;
    hud.showToast('Radio: ' + name, 1.6);
  }
  if (ev.code === 'KeyJ') {
    if (!jobs.active && !taxi.active && !race.active) {
      jobs.startNext();
    }
  }
  if (ev.code === 'KeyT') {
    if (!jobs.active && !taxi.active && !race.active) {
      taxi.start(rng);
      hud.showToast('Taxi fare: pick up the passenger', 2.4);
    }
  }
  if (ev.code === 'KeyG') {
    if (!jobs.active && !taxi.active && !race.active) {
      race.start();
      hud.showToast('Street race: hit every checkpoint!', 2.4);
    }
  }
  if (ev.code === 'KeyH' && player.car) audio.horn();
  if (ev.code === 'KeyP' || ev.code === 'Escape') togglePause();
});

window.addEventListener('keyup', (ev) => setKey(ev.code, false));

window.addEventListener('mousemove', (ev) => {
  if (!started) return;
  if (pointerLocked) {
    input.camYaw -= ev.movementX * 0.0032;
    input.camPitch = clamp(input.camPitch + ev.movementY * 0.002, -0.15, 0.6);
  }
});

renderer.domElement.addEventListener('click', () => {
  if (!started || paused || gameOver) return;
  if (hud.dialogOpen) { hud.advanceDialog(); return; }
  if (!pointerLocked) {
    renderer.domElement.requestPointerLock();
  } else {
    tryShoot();
  }
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});

window.addEventListener('mousedown', (ev) => {
  if (started && pointerLocked && ev.button === 0) tryShoot();
});

function tryShoot() {
  if (paused || gameOver || player.car) return;
  const meshes = [player.mesh, ...peds.map((p) => p.mesh), ...allCars().map((c) => c.mesh)];
  combat.extraCars = allCars();
  const fired = combat.fire(player, input.camYaw, perfNow(), meshes);
  if (fired) {
    const p = player.pos;
    scareNearby(peds, p.x, p.z, 26, 5);
  }
}

// E key: advance dialog, enter/exit cars, start jobs at markers.
function onInteract() {
  if (hud.dialogOpen) { hud.advanceDialog(); return; }
  if (paused || gameOver) return;
  if (player.car) {
    player.exitCar();
    return;
  }
  const near = player.nearestCar(allCars(), 3.4);
  if (near) {
    const wasParked = near.parked;
    const jacked = player.enterCar(near);
    input.camYaw = near.heading;
    if (jacked && !wasParked) {
      // Carjacking: the driver bails and the police may notice.
      police.commitCrime(0.85);
      const p = player.pos;
      scareNearby(peds, p.x, p.z, 12, 3);
      hud.showToast('Carjacked! The driver ran off', 2);
      audio.horn();
    } else if (jacked) {
      police.commitCrime(0.3);
    }
    // Job 1 uses the designated coupe.
    if (jobs.active && jobs.active.def.kind === 'deliverCar') {
      hud.showToast('Deliver this car to the Shipyard Garage', 2.4);
    }
  }
}

function togglePause() {
  if (!started || gameOver) return;
  paused = !paused;
  document.getElementById('pauseScreen').classList.toggle('show', paused);
  if (document.pointerLockElement) document.exitPointerLock();
}

// Death and bust handling: hospital respawn with a fine.
function respawnAtHospital(reason) {
  const fine = reason === 'busted'
    ? police.applyBust(state)
    : Math.min(state.cash, 150);
  if (reason === 'wasted') {
    state.cash = Math.max(0, state.cash - 150);
    police.clear();
  }
  if (player.car) player.exitCar();
  player.x = POI.hospital.x;
  player.z = POI.hospital.z;
  player.healFull();
  player.mesh.visible = true;
  gameOver = false;
  document.getElementById('overScreen').classList.remove('show');
  hud.showBanner(reason === 'busted' ? 'BUSTED' : 'WASTED',
    'Hospital bill and fines: $' + fine + '. Stay out of trouble.', 4);
  saveNow();
}

function saveNow() {
  const p = player.pos;
  writeSave({
    cash: state.cash, respect: state.respect, jobsDone: state.jobsDone,
    sideDone: state.sideDone, x: p.x, z: p.z, station: audio.station,
  });
}

// Chase target for job 5: one fast truck-like car that flees.
let targetTruck = null;
function ensureTargetTruck() {
  if (targetTruck) return;
  const mesh = buildCarMesh(0x8a4fd0, {});
  mesh.scale.set(1.15, 1.15, 1.3);
  scene.add(mesh);
  targetTruck = {
    mesh, x: gridToWorld(3), z: gridToWorld(5) - 10, heading: 0,
    speed: 0, health: 160, cruise: 17, parked: false,
    route: [], routeIdx: 0, driverFleeing: 0, stuck: 0, stopped: false,
  };
  placeCarMesh(targetTruck);
  jobs.targetCar = targetTruck;
  traffic.push(targetTruck);
}

function updateTargetTruck(dt) {
  if (!targetTruck || !jobs.active || jobs.active.def.kind !== 'chaseTarget') return;
  const t = targetTruck;
  if (t.health <= 40) { t.stopped = true; t.speed = 0; placeCarMesh(t); return; }
  // Flee from the player along the roads: reuse traffic routing by
  // steering away and keeping speed up.
  const p = player.pos;
  const away = Math.atan2(t.x - p.x, t.z - p.z);
  const snapped = Math.round(away / (Math.PI / 2)) * (Math.PI / 2);
  t.heading += clamp(((snapped - t.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1.8 * dt, 1.8 * dt);
  t.speed = Math.min(t.cruise, t.speed + 9 * dt);
  t.x += Math.sin(t.heading) * t.speed * dt;
  t.z += Math.cos(t.heading) * t.speed * dt;
  t.x = clamp(t.x, -250, 250);
  t.z = clamp(t.z, -250, 260);
  placeCarMesh(t);
}

// Start / pause / game-over buttons.
const startScreen = document.getElementById('startScreen');
document.getElementById('startBtn').addEventListener('click', () => {
  audio.start();
  audio.resume();
  started = true;
  startScreen.classList.add('hidden');
  hud.showBanner('TELUK KIRANA', 'Press J for your first job. WASD to move, E to enter cars.', 4.5);
});
document.getElementById('resetBtn').addEventListener('click', () => {
  clearSave();
  hud.showToast('Save cleared. Reload for a fresh start.', 3);
});
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('respawnBtn').addEventListener('click', () => respawnAtHospital('wasted'));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let saveTimer = 0;
window.addEventListener('beforeunload', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

const clock = new THREE.Clock();
let elapsed = 0;
function perfNow() { return elapsed; }

let framesRendered = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (paused) { renderer.render(scene, camera); return; }
  elapsed += dt;
  const now = elapsed;

  if (started && !gameOver) {
    // Remember the crash state before the player update consumes it.
    const prevSpeed = Math.abs(player.carSpeed);
    player.update(dt, input, colliders, allCars(), now);

    // Crashes: sound, damage, panic and heat.
    if (player.crashHurt) {
      const impact = player.crashHurt;
      audio.crash(clamp(impact / 22, 0.3, 1));
      player.hurt(clamp((impact - 9) * 0.7, 0, 14), now);
      const p = player.pos;
      scareNearby(peds, p.x, p.z, 16, 4);
      if (player.hitCar) {
        player.hitCar.health -= impact * 1.6;
        police.commitCrime(0.5);
        player.hitCar = null;
      } else if (impact > 16) {
        police.commitCrime(0.35);
      }
      player.crashHurt = 0;
    }
    void prevSpeed;

    // On-foot camera yaw slowly follows the player heading.
    if (!player.car && !pointerLocked) {
      input.camYaw += clamp(((player.heading - input.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1.2 * dt, 1.2 * dt);
    }
    if (player.car && !pointerLocked) {
      input.camYaw += clamp(((player.car.heading - input.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -2.4 * dt, 2.4 * dt);
    }

    // Traffic obstacles include the player car and police.
    const obstacles = [...traffic, ...police.cars];
    if (player.car) obstacles.push(player.car);
    updateTraffic(traffic.filter((c) => c !== targetTruck), dt, obstacles, () => audio.horn());
    if (targetTruck && traffic.includes(targetTruck)) updateTargetTruck(dt);
    for (const ped of peds) {
      ped.update(dt);
      // Fast cars scare pedestrians.
      if (player.car && Math.abs(player.carSpeed) > 14) {
        const p = player.pos;
        if (distance2d(p.x, p.z, ped.x, ped.z) < 8) ped.scare(p.x, p.z, 3);
      }
      // Cars running over pedestrians is a serious crime.
      if (player.car && !ped.dead && distance2d(player.car.x, player.car.z, ped.x, ped.z) < 1.7
        && Math.abs(player.carSpeed) > 3) {
        ped.kill();
        police.commitCrime(1.4);
        audio.crash(0.4);
      }
    }

    police.update(dt, player, colliders, now);
    combat.update(dt);
    combat.policeReturnFire(dt, player, now);

    // Jobs and side activities.
    if (jobs.active && jobs.active.def.kind === 'chaseTarget') ensureTargetTruck();
    jobs.update(dt, { player, onFailSound: () => audio.failTone() });
    const taxiResult = taxi.update(player);
    if (taxiResult === 'picked') hud.showToast('Passenger in! Take them to the gold marker', 2.4);
    if (taxiResult === 'done') { hud.showBanner('FARE PAID', '+$' + taxi.fare); audio.cashRegister(); saveNow(); }
    const raceResult = race.update(dt, player);
    if (raceResult === 'checkpoint') hud.showToast('Checkpoint! Next one lit up', 1.6);
    if (raceResult === 'done') { hud.showBanner('RACE WON', '+$' + race.prize); audio.cashRegister(); saveNow(); }
    if (raceResult === 'failed') { hud.showBanner('RACE LOST', 'Out of time'); audio.failTone(); }

    // Objective beam for side activities shares the job beam slot.
    if (!jobs.active) {
      const sideTarget = taxi.target() || race.target();
      jobs.beam.visible = !!sideTarget;
      if (sideTarget) jobs.beam.position.set(sideTarget.x, 0, sideTarget.z);
    }

    // Bust and death.
    if (police.busted) respawnAtHospital('busted');
    if (player.dead && !gameOver) {
      gameOver = true;
      document.getElementById('overScreen').classList.add('show');
      if (document.pointerLockElement) document.exitPointerLock();
    }

    // Audio beds.
    audio.updateRadio(!!player.car);
    audio.updateEngine(!!player.car, player.speedNow);
    audio.updateSiren(police.stars > 0);
    audio.updateHeli(police.heliActive);

    // Autosave.
    saveTimer += dt;
    if (saveTimer > 8) { saveTimer = 0; saveNow(); }

    player.updateCamera(camera, dt, input);
  }

  city.update(dt, elapsed);

  // HUD view model.
  const p = player.pos;
  const activeTarget = jobs.currentTarget()
    || (jobs.active ? null : (taxi.target() || race.target()));
  let prompt = '';
  if (!player.car && !hud.dialogOpen) {
    if (player.nearestCar(allCars(), 3.4)) prompt = 'E - enter car';
  }
  hud.update(dt, {
    health: player.health,
    stars: police.stars,
    cooling: police.unseenFor > 2.5,
    cash: state.cash,
    respect: state.respect,
    speedKmh: player.speedNow,
    inCar: !!player.car,
    stationName: audio.stationNames[audio.station],
    objective: jobs.active ? jobs.objectiveText()
      : taxi.active ? (taxi.stage === 'pickup' ? 'Taxi: pick up the passenger' : 'Taxi: drop off the passenger')
        : race.active ? 'Race: checkpoint ' + (race.idx + 1) + ' of ' + race.points.length
          : jobs.objectiveText(),
    x: p.x, z: p.z, heading: player.car ? player.car.heading : player.heading,
    target: activeTarget,
    traffic: traffic,
    police: police.cars,
    timeLeft: jobs.active && jobs.active.def.timeLimit && jobs.active.stage === 'main'
      ? jobs.active.timeLeft
      : race.active ? race.timeLeft : null,
    arrest: police.arrestTimer > 0 ? police.arrestTimer / 2.6 : 0,
    prompt,
  });

  renderer.render(scene, camera);
  framesRendered++;
  if (framesRendered === 12 && !window.__tkReady) {
    window.__tkReady = true;
  }
}

// Screenshot scenes: deterministic staging per shot name.
function stageShot(name) {
  startScreen.classList.add('hidden');
  if (name === 'cover') {
    // Player car fleeing east on the harbour road, three police cars
    // close behind and the helicopter overhead with its spotlight.
    const car = {
      mesh: buildCarMesh(0xd94f30, {}),
      x: -20, z: gridToWorld(6), heading: Math.PI / 2,
      speed: 17, health: 100, parked: false, cruise: 17,
      route: [], routeIdx: 0, driverFleeing: 0, stuck: 0,
    };
    scene.add(car.mesh);
    placeCarMesh(car);
    player.enterCar(car);
    player.carSpeed = 17;
    police.setStars(4);
    const copSpots = [[-8.5, 3.6], [-13.5, -3.8], [-19, 0.8]];
    for (const [back, side] of copSpots) {
      const cop = police.spawnCop({ x: car.x + back, z: car.z + side });
      cop.x = car.x + back;
      cop.z = car.z + side;
      cop.heading = Math.PI / 2;
      cop.speed = 16;
      placeCarMesh(cop);
    }
    police.heliActive = true;
    police.heli.visible = true;
    police.heli.position.set(car.x + 12, 19, car.z - 12);
    police.heli.rotation.y = 0.5;
    police.heli.updateMatrixWorld(true);
    const poolLocal = police.heli.worldToLocal(new THREE.Vector3(car.x, 0.6, car.z));
    police.heli.userData.pool.position.copy(poolLocal);
    input.camYaw = Math.PI / 2;
    camera.position.set(car.x - 23, 5.4, car.z + 4);
    camera.lookAt(car.x + 9, 1.7, car.z - 1);
    hud.showBanner('HEAT SEASON', 'Job 6: deliver the cargo to Palm Heights');
    jobs.beam.visible = true;
    jobs.beam.position.set(gridToWorld(3), 0, PIER_Z);
  } else if (name === 'city') {
    // High view over the market district at dusk.
    camera.position.set(gridToWorld(3) - 70, 52, gridToWorld(3) - 70);
    camera.lookAt(gridToWorld(3) + 20, 4, gridToWorld(3) + 26);
    player.x = gridToWorld(3);
    player.z = gridToWorld(3);
    player.mesh.visible = false;
    police.setStars(2);
    hud.showBanner('PASAR RAYA', 'Grand Market district - job 2 pickup nearby');
  } else if (name === 'foot') {
    // On foot in the market with a dialog open and a job marker ahead.
    player.x = gridToWorld(3) - 12;
    player.z = gridToWorld(3) + 4;
    player.heading = Math.PI / 2;
    input.camYaw = Math.PI / 2;
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.heading;
    jobs.startNext();
    hud.showDialog([
      ['Ratu', 'My spice crates sit at the Grand Market, and the pier buyers leave soon!'],
      ['Ratu', 'Pick up the package, then race it to the pier. Quick!'],
    ]);
    police.setStars(1);
    player.snapCamera(camera, input);
  } else if (name === 'harbor') {
    // On the pier looking east: the player's car in front, cranes and
    // container stacks along the deck, boats and open water beyond.
    const car = {
      mesh: buildCarMesh(0x2ea8a0, {}),
      x: -40, z: gridToWorld(6), heading: Math.PI / 2,
      speed: 0, health: 100, parked: false, cruise: 0,
      route: [], routeIdx: 0, driverFleeing: 0, stuck: 0,
    };
    scene.add(car.mesh);
    placeCarMesh(car);
    player.enterCar(car);
    player.carSpeed = 0;
    camera.position.set(car.x - 19, 4.4, car.z - 2);
    camera.lookAt(car.x + 30, 2.5, car.z + 12);
    jobs.beam.visible = true;
    jobs.beam.position.set(gridToWorld(3), 0, PIER_Z);
    hud.showBanner('PELABUHAN LAMA', 'Old Harbor - the pier at golden hour');
  }
}

if (shotName) {
  stageShot(shotName);
  // Keep rendering the staged scene with gentle idle motion.
  let shotFrames = 0;
  const shotLoop = () => {
    requestAnimationFrame(shotLoop);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    city.update(dt, elapsed);
    // Flash police light bars in staged scenes.
    for (const cop of police.cars) {
      const bar = cop.mesh.userData.lightbar;
      if (bar) {
        const phase = Math.floor(elapsed * 6) % 2 === 0;
        bar.redMat.color.setHex(phase ? 0xff2222 : 0x661111);
        bar.blueMat.color.setHex(phase ? 0x112266 : 0x3388ff);
      }
    }
    if (police.heli.visible) {
      police.heli.userData.rotor.rotation.y += dt * 28;
    }
    const p = player.pos;
    hud.update(dt, {
      health: 86, stars: police.stars, cooling: false,
      cash: state.cash + 640, respect: state.respect + 36,
      speedKmh: player.car ? Math.abs(player.carSpeed) * 3.6 : 0,
      inCar: !!player.car, stationName: audio.stationNames[0],
      objective: shotName === 'cover' ? 'Job 6: Deliver the cargo to Palm Heights'
        : shotName === 'foot' ? 'Job: pick up the spice package at Pasar Raya'
          : shotName === 'harbor' ? 'Explore the pier, or press J for a job'
            : 'Free roam - 6 story jobs across 5 districts',
      x: p.x, z: p.z, heading: player.car ? player.car.heading : player.heading,
      target: jobs.currentTarget() || (jobs.beam.visible ? { x: jobs.beam.position.x, z: jobs.beam.position.z } : null),
      traffic, police: police.cars,
      timeLeft: shotName === 'foot' ? 96 : null,
      arrest: 0, prompt: shotName === 'foot' ? 'E - talk / enter car' : '',
    });
    renderer.render(scene, camera);
    shotFrames++;
    if (shotFrames === 10 && !window.__tkReady) window.__tkReady = true;
  };
  shotLoop();
} else {
  frame();
}

// Expose a tiny handle for debugging in the console.
window.__tk = { scene, camera, player, police, jobs, state };
