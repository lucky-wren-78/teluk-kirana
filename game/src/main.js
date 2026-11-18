// main.js — Teluk Kirana: Heat Season. Boots three.js over the procedural
// island city, wires every system together (traffic, pedestrians, police,
// missions, combat, radio, saves), runs the game loop and the chase camera,
// and poses the programmed screenshot scenes when the page is opened with
// ?shot=N.

import * as THREE from '../vendor/three.module.min.js';
import { CITY, PALETTE, TUNING, districtAt } from './config.js';
import { createSeededRandom, clamp, lerp, angleDelta, distance2d } from './random.js';
import { makeCanvasTexture } from './geometry.js';
import { buildWorld, resolveCollisions, LANDMARKS } from './world.js';
import {
  createTrafficSystem, updateTraffic, spawnParkedCars,
  createVehicle, driveVehicle,
} from './vehicles.js';
import { createPlayer, updatePlayerOnFoot } from './player.js';
import { spawnPedestrians, updatePedestrians, knockDownPedestrian } from './pedestrians.js';
import { createPoliceForce, updatePolice } from './police.js';
import { tryMeleeAttack, tryPistolShot } from './combat.js';
import { createMissionDirector } from './missions.js';
import { createHud } from './hud.js';
import { createAudioEngine } from './audio.js';
import { defaultSave, loadSave, storeSave, clearSave } from './save.js';
import { poseScreenshotScene } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = Number(params.get('shot') || 0);
const SEED = Number(params.get('seed') || 20261117);
const rng = createSeededRandom(SEED);
const liveRng = createSeededRandom(SEED ^ 0x9e3779b9);

// ---------------------------------------------------------------- renderer
// Adaptive quality: a software rasteriser (SwiftShader, llvmpipe) gets a
// lighter pipeline — no MSAA, no shadow casting — so the game stays smooth on
// anything; real GPUs get the full golden-hour treatment. ?quality=high forces
// the full pipeline.
function detectSoftwareRenderer() {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return false;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    return /swiftshader|llvmpipe|software/i.test(name);
  } catch {
    return false;
  }
}
const SOFTWARE_GL = params.get('quality') !== 'high' && detectSoftwareRenderer();
const container = document.getElementById('scene-container');
const renderer = new THREE.WebGLRenderer({ antialias: !SOFTWARE_GL, powerPreference: 'high-performance' });
renderer.setPixelRatio(SOFTWARE_GL ? 1 : Math.min(window.devicePixelRatio || 1, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.fog, 210, 1150);
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 3200);
camera.position.set(-30, 26, 90);

const hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, PALETTE.hemiIntensity);
scene.add(hemi);
const sun = new THREE.DirectionalLight(PALETTE.sun, PALETTE.sunIntensity);
sun.castShadow = !SOFTWARE_GL;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 320;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

// Gradient sky dome + drifting cloud sprites.
const skyTex = makeCanvasTexture(16, 256, (ctx, w, h) => {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#5fb6d9');
  grad.addColorStop(0.42, '#a8d8e8');
  grad.addColorStop(0.62, '#ffd9a0');
  grad.addColorStop(0.78, '#ffb877');
  grad.addColorStop(1, '#f7bd83');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
});
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1500, 20, 12),
  new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
);
scene.add(sky);
const cloudTex = makeCanvasTexture(128, 64, (ctx, w, h) => {
  const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, 52);
  grad.addColorStop(0, 'rgba(255,250,238,0.85)');
  grad.addColorStop(1, 'rgba(255,250,238,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
});
const clouds = [];
for (let i = 0; i < 11; i++) {
  const cloud = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 46),
    new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false }),
  );
  cloud.position.set(rng.range(-800, 800), rng.range(120, 190), rng.range(-800, 800));
  scene.add(cloud);
  clouds.push(cloud);
}

// ---------------------------------------------------------------- world & cast
const world = buildWorld(scene, rng);
const traffic = createTrafficSystem(scene, rng, TUNING.trafficCount);
const parkedCars = spawnParkedCars(scene, rng, 16);
const jobCar = parkedCars.find((c) => c.isJobCar);
const peds = spawnPedestrians(scene, rng, TUNING.pedestrianCount);
const player = createPlayer(scene, -168, 84);
const police = createPoliceForce(scene);
const audio = createAudioEngine();
const hud = createHud();

// ---------------------------------------------------------------- game state
let saved = loadSave();
let state = { ...(saved || defaultSave()) };
let playing = false;
let paused = false;
let ended = null; // 'busted' | 'wasted' | 'finale'
let currentVehicle = null;
let lastDamageTime = -20;
let elapsed = 0;
let framesRendered = 0;

const director = createMissionDirector({
  scene,
  state,
  police,
  ui: {
    dialog: (name, line) => hud.dialog(name, line),
    banner: (title, sub) => hud.banner(title, sub),
    toast: (text) => hud.toast(text),
  },
  audio,
  jobCar,
  onReward: (job) => {
    state.money += job.reward.money;
    state.respect += job.reward.respect;
    if (job.reward.district) {
      state.districtRep[job.reward.district] = (state.districtRep[job.reward.district] || 0) + 1;
    }
    hud.setMoney(state.money);
  },
  onSeasonComplete: () => {
    ended = 'finale';
    showEndScreen(
      'HEAT SEASON COMPLETE',
      `Every district of Teluk Kirana knows your name. Final tally: $${state.money.toLocaleString('en-US')}, ${state.respect} respect, ${state.racesWon} races won. The island is yours — free roam continues.`,
    );
  },
  persist: () => storeSave(state),
});

const game = {
  scene,
  camera,
  renderer,
  player,
  police,
  director,
  state,
  hud,
  parkedCars,
  peds,
  jobCar,
  traffic,
  world,
  vehicleFactory: { createVehicle },
  frozen: false,
  cameraSnap: false,
  cameraOverride: null,
  enterVehicle: (vehicle, silent) => enterVehicle(vehicle, silent),
};

// ---------------------------------------------------------------- input
const keys = {};
let mouseAttackQueued = false;
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (playing && !ended) togglePause();
  }
  if (e.code === 'KeyR' && playing && !paused) cycleRadio();
  if (e.code === 'KeyE' && playing && !paused && !ended) interact();
  if (e.code === 'KeyF' && playing && !paused && !ended) attack(false);
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
renderer.domElement.addEventListener('pointerdown', () => {
  if (playing && !paused && !ended && !currentVehicle) mouseAttackQueued = true;
});
let orbitYaw = 0;
let dragging = false;
let lastPointerX = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastPointerX = e.clientX;
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  orbitYaw = clamp(orbitYaw - (e.clientX - lastPointerX) * 0.005, -1.5, 1.5);
  lastPointerX = e.clientX;
});
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- flow
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const endScreen = document.getElementById('end-screen');
const continueBtn = document.getElementById('btn-continue');
continueBtn.disabled = !saved;

document.getElementById('btn-new').addEventListener('click', () => {
  clearSave();
  state = { ...defaultSave() };
  beginPlay();
});
continueBtn.addEventListener('click', () => beginPlay());
document.getElementById('btn-resume').addEventListener('click', () => togglePause());
document.getElementById('btn-restart').addEventListener('click', () => {
  clearSave();
  location.reload();
});
document.getElementById('btn-end-ok').addEventListener('click', () => {
  endScreen.classList.add('hidden');
  if (ended === 'busted') respawnAfterBusted();
  else if (ended === 'wasted') respawnAfterWasted();
  ended = null;
});

function beginPlay() {
  audio.unlock();
  startScreen.style.display = 'none';
  hud.show();
  hud.setMoney(state.money);
  hud.setRadio(audio.stationName());
  director.jobIndex = state.jobIndex;
  director.mode = state.seasonDone ? 'free' : 'meet';
  director.refreshObjective();
  playing = true;
}

function togglePause() {
  paused = !paused;
  pauseScreen.classList.toggle('hidden', !paused);
  if (paused) {
    document.getElementById('pause-stats').textContent =
      `$${state.money.toLocaleString('en-US')} · ${state.respect} respect · job ${Math.min(state.jobIndex + 1, 6)} of 6 · ${districtAt(player.x, player.z).name}`;
    storeSave(state);
  }
}

function showEndScreen(title, text) {
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-text').textContent = text;
  endScreen.classList.remove('hidden');
}

function onBusted() {
  if (ended) return;
  ended = 'busted';
  audio.sfx.busted();
  const fine = Math.min(state.money, 100 + police.stars * 60);
  state.money -= fine;
  showEndScreen(
    'BUSTED',
    `The Patroli finally boxed you in. Fine paid: $${fine}. Your car was impounded where it stood — you walk out of the downtown station with your name slightly smaller.`,
  );
}

function respawnAfterBusted() {
  exitVehicle(true);
  police.clearHeat();
  for (let i = police.cars.length - 1; i >= 0; i--) {
    scene.remove(police.cars[i].mesh);
    police.cars.splice(i, 1);
  }
  player.mesh.position.set(60, 0, 66);
  player.health = 80;
  hud.setMoney(state.money);
  storeSave(state);
}

function onWasted() {
  if (ended) return;
  ended = 'wasted';
  audio.sfx.busted();
  const fee = Math.min(state.money, 150);
  state.money -= fee;
  showEndScreen(
    'WASTED',
    `You wake up at the plaza clinic with a $${fee} bill and a new respect for traffic. The season goes on.`,
  );
}

function respawnAfterWasted() {
  exitVehicle(true);
  police.clearHeat();
  player.mesh.position.set(12, 0, -48);
  player.health = 100;
  hud.setMoney(state.money);
  storeSave(state);
}

function cycleRadio() {
  audio.unlock();
  const name = audio.setStation(audio.getStation() + 1);
  hud.setRadio(name);
  hud.toast(name);
}

// ---------------------------------------------------------------- interaction
function nearestVehicle(maxDist) {
  let best = null;
  let bestD = maxDist;
  const consider = (car) => {
    if (car.driver === 'player' || car.driver === 'police' || car.driver === 'posed') return;
    const d = distance2d(player.x, player.z, car.x, car.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  };
  traffic.vehicles.forEach(consider);
  parkedCars.forEach(consider);
  return best;
}

function interact() {
  if (currentVehicle) {
    exitVehicle(false);
    return;
  }
  const car = nearestVehicle(3.6);
  if (car) enterVehicle(car, false);
}

function enterVehicle(car, silent) {
  const wasParked = car.parked;
  const hadDriver = car.driver === 'traffic';
  currentVehicle = car;
  car.driver = 'player';
  car.parked = false;
  player.mesh.visible = false;
  if (!silent) {
    audio.sfx.door();
    if (wasParked || hadDriver) {
      police.addHeat(26);
      hud.toast(hadDriver ? 'Carjacked! The Patroli have been called' : 'You took the car — someone saw that');
    }
    if (audio.getStation() === 3) hud.setRadio(audio.setStation(0));
  }
  director.notifyEnteredVehicle(car);
}

function exitVehicle(silent) {
  if (!currentVehicle) return;
  const car = currentVehicle;
  car.driver = null;
  car.speed = 0;
  const sideX = Math.cos(car.heading);
  const sideZ = -Math.sin(car.heading);
  player.mesh.position.set(car.x + sideX * 2.6, 0, car.z + sideZ * 2.6);
  resolveCollisions(player.mesh.position, TUNING.playerRadius, world.colliders);
  player.mesh.visible = true;
  player.heading = car.heading;
  currentVehicle = null;
  if (!silent) audio.sfx.door();
  audio.setEngine(false, 0);
}

function attack(fromMouse) {
  if (currentVehicle) return;
  if (state.hasPistol && fromMouse) {
    const hit = tryPistolShot(player, peds, traffic.vehicles.concat(parkedCars, police.cars));
    audio.sfx.shot();
    police.addHeat(38);
    if (hit === 'ped') hud.toast('You shot a bystander!');
    return;
  }
  const hit = tryMeleeAttack(player, peds);
  audio.sfx.punch();
  if (hit === 'ped') {
    police.addHeat(30);
    hud.toast('You floored a bystander!');
  }
}

// ---------------------------------------------------------------- damage
function damagePlayer(amount) {
  player.health -= amount;
  lastDamageTime = elapsed;
  hud.flashDamage();
  if (player.health <= 0 && !ended) onWasted();
}

// ---------------------------------------------------------------- camera
const camPos = new THREE.Vector3(-30, 26, 90);
const camTarget = new THREE.Vector3();
let camYaw = Math.PI;

function updateCamera(dt) {
  const focus = currentVehicle || player;
  const fx = focus.x;
  const fz = focus.z;
  // Keep the sun + shadow frustum and the sky centred on the action.
  sun.position.set(fx - 70, 95, fz - 45);
  sun.target.position.set(fx, 0, fz);
  sky.position.set(fx, 0, fz);
  if (game.cameraOverride) {
    const o = game.cameraOverride;
    camera.position.set(o.x, o.y, o.z);
    camera.lookAt(o.lookX, o.lookY, o.lookZ);
    return;
  }
  const heading = currentVehicle ? currentVehicle.heading : player.heading;
  const speed = currentVehicle ? Math.abs(currentVehicle.speed) : 0;
  const dist = currentVehicle ? 10.5 + speed * 0.14 : 7.6;
  const height = currentVehicle ? 4.4 + speed * 0.02 : 3.1;
  if (!dragging) orbitYaw = lerp(orbitYaw, 0, 1 - Math.exp(-dt * 0.7));
  const desiredYaw = heading + orbitYaw;
  if (game.cameraSnap) {
    camYaw = desiredYaw;
  } else {
    camYaw += clamp(angleDelta(camYaw, desiredYaw), -2.6 * dt, 2.6 * dt);
  }
  const bx = fx - Math.sin(camYaw) * dist;
  const bz = fz - Math.cos(camYaw) * dist;
  const k = game.cameraSnap ? 1 : 1 - Math.exp(-dt * 6.5);
  camPos.x = lerp(camPos.x, bx, k);
  camPos.z = lerp(camPos.z, bz, k);
  camPos.y = lerp(camPos.y, height, k);
  camPos.y = Math.max(camPos.y, 1.6);
  camera.position.copy(camPos);
  camTarget.set(fx + Math.sin(camYaw) * 6, 1.5, fz + Math.cos(camYaw) * 6);
  camera.lookAt(camTarget);
  game.cameraSnap = false;
}

// ---------------------------------------------------------------- per-frame
function playerContext() {
  const inCar = !!currentVehicle;
  return {
    px: inCar ? currentVehicle.x : player.x,
    pz: inCar ? currentVehicle.z : player.z,
    inCar,
    vehicle: currentVehicle,
  };
}

function stepGame(dt) {
  const ctx = playerContext();
  // --- player body / car
  if (currentVehicle) {
    const throttle = (keys.KeyW || keys.ArrowUp ? 1 : 0) + (keys.KeyS || keys.ArrowDown ? -1 : 0);
    const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) + (keys.KeyD || keys.ArrowRight ? -1 : 0);
    const everyone = traffic.vehicles.concat(parkedCars, police.cars);
    const impact = driveVehicle(currentVehicle, throttle, steer, !!keys.Space, dt, world.colliders, everyone);
    if (impact > 0) {
      audio.sfx.crash(clamp(impact / 26, 0.3, 1));
      currentVehicle.health -= impact * 0.5;
      if (impact > 15) police.addHeat(5);
      if (currentVehicle.health <= 0) {
        currentVehicle.health = 0;
        hud.toast('The car is wrecked — get out and find another');
      }
    }
    if (currentVehicle.health <= 25) {
      currentVehicle.maxSpeed = Math.min(currentVehicle.maxSpeed, 12);
    }
    audio.setEngine(true, clamp(Math.abs(currentVehicle.speed) / currentVehicle.maxSpeed, 0, 1));
    // Running someone over is the city's loudest crime.
    if (Math.abs(currentVehicle.speed) > 4) {
      for (const ped of peds) {
        if (ped.downTime <= 0 && distance2d(currentVehicle.x, currentVehicle.z, ped.x, ped.z) < 2.3) {
          knockDownPedestrian(ped, 8);
          police.addHeat(45);
          audio.sfx.crash(0.7);
          hud.toast('You ran someone down!');
          currentVehicle.speed *= 0.65;
        }
      }
    }
  } else {
    audio.setEngine(false, 0);
    // Camera-relative wish direction.
    const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) + (keys.KeyS || keys.ArrowDown ? -1 : 0);
    const r = (keys.KeyD || keys.ArrowRight ? 1 : 0) + (keys.KeyA || keys.ArrowLeft ? -1 : 0);
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw);
    const rz = Math.sin(camYaw);
    updatePlayerOnFoot(
      player, fx * f + rx * r, fz * f + rz * r,
      !!keys.ShiftLeft || !!keys.ShiftRight, dt, world.colliders, elapsed,
    );
    if (mouseAttackQueued) {
      mouseAttackQueued = false;
      attack(true);
    }
    // Traffic can hurt a pedestrian player.
    for (const car of traffic.vehicles) {
      if (Math.abs(car.speed) > 5 && distance2d(car.x, car.z, player.x, player.z) < 1.9) {
        damagePlayer(14);
        player.mesh.position.x += Math.sin(car.heading) * 3;
        player.mesh.position.z += Math.cos(car.heading) * 3;
        audio.sfx.crash(0.5);
      }
    }
    // The enter-car prompt.
    const near = nearestVehicle(3.6);
    hud.prompt(near ? `<b>E</b> — enter the ${near.name}${near.parked ? '' : ' (carjack!)'}` : null);
  }

  // --- living city
  updateTraffic(traffic, dt, traffic.vehicles.concat(parkedCars, police.cars), currentVehicle, world.colliders);
  updatePedestrians(
    peds, dt, liveRng, world.colliders, elapsed,
    currentVehicle ? { x: currentVehicle.x, z: currentVehicle.z, speed: Math.abs(currentVehicle.speed) } : null,
  );
  const pctx = playerContext();
  updatePolice(police, dt, {
    playerPos: { x: pctx.px, z: pctx.pz },
    playerSpeed: currentVehicle ? Math.abs(currentVehicle.speed) : 0,
    playerVelX: currentVehicle ? Math.sin(currentVehicle.heading) * currentVehicle.speed : 0,
    playerVelZ: currentVehicle ? Math.cos(currentVehicle.heading) * currentVehicle.speed : 0,
    colliders: world.colliders,
    allVehicles: traffic.vehicles.concat(parkedCars, police.cars),
    onBusted: () => onBusted(),
  }, liveRng, elapsed);
  audio.setSiren(police.stars > 0 ? clamp(1 - police.nearestCopDistance / 75, 0, 1) : 0);

  // Police ramming hurts.
  if (currentVehicle) {
    for (const cop of police.cars) {
      if (distance2d(cop.x, cop.z, currentVehicle.x, currentVehicle.z) < 3.4 && Math.abs(cop.speed) > 9) {
        damagePlayer(3.5);
        cop.speed *= 0.5;
      }
    }
  }

  // Health drifts back when nobody is hurting you.
  if (elapsed - lastDamageTime > 8 && player.health > 0) {
    player.health = Math.min(TUNING.playerHealth, player.health + 1.5 * dt);
  }

  director.update(dt, pctx, elapsed);
}

function refreshHud() {
  const ctx = playerContext();
  hud.setStars(police.stars);
  hud.setHealth(player.health / TUNING.playerHealth);
  hud.setDistrict(ctx.px, ctx.pz);
  hud.setRespect(state.respect, state.districtRep);
  hud.setMoney(state.money);
  if (currentVehicle) {
    hud.setVehicleInfo(`${currentVehicle.name} · ${Math.round(Math.abs(currentVehicle.speed) * 3.6)} km/h · hull ${Math.max(0, Math.round(currentVehicle.health))}%`);
  } else {
    hud.setVehicleInfo(state.hasPistol ? 'On foot · pistol ready (click to shoot, F to punch)' : 'On foot');
  }
  let distText = '';
  if (director.target) {
    const d = distance2d(ctx.px, ctx.pz, director.target.x, director.target.z);
    distText = `${Math.round(d)} m`;
  }
  hud.setObjective(director.objectiveTitle, director.objectiveText, distText);
  hud.drawMinimap({
    px: ctx.px,
    pz: ctx.pz,
    heading: currentVehicle ? currentVehicle.heading : player.heading,
    traffic: traffic.vehicles,
    police: police.cars,
    target: director.target,
    t: elapsed,
  });
}

function frozenCosmetics(t) {
  // Screenshot mode: the world holds its pose, but lights still strobe, the
  // rotor still spins and the sea still moves, so the frame feels alive.
  world.updateCosmetic(t);
  for (const cloud of clouds) cloud.lookAt(camera.position);
  for (const car of police.cars) {
    const red = car.mesh.userData.lightRed;
    const blue = car.mesh.userData.lightBlue;
    if (red && blue) {
      const phase = (t * 2.6 + car.id * 0.37) % 1;
      red.visible = phase < 0.5;
      blue.visible = phase >= 0.5;
    }
  }
  if (police.helicopter.visible) {
    police.helicopter.userData.rotor.rotation.y = t * 31;
    police.helicopter.userData.tailRotor.rotation.x = t * 40;
  }
  const ringPulse = 1 + Math.sin(t * 3.2) * 0.1;
  director.markerGroup.children.forEach((child) => {
    if (child.geometry && child.geometry.type === 'RingGeometry') {
      child.scale.set(ringPulse, ringPulse, 1);
    }
  });
}

// ---------------------------------------------------------------- boot & loop
window.__game = game; // play-test hook: the repo's own shoot.mjs drives the game through it
if (SHOT > 0) {
  startScreen.style.display = 'none';
  playing = true;
  hud.setMoney(state.money);
  poseScreenshotScene(game, SHOT);
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  if (playing && !paused && !ended) {
    if (game.frozen) {
      frozenCosmetics(elapsed);
    } else {
      stepGame(dt);
      world.updateCosmetic(elapsed);
      for (const cloud of clouds) {
        cloud.position.x += dt * 1.1;
        if (cloud.position.x > 900) cloud.position.x = -900;
        cloud.lookAt(camera.position);
      }
    }
    refreshHud();
  } else if (SHOT > 0) {
    frozenCosmetics(elapsed);
    refreshHud();
  }
  hud.update(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  framesRendered++;
  if (SHOT > 0 && framesRendered > 6) window.__shotReady = true;
  const dbgCtx = playerContext();
  window.__gameDebug = {
    playing,
    paused,
    ended,
    stars: police.stars,
    mode: director.mode,
    framesRendered,
    px: dbgCtx.px,
    pz: dbgCtx.pz,
    inCar: dbgCtx.inCar,
    carSpeed: currentVehicle ? currentVehicle.speed : 0,
    health: player.health,
  };
}
animate();
