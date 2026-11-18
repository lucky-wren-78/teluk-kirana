// Teluk Kirana — boot, the fixed-step loop, day/night + rain, the chase
// camera, input, and the ?shot= staging used by shoot.mjs. The game runs
// from plain static files; three.js comes from ./vendor/three.module.min.js.
import * as THREE from 'three';
import { CONFIG, KEYS } from './config.js';
import { createRng, hashSeed } from './rng.js';
import { buildCity } from './city.js';
import { createVehicles, updateVehicles, enterVehicle, exitVehicle } from './vehicles.js';
import { createPlayer, updatePlayer } from './player.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createPolice, updatePolice, addHeat, setWanted } from './police.js';
import { createJobs, startJob, startTaxi, startRace, currentJobDef, updateJobs } from './jobs.js';
import { createCombat, tryShoot, reload, updateCombat } from './combat.js';
import {
  createAudio, ensureAudio, setEngine, setRain, setSiren,
  playShot, playBlip, playHorn, cycleRadio, toggleMute,
} from './audio.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, readBest, applySave } from './save.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : CONFIG.seed;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.palette.skyDay);
scene.fog = new THREE.Fog(CONFIG.palette.fogDay, 140, 720);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(200, 300, 100);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbdd8f2, 0x3d3a33, 0.9);
scene.add(hemi);
const headlight = new THREE.PointLight(0xffe9a8, 0, 70, 1.4);
scene.add(headlight);

const rng = createRng(shotName ? hashSeed(shotName) + seed : seed);
const city = buildCity(scene, rng);
const player = createPlayer(scene, city);
const vehicles = createVehicles(scene, rng, city);
const pedestrians = createPedestrians(scene, rng, city);
const police = createPolice(scene, rng, city);
police.addHeat = (w, amount) => addHeat(w, amount);
const jobs = createJobs(scene);
const combat = createCombat(scene, camera);
const audioState = createAudio();
const audio = {
  ensure: () => ensureAudio(audioState),
  shot: () => playShot(audioState),
  blip: () => playBlip(audioState),
  horn: () => playHorn(audioState),
  siren: (on) => setSiren(audioState, on),
  engine: (kmh, inVeh) => setEngine(audioState, kmh, inVeh),
  rain: (on) => setRain(audioState, on),
  cycleRadio: () => cycleRadio(audioState),
  toggleMute: () => toggleMute(audioState),
};

const world = {
  scene, camera, city, player, vehicles, pedestrians, police, jobs, combat,
  audio, audioState, save: { saveGame: () => saveGame(world) },
  time: 0, timeOfDay: 8.0, weather: 'clear', rainTimer: 40,
  wanted: 0, speedKmh: 0, events: [], screen: 'title',
  camYaw: 0, camPitch: 0.32, camDist: 10,
};
world.hud = createHud(world);
window.__game = world;

function announce(msg) { statusEl.textContent = msg; }

// ---- Day / night + weather ----
function daylightFactor(t) {
  // 0 at night, 1 at noon; smooth at dawn (6h) and dusk (18h).
  const a = ((t - 6) / 12) * Math.PI;
  return Math.max(0, Math.sin(a));
}

function updateSky(dt) {
  world.timeOfDay = (world.timeOfDay + (dt * 24) / CONFIG.dayLengthSec) % 24;
  const t = world.timeOfDay;
  const day = daylightFactor(t);
  const dusk = Math.max(0, 1 - Math.abs(t - 18) / 1.5) + Math.max(0, 1 - Math.abs(t - 6) / 1.5);
  const sky = new THREE.Color(CONFIG.palette.skyNight).lerp(new THREE.Color(CONFIG.palette.skyDay), day);
  if (dusk > 0) sky.lerp(new THREE.Color(CONFIG.palette.skyDusk), Math.min(1, dusk) * 0.7);
  scene.background = sky;
  scene.fog.color.copy(sky);
  sun.intensity = 0.35 + day * 1.6;
  const sunAngle = ((t - 6) / 12) * Math.PI;
  sun.position.set(Math.cos(sunAngle) * 300, Math.max(30, Math.sin(sunAngle) * 320), 120);
  hemi.intensity = 0.5 + day * 0.65;
  // Lamps glow after dark; headlights too.
  const dark = 1 - day;
  const glow = city.lampMats[0];
  glow.color.setHex(dark > 0.35 ? CONFIG.palette.lampGlow : 0x555544);
  for (const lamp of city.lamps) lamp.visible = dark > 0.3;
  const inVeh = player.inVehicle;
  headlight.intensity = dark > 0.35 && inVeh ? 150 : 0;
  if (inVeh && vehicles.playerVehicle) {
    const v = vehicles.playerVehicle;
    headlight.position.set(
      v.pos.x + Math.sin(v.heading) * 2.4, 1.2, v.pos.z + Math.cos(v.heading) * 2.4,
    );
  }
  // Rain scheduling (not in shot mode: the shot fixes the weather).
  if (!shotName) {
    world.rainTimer -= dt;
    if (world.rainTimer <= 0) {
      if (world.weather === 'clear') { world.weather = 'rain'; world.rainTimer = CONFIG.rainLastSec; }
      else { world.weather = 'clear'; world.rainTimer = CONFIG.rainEverySec * (0.7 + rng.next() * 0.6); }
      audio.rain(world.weather === 'rain');
    }
  }
  updateRain(dt);
}

function updateRain(dt) {
  const rain = city.rainPoints;
  const on = world.weather === 'rain';
  rain.visible = on;
  if (!on) return;
  rain.position.set(player.pos.x, 0, player.pos.z);
  const pos = rain.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    let y = pos.getY(i) - dt * 55;
    if (y < 0) {
      y = 40;
      pos.setX(i, rng.range(-60, 60));
      pos.setZ(i, rng.range(-60, 60));
    }
    pos.setY(i, y);
  }
  pos.needsUpdate = true;
}

// ---- Camera ----
function updateCamera(dt) {
  const target = player.pos;
  let dist = player.inVehicle ? 12 : 8.5;
  let height = player.inVehicle ? 4.6 : 3.6;
  if (player.inVehicle && vehicles.playerVehicle && vehicles.playerVehicle.kind === 'bike') {
    dist = 10; height = 3.8;
  }
  const cx = target.x - Math.sin(world.camYaw) * Math.cos(world.camPitch) * dist;
  const cz = target.z - Math.cos(world.camYaw) * Math.cos(world.camPitch) * dist;
  const cy = target.y + height + Math.sin(world.camPitch) * dist * 0.6;
  const want = new THREE.Vector3(cx, cy, cz);
  camera.position.lerp(want, Math.min(1, dt * 6));
  camera.lookAt(target.x, target.y + 1.8, target.z);
  // Keep the camera out of buildings: clamp above ground, pull in if inside one.
  if (camera.position.y < 1.2) camera.position.y = 1.2;
}

// ---- Input ----
const keys = new Set();
const input = {
  get forward() { return keys.has(KEYS.forward) || keys.has('ArrowUp'); },
  get back() { return keys.has(KEYS.back) || keys.has('ArrowDown'); },
  get left() { return keys.has(KEYS.left); },
  get right() { return keys.has(KEYS.right); },
  get run() { return keys.has(KEYS.run); },
  get handbrake() { return keys.has(KEYS.handbrake); },
};
let pointerLocked = false;
canvas.addEventListener('click', () => {
  if (world.screen !== 'playing') return;
  audio.ensure();
  if (!pointerLocked) canvas.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
});
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked || world.screen !== 'playing') return;
  world.camYaw -= e.movementX * 0.0032;
  world.camPitch = Math.max(-0.15, Math.min(0.7, world.camPitch + e.movementY * 0.0022));
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || world.screen !== 'playing') return;
  audio.ensure();
  tryShoot(world);
});
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'ArrowLeft') world.camYaw += 0.12;
  if (e.code === 'ArrowRight') world.camYaw -= 0.12;
  if (world.screen !== 'playing') return;
  if (e.code === KEYS.interact) {
    if (player.inVehicle) exitVehicle(world);
    else if (vehicles.nearestCar) enterVehicle(world, vehicles.nearestCar);
  }
  if (e.code === KEYS.reload) reload(world);
  if (e.code === KEYS.radio) {
    const name = audio.cycleRadio();
    world.hud.toast(`Radio: ${name}`);
  }
  if (e.code === KEYS.horn && player.inVehicle) audio.horn();
  if (e.code === KEYS.mute) {
    const muted = audio.toggleMute();
    world.hud.toast(muted ? 'Suara mati' : 'Suara hidup');
  }
  if (e.code === 'KeyJ') {
    const def = currentJobDef(world);
    if (def && !jobs.active && !jobs.side) startJob(world, jobs.index);
  }
  if (e.code === 'KeyT') startTaxi(world);
  if (e.code === 'KeyG') startRace(world);
  if (e.code === KEYS.pause) {
    world.screen = 'paused';
    world.hud.setPaused(true);
    announce('Jeda.');
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('keydown', (e) => {
  if (e.code === KEYS.pause && world.screen === 'paused') {
    world.screen = 'playing';
    world.hud.setPaused(false);
    announce('Lanjut.');
  }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && world.screen === 'playing') {
    world.screen = 'paused';
    world.hud.setPaused(true);
  }
});

// ---- Simulation step (no rendering: frame() renders once per rAF) ----
function step(dt) {
  world.time += dt;
  updateSky(dt);
  if (world.screen === 'playing') {
    updatePlayer(world, dt, input, world.camYaw);
    updateVehicles(world, dt, input);
    updatePedestrians(world, dt);
    updatePolice(world, dt);
    updateJobs(world, dt);
    updateCombat(world, dt);
    audio.engine(world.speedKmh, player.inVehicle);
    // Crash events: a thud is faked by a HUD flash.
    for (const ev of world.events) {
      if (ev.type === 'crash') world.hud.flashDamage();
    }
    world.events.length = 0;
  } else {
    // Title screen: morning light, traffic and pedestrians drift by.
    world.timeOfDay = 9.5;
    updatePedestrians(world, dt);
    updateVehicles(world, dt, { forward: false, back: false, left: false, right: false, handbrake: false });
  }
}

function render() {
  if (world.screen === 'playing') {
    updateCamera(STEP);
  } else {
    // Slow orbit around the harbour for a living title backdrop.
    const a = world.time * 0.05;
    camera.position.set(Math.sin(a) * 120, 55, 240 + Math.cos(a) * 60);
    camera.lookAt(0, 8, 200);
  }
  world.hud.update(0);
  renderer.render(scene, camera);
}

// ---- Shot staging ----
function stageShot(name) {
  const def = CONFIG.shots[name] || CONFIG.shots.dawn;
  world.screen = 'playing';
  world.hud.hideStart();
  document.getElementById('hud').classList.remove('hidden');
  world.timeOfDay = def.timeOfDay;
  world.weather = def.weather;
  audio.rain(def.weather === 'rain');
  player.pos.set(def.at[0], 0, def.at[1]);
  player.heading = def.heading;
  world.camYaw = def.heading;
  if (def.vehicle === 'car') {
    const car = vehicles.playerCar;
    car.pos.set(def.at[0], 0, def.at[1]);
    car.heading = def.heading;
    enterVehicle(world, car);
  } else if (def.vehicle === 'bike') {
    const bike = vehicles.playerBike;
    bike.pos.set(def.at[0], 0, def.at[1]);
    bike.heading = def.heading;
    enterVehicle(world, bike);
  }
  if (def.wanted > 0) setWanted(world, def.wanted);
  // Play the world forward so traffic, pedestrians and the chase are alive.
  const simInput = { forward: true, back: false, left: false, right: false, run: false, handbrake: false };
  const simSeconds = name === 'nightchase' ? 4 : name === 'rainharbor' ? 2.5 : 3.5;
  const steps = Math.floor(simSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.time += STEP;
    updateSky(STEP);
    if (def.vehicle !== 'foot') updateVehicles(world, STEP, simInput);
    else updatePlayer(world, STEP, { ...simInput, run: false }, world.camYaw);
    updatePedestrians(world, STEP);
    updatePolice(world, STEP);
    updateCombat(world, STEP);
  }
  // Cinematic camera per shot, de-collided: a camera inside a building
  // sees only sky (backfaces are culled), so lift it above any roof that
  // contains it, and above anything between it and its target.
  const p = player.pos;
  const h = player.heading;
  const fx = Math.sin(h), fz = Math.cos(h);
  if (def.cam === 'chase') {
    // Front three-quarter: the getaway car drives at the camera, police behind it.
    // Offset sideways so a road-edge lamp post never sits dead centre.
    const px = Math.cos(h), pz = -Math.sin(h);
    camera.position.set(p.x + fx * 17 + px * 4, 5.2, p.z + fz * 17 + pz * 4);
    camera.lookAt(p.x - fx * 10, 2, p.z - fz * 10);
  } else if (def.cam === 'market') {
    camera.position.set(p.x + 26, 22, p.z + 26);
    camera.lookAt(p.x, 1, p.z);
  } else if (def.cam === 'side') {
    // Profile from the north side of the road, bike near centre, road ahead visible.
    camera.position.set(p.x + 4, 3.8, p.z - 11);
    camera.lookAt(p.x - 4, 1.2, p.z);
  } else {
    camera.position.set(p.x - fx * 9, 2.8, p.z - fz * 9);
    camera.lookAt(p.x + fx * 12, 2.6, p.z + fz * 12);
  }
  deCollideCamera(city, camera);
  world.hud.update(0);
  renderer.render(scene, camera);
  requestAnimationFrame(() => {
    renderer.render(scene, camera);
    window.__shotReady = true;
  });
}

// Lift the camera above any roof that contains it (and above anything on
// the line from its look target), so a staged shot never frames bare sky.
function deCollideCamera(city, camera) {
  const pos = camera.position;
  for (let i = 0; i < 6; i += 1) {
    let inside = null;
    for (const c of city.colliders) {
      if (!c.h) continue;
      if (pos.x > c.minX && pos.x < c.maxX && pos.z > c.minZ && pos.z < c.maxZ && pos.y < c.h + 2) {
        inside = c; break;
      }
    }
    if (!inside) break;
    pos.y = inside.h + 3;
  }
}

// ---- Start / continue / retry ----
function beginPlaying(withSave) {
  audio.ensure();
  if (withSave) {
    const data = loadGame();
    if (data) {
      applySave(world, data);
      world.hud.toast('Save dimuat — selamat datang kembali.');
    }
  }
  world.screen = 'playing';
  world.hud.hideStart();
  document.getElementById('hud').classList.remove('hidden');
  announce('Bermain. WASD untuk bergerak, E untuk masuk mobil.');
}
document.getElementById('start-btn').addEventListener('click', () => beginPlaying(false));
document.getElementById('continue-btn').addEventListener('click', () => beginPlaying(true));
document.getElementById('retry-btn').addEventListener('click', () => window.location.reload());
if (loadGame()) document.getElementById('continue-btn').classList.remove('hidden');
document.getElementById('cash').textContent = `$${readBest() > 0 ? readBest() : CONFIG.player.startCash}`;

// ---- Main loop ----
let last = performance.now();
let accumulator = 0;
function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  let ran = 0;
  while (accumulator >= STEP && ran < 5) {
    step(STEP);
    accumulator -= STEP;
    ran += 1;
  }
  if (ran === 5) accumulator = 0; // drop backlog instead of spiral-lagging
  render();
}

if (shotName) {
  stageShot(shotName);
} else {
  world.hud.showStart();
  requestAnimationFrame(frame);
}
