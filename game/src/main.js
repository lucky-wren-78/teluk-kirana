// Teluk Kirana: Heat Season — game orchestration.
// Fixed-timestep simulation (bug #4 fix): the sim advances in 1/60 s steps
// from an accumulator, so rendering is decoupled from variable frame delta.
// Camera collision (bug #3 fix): the chase camera is clamped out of every
// building AABB before it renders — it can never sit inside a wall.
import * as THREE from 'three';
import { CONFIG, clampNumber } from './config.js';
import { createRng, seedFromString, range } from './rng.js';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { spawnParkedVehicles, spawnTraffic, updateTraffic } from './vehicles.js';
import { spawnPedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { JobManager, JOBS } from './jobs.js';
import { Combat } from './combat.js';
import { GameAudio } from './audio.js';
import { Hud } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';

const SHOT_PRESETS = {
  '1-bridge-bike-dusk': {
    timeOfDay: 17.2, rain: 0, wanted: 3, vehicle: 'bike', place: 'bridge',
    camera: { distance: 11, height: 4.2, yawOffset: 0.15 }, job: 3,
  },
  '2-market-noon': {
    timeOfDay: 12.0, rain: 0, wanted: 0, vehicle: 'foot', place: 'market',
    camera: { distance: 15, height: 11, yawOffset: 0.6 }, job: 0,
  },
  '3-roadblock-rain-night': {
    timeOfDay: 23.2, rain: 1, wanted: 4, vehicle: 'car', place: 'roadblock',
    camera: { distance: 10, height: 3.6, yawOffset: -0.2 }, job: 5, cruise: 0,
  },
  '4-harbor-sunrise-heli': {
    timeOfDay: 6.4, rain: 0, wanted: 3, vehicle: 'car', place: 'harbor',
    camera: { distance: 20, height: 2.2, yawOffset: 0.35 }, job: 6, cruise: 0,
  },
};

function parseShot() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  if (!name || !SHOT_PRESETS[name]) return null;
  return { name, ...SHOT_PRESETS[name] };
}

export class Game {
  constructor() {
    this.started = false;
    this.shot = parseShot();
    this.timeOfDay = 10.0;
    this.rainLevel = 0;
    this.rainTarget = 0;
    this.accumulator = 0;
    this.lastFrame = performance.now();
    this.simTime = 0;
    this.cameraYaw = 0;
    this.cameraPitch = 0.32;
    this.cameraDistance = 10;
    this.keys = {};
    this.dragging = false;
    this.lastPointer = { x: 0, y: 0 };
    this.jobMarker = null;
    this.error = null;
    this.audio = new GameAudio();
    this.hud = new Hud();
  }

  init() {
    const canvas = document.getElementById('game-canvas');
    // No MSAA: SwiftShader (and weak GPUs) pay ~4x fragment cost for it, and
    // the game is still crisp at 1280x720 without it.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Shadows re-render only when flagged (every ~0.5 s of sim): a full shadow
    // pass per frame is far too slow on software GL, and the sun barely moves.
    this.renderer.shadowMap.autoUpdate = false;
    this.shadowTimer = 0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5d6);
    this.scene.fog = new THREE.Fog(0x87b5d6, 90, 460);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

    this.sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -90;
    this.sun.shadow.camera.right = 90;
    this.sun.shadow.camera.top = 90;
    this.sun.shadow.camera.bottom = -90;
    this.sun.shadow.camera.far = 500;
    this.scene.add(this.sun);
    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;
    this.hemi = new THREE.HemisphereLight(0xbcd8ff, 0x8a7a5a, 0.85);
    this.scene.add(this.hemi);

    this.city = buildCity(this.scene);
    this.player = new Player(this.scene);
    this.vehicles = spawnParkedVehicles(this.scene);
    this.traffic = spawnTraffic(this.scene, 14);
    this.peds = spawnPedestrians(this.scene, 34);
    this.police = new Police(this.scene);
    this.combat = new Combat(this.scene, this.camera);
    this.jobManager = new JobManager((event, payload) => this.onJobEvent(event, payload));

    this.buildRain();
    this.bindInput();
    this.bindUi();
    this.applySaveIfAny();

    if (this.shot) this.applyShotPreset();

    this.updateDayNight(0);
    this.refreshHudStatic();
    window.__game = this;
    window.__gameReady = true;
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // --- rain particles -------------------------------------------------------
  buildRain() {
    const count = 1600;
    const positions = new Float32Array(count * 3);
    const rng = createRng(99);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = range(rng, -45, 45);
      positions[i * 3 + 1] = range(rng, 0, 45);
      positions[i * 3 + 2] = range(rng, -45, 45);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xaaccee, size: 0.14, transparent: true, opacity: 0.55 });
    this.rain = new THREE.Points(geo, mat);
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  updateRain(dt) {
    this.rainLevel += (this.rainTarget - this.rainLevel) * Math.min(1, dt * 0.7);
    this.rain.visible = this.rainLevel > 0.05;
    if (!this.rain.visible) return;
    const pos = this.rain.geometry.attributes.position;
    const cx = this.player.x;
    const cz = this.player.z;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 42;
      if (y < 0) {
        y = 42;
        pos.setX(i, cx + (Math.random() - 0.5) * 90);
        pos.setZ(i, cz + (Math.random() - 0.5) * 90);
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    this.rain.position.set(0, 0, 0);
  }

  // --- day / night ----------------------------------------------------------
  updateDayNight(dt) {
    this.timeOfDay = (this.timeOfDay + dt / CONFIG.dayLengthSeconds * 24) % 24;
    const t = this.timeOfDay;
    const sunAngle = ((t - 6) / 12) * Math.PI;
    const sunHeight = Math.sin(sunAngle);
    const daylight = clampNumber(sunHeight * 1.6 + 0.12, 0.06, 1);
    const dusk = clampNumber(1 - Math.abs(sunHeight) * 3.2, 0, 1) * (t > 12 ? 1 : 0.4);
    const skyDay = new THREE.Color(0x87b5d6);
    const skyNight = new THREE.Color(0x0a1428);
    const skyDusk = new THREE.Color(0xe8863a);
    const sky = skyDay.clone().lerp(skyNight, 1 - daylight);
    if (dusk > 0.05 && sunHeight > -0.25) sky.lerp(skyDusk, dusk * 0.55);
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(sky);
    const sunColor = new THREE.Color(0xfff2d0).lerp(new THREE.Color(0xff7733), dusk * 0.7);
    this.sun.color.copy(sunColor);
    this.sun.intensity = 0.25 + daylight * 2.4;
    this.sun.position.set(Math.cos(sunAngle) * 160, Math.max(12, sunHeight * 170), 90);
    this.sunTarget.position.set(this.player.x, 0, this.player.z);
    this.sun.target = this.sunTarget;
    this.hemi.intensity = 0.22 + daylight * 0.65;
    const night = daylight < 0.35;
    for (const lamp of this.city.lamps) {
      lamp.head.material.emissiveIntensity = night ? 2.6 : 0.15;
    }
    // Night lights join/leave the scene with the dark so daylight fragments
    // never pay for them (program recompile happens once at the transition).
    if (night && !this.nightLightsAdded) {
      for (const pl of this.city.nightLights) {
        pl.intensity = 260;
        this.scene.add(pl);
      }
      this.nightLightsAdded = true;
    } else if (!night && this.nightLightsAdded) {
      for (const pl of this.city.nightLights) this.scene.remove(pl);
      this.nightLightsAdded = false;
    }
    // Only the driven vehicle carries a real headlight (see vehicles.js).
    if (this.player.vehicle) this.player.vehicle.setHeadlight(night || this.rainLevel > 0.5);
    this.isNight = night;
    this.daylight = daylight;
  }

  // --- shot mode ------------------------------------------------------------
  applyShotPreset() {
    const s = this.shot;
    this.timeOfDay = s.timeOfDay;
    this.rainTarget = s.rain;
    this.rainLevel = s.rain;
    this.police.setWanted(s.wanted);
    this.cameraDistance = s.camera.distance;
    this.cameraPitch = s.camera.height / s.camera.distance;
    if (s.place === 'bridge') {
      this.player.x = 210; this.player.z = 0; this.player.heading = Math.PI / 2;
    } else if (s.place === 'market') {
      this.player.x = 0; this.player.z = 8; this.player.heading = 2.6;
    } else if (s.place === 'roadblock') {
      this.player.x = 40; this.player.z = 44; this.player.heading = 0.4;
    } else if (s.place === 'harbor') {
      // Container yard at the water's edge, facing east: sunrise over the sea,
      // cranes and containers ahead, the pier to the left. z = -56 keeps the
      // shot axis clear of the crane leg at z = -62.
      this.player.x = 202; this.player.z = -56; this.player.heading = Math.PI / 2;
    }
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.cameraYaw = this.player.heading + s.camera.yawOffset;
    // In shot mode the staged vehicle keeps cruising by itself, so the shot
    // shows motion (speed > 0) instead of a parked car. A preset may set
    // cruise: 0 to stage a stand-off instead (the roadblock shot).
    this.shotCruise = s.cruise !== undefined ? s.cruise
      : s.vehicle === 'bike' ? 9 : s.vehicle === 'car' ? 8 : 0;
    // Freeze the helicopter orbit so it stays composed in frame; the harbour
    // shot flies it low and ahead of the player so it is actually visible.
    if (s.wanted >= 3) {
      this.police.heliFrozen = true;
      this.police.heliAngle = this.player.heading + 0.4;
      if (s.place === 'harbor') {
        this.police.heliAltitude = 12;
        this.police.heliAngle = this.player.heading;
      }
    }
    if (s.vehicle === 'bike' || s.vehicle === 'car') {
      const wantKind = s.vehicle;
      let best = null;
      let bestD = Infinity;
      for (const v of this.vehicles) {
        if (v.kind !== wantKind) continue;
        const d = v.distanceTo(this.player.x, this.player.z);
        if (d < bestD) { bestD = d; best = v; }
      }
      if (best) {
        best.x = this.player.x + Math.sin(this.player.heading) * 1.5;
        best.z = this.player.z + Math.cos(this.player.heading) * 1.5;
        best.heading = this.player.heading;
        best.mesh.position.set(best.x, 0, best.z);
        this.player.enterVehicle(best);
        best.speed = wantKind === 'bike' ? 14 : 11;
      }
    }
    if (s.place === 'roadblock') {
      // Roadblocks straight ahead of the car, across its lane, so the chase
      // camera sees them as the car cruises toward them.
      const dx = Math.sin(this.player.heading);
      const dz = Math.cos(this.player.heading);
      const px = -dz;
      const pz = dx;
      this.police.makeRoadblock(this.player.x + dx * 30, this.player.z + dz * 30, this.player.heading + Math.PI / 2);
      this.police.makeRoadblock(this.player.x + dx * 40 + px * 7, this.player.z + dz * 40 + pz * 7, this.player.heading + Math.PI / 2);
    }
    if (s.job !== undefined && s.job !== null) {
      this.jobManager.startJob(s.job);
      while (this.jobManager.stage === 'dialogue') this.jobManager.advanceDialogue();
    }
    this.started = true;
    const overlay = document.getElementById('start-screen');
    if (overlay) overlay.classList.add('hidden');
    const hud = document.getElementById('hud');
    if (hud) hud.classList.remove('hidden');
  }

  // --- input -----------------------------------------------------------------
  bindInput() {
    const keyMap = {
      KeyW: 'forward', ArrowUp: 'forward',
      KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'shift', ShiftRight: 'shift',
    };
    window.addEventListener('keydown', (e) => {
      if (keyMap[e.code]) { this.keys[keyMap[e.code]] = true; e.preventDefault(); }
      if (e.code === 'KeyE') this.onInteract();
      if (e.code === 'KeyQ') this.cycleRadio();
      if (e.code === 'KeyR') this.toggleRadio();
      if (e.code === 'KeyF') this.onShoot();
      if (e.code === 'KeyH') this.saveNow();
      if (e.code === 'Digit1') this.tryStartJob(0);
      if (e.code === 'Digit2') this.tryStartJob(1);
      if (e.code === 'Digit3') this.tryStartJob(2);
      if (e.code === 'Digit4') this.tryStartJob(3);
      if (e.code === 'Digit5') this.tryStartJob(4);
      if (e.code === 'Digit6') this.tryStartJob(5);
      if (e.code === 'Digit7') this.tryStartJob(6);
      if (e.code === 'Digit8') this.tryStartJob(7);
    });
    window.addEventListener('keyup', (e) => {
      if (keyMap[e.code]) this.keys[keyMap[e.code]] = false;
    });
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.cameraYaw -= (e.clientX - this.lastPointer.x) * 0.005;
      this.cameraPitch = clampNumber(this.cameraPitch + (e.clientY - this.lastPointer.y) * 0.003, 0.06, 1.1);
      this.lastPointer = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', () => { this.dragging = false; });
    canvas.addEventListener('click', () => {
      if (this.started) this.onShoot();
    });
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  bindUi() {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.addEventListener('click', () => this.startGame(false));
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn) {
      if (hasSave()) continueBtn.classList.remove('hidden');
      continueBtn.addEventListener('click', () => this.startGame(true));
    }
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => this.saveNow());
    const radioBtn = document.getElementById('radio-btn');
    if (radioBtn) radioBtn.addEventListener('click', () => this.cycleRadio());
    const jobBtns = document.querySelectorAll('[data-job]');
    jobBtns.forEach((btn) => btn.addEventListener('click', () => this.tryStartJob(Number(btn.dataset.job))));
  }

  startGame(continueSave) {
    this.audio.ensure();
    this.started = true;
    const overlay = document.getElementById('start-screen');
    if (overlay) overlay.classList.add('hidden');
    const hud = document.getElementById('hud');
    if (hud) hud.classList.remove('hidden');
    if (continueSave) this.applySaveIfAny();
    this.hud.toast('Selamat datang di Teluk Kirana. Tekan 1–8 untuk job, E untuk masuk mobil.');
  }

  applySaveIfAny() {
    const data = loadGame();
    if (!data) return;
    if (Number.isFinite(data.cash)) this.player.cash = data.cash;
    if (Array.isArray(data.completedJobs)) {
      for (const id of data.completedJobs) this.jobManager.completed.add(id);
    }
  }

  saveNow() {
    const ok = saveGame({
      cash: this.player.cash,
      completedJobs: [...this.jobManager.completed],
      timeOfDay: this.timeOfDay,
      player: { x: this.player.x, z: this.player.z },
    });
    this.hud.toast(ok ? 'Progress tersimpan.' : 'Gagal menyimpan (storage tidak tersedia).');
  }

  tryStartJob(index) {
    if (!this.started) return;
    const job = this.jobManager.startJob(index);
    if (job) {
      this.hud.showDialogue(job.dialogue[0], 'Tekan E untuk lanjut dialog');
      this.hud.setObjective(`JOB: ${job.title} — ${job.brief}`);
    } else {
      this.hud.toast('Job itu sudah selesai atau sedang berjalan.');
    }
  }

  onJobEvent(event, payload) {
    if (event === 'job-start') {
      this.hud.setJobList(JOBS, this.jobManager.completed, this.jobManager.activeIndex);
    } else if (event === 'job-go') {
      this.hud.hideDialogue();
      const job = payload;
      this.jobMarker = job.target;
      this.hud.setObjective(`► ${job.title}: ${job.brief} → ${job.target.label}`);
      this.hud.toast(`Job dimulai: ${job.title}`);
    } else if (event === 'job-done') {
      this.player.cash += payload.reward;
      this.jobMarker = null;
      this.police.addHeat(payload.wantedOnComplete * 20);
      this.hud.setCash(this.player.cash);
      this.hud.setObjective('Job selesai! Tekan 1–8 untuk job berikutnya.');
      this.hud.setJobList(JOBS, this.jobManager.completed, -1);
      this.hud.toast(`Job selesai! +$${payload.reward}`);
      this.audio.playJobDone();
      this.saveNow();
    } else if (event === 'taxi-pickup') {
      this.jobMarker = payload.dropoff;
      this.hud.toast('Penumpang naik. Antar ke tujuan!');
    } else if (event === 'taxi-done') {
      this.player.cash += payload.fare;
      this.jobMarker = null;
      this.hud.setCash(this.player.cash);
      this.hud.toast(`Takasi selesai! +$${payload.fare}`);
      this.audio.playJobDone();
    } else if (event === 'race-done') {
      this.player.cash += 800;
      this.jobMarker = null;
      this.hud.setCash(this.player.cash);
      this.hud.toast(`Balapan menang! +$800 (${payload.time.toFixed(1)} dtk)`);
    }
  }

  cycleRadio() {
    if (!this.audio.ensure()) return;
    const station = this.audio.cycleStation();
    this.hud.setStation(this.audio.stationIndex, this.audio.radioOn);
    this.hud.toast(`Radio: ${station.name}`);
  }

  toggleRadio() {
    const on = this.audio.toggleRadio();
    this.hud.setStation(this.audio.stationIndex, on);
  }

  nearestVehicle(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const v of this.vehicles) {
      const d = v.distanceTo(this.player.x, this.player.z);
      if (d < bestD) { bestD = d; best = v; }
    }
    for (const v of this.traffic) {
      const d = v.distanceTo(this.player.x, this.player.z);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  onInteract() {
    if (!this.started) return;
    if (this.jobManager.stage === 'dialogue') {
      const advanced = this.jobManager.advanceDialogue();
      const line = this.jobManager.currentDialogue;
      if (line) this.hud.showDialogue(line, 'Tekan E untuk lanjut dialog');
      if (advanced) this.hud.hideDialogue();
      return;
    }
    if (this.player.vehicle) {
      this.player.exitVehicle();
      this.hud.toast('Kamu keluar dari kendaraan. (E untuk masuk lagi)');
      return;
    }
    const v = this.nearestVehicle(CONFIG.interactRange);
    if (v) {
      if (v.traffic) {
        this.traffic = this.traffic.filter((t) => t !== v);
        v.traffic = false;
        this.police.addHeat(20);
        this.hud.toast('Carjacking! Polisi mengejarmu. ★');
      }
      this.player.enterVehicle(v);
      this.audio.playPickup();
    }
  }

  onShoot() {
    if (!this.started || this.player.vehicle) return;
    const targets = [];
    for (const p of this.peds) targets.push(p.mesh);
    for (const c of this.police.cars) targets.push(c.mesh);
    const result = this.combat.shootFromCamera(targets, this.audio);
    if (!result) {
      if (this.combat.ammo <= 0) this.hud.toast('Peluru habis! Cari amunisi di toko senjata (tahan — isi ulang otomatis).');
      return;
    }
    this.hud.setAmmo(this.combat.ammo);
    if (result.hit) {
      this.police.addHeat(12);
      this.hud.toast('Tembakan kena! Polisi datang.');
    }
    if (this.combat.lastShotAt) {
      const rng = createRng(Date.now() % 2147483647);
      for (const p of this.peds) p.update(0, this.city.colliders, rng, this.player, this.combat.lastShotAt);
    }
  }

  // --- simulation step (fixed 1/60 s) ----------------------------------------
  step(dt) {
    this.simTime += dt;
    const input = {
      forward: !!this.keys.forward,
      back: !!this.keys.back,
      left: !!this.keys.left,
      right: !!this.keys.right,
      shift: !!this.keys.shift,
    };
    if (this.started) {
      this.player.update(dt, input, this.city.colliders, this.cameraYaw);
      if (this.player.vehicle) {
        const v = this.player.vehicle;
        if (this.shotCruise) input.forward = true;
        v.drive(dt, input);
        if (this.shotCruise) v.speed = Math.min(v.speed, this.shotCruise);
        v.applyColliders(this.city.colliders);
        // The player's map position IS the vehicle while driving: police,
        // jobs and the minimap all read player.x / player.z.
        this.player.x = v.x;
        this.player.z = v.z;
        this.player.heading = v.heading;
        this.cameraYaw = v.heading;
      }
      updateTraffic(this.traffic, dt, this.city.colliders);
      const rng = createRng(4242 + Math.floor(this.simTime));
      for (const p of this.peds) p.update(dt, this.city.colliders, rng, this.player, null);
      this.police.update(dt, this.player, this.player.vehicle, () => {
        this.hud.toast('Ban kena spike strip! Mobil melambat.');
      });
      const finished = this.jobManager.update(this.player);
      if (finished) this.refreshHudStatic();
      this.jobManager.updateTaxi(this.player);
      this.jobManager.updateRace(dt, this.player);
      this.combat.update(dt);
      this.audio.update();
      const v = this.player.vehicle;
      this.audio.setEngine(!!v, v ? Math.abs(v.speed) / 40 : 0);
      this.audio.setSiren(this.police.sirenOn);
      // Random rain showers roll in and out.
      if (!this.shot && Math.random() < dt * 0.008) {
        this.rainTarget = this.rainTarget > 0.5 ? 0 : 1;
      }
      this.updateRain(dt);
      this.updateDayNight(dt);
    }
    // Keep the sun shadow frustum glued to the player.
    this.sun.position.set(
      this.player.x + Math.cos(((this.timeOfDay - 6) / 12) * Math.PI) * 160,
      Math.max(12, Math.sin(((this.timeOfDay - 6) / 12) * Math.PI) * 170),
      this.player.z + 90,
    );
  }

  // --- camera with building collision (bug #3) -------------------------------
  resolveCameraCollision(desired, target) {
    const p = desired.clone();
    // Never let the camera sit inside a building AABB: lift it above the roof.
    for (const c of this.city.colliders) {
      if (c.bridge) continue;
      if (p.x > c.minX - 0.6 && p.x < c.maxX + 0.6 && p.z > c.minZ - 0.6 && p.z < c.maxZ + 0.6) {
        if (p.y < c.top + 1.6) p.y = c.top + 1.6;
      }
    }
    if (p.y < 1.4) p.y = 1.4;
    // Keep a minimum stand-off from the target so walls never fill the frame.
    const toCam = p.clone().sub(target);
    if (toCam.length() < 2.2) {
      toCam.setLength(2.2);
      p.copy(target).add(toCam);
    }
    return p;
  }

  updateCamera() {
    const focus = this.player.vehicle
      ? new THREE.Vector3(this.player.vehicle.x, 1.6, this.player.vehicle.z)
      : new THREE.Vector3(this.player.x, 1.7, this.player.z);
    const dist = this.shot ? this.shot.camera.distance : this.cameraDistance;
    const pitch = this.shot ? this.shot.camera.height / dist : this.cameraPitch;
    // Chase camera sits BEHIND the vehicle: desired = focus - facing * dist.
    // (An earlier version added Math.PI here, which put the camera in front
    // of the car, showing its headlights and hiding the road ahead.)
    const yaw = this.player.vehicle ? this.player.vehicle.heading : this.cameraYaw;
    const desired = new THREE.Vector3(
      focus.x - Math.sin(yaw) * dist * Math.cos(pitch),
      focus.y + dist * Math.sin(pitch) + 1.2,
      focus.z - Math.cos(yaw) * dist * Math.cos(pitch),
    );
    const safe = this.resolveCameraCollision(desired, focus);
    // In shot mode the camera snaps exactly to its staged position: with a
    // lerped chase the camera would lag a cruising vehicle for seconds on a
    // slow (software-GL) headless run and the subject would drift tiny.
    this.camera.position.lerp(safe, this.shot ? 1 : 0.35);
    this.camera.lookAt(focus.x, focus.y, focus.z);
  }

  updateHudLive() {
    const v = this.player.vehicle;
    this.hud.setSpeed(v ? v.speed * 3.6 : 0, !!v);
    this.hud.setWanted(this.police.wanted);
    this.hud.setHealth(this.player.health);
    this.hud.setClock(this.timeOfDay, (this.timeOfDay % 1) * 60, this.rainLevel > 0.4);
    this.hud.drawMinimap(this);
    if (this.police.bustedTimer > 2.5) {
      this.hud.toast('BUSTED! Polisi menangkapmu — denda $200, wanted direset.');
      this.player.cash = Math.max(0, this.player.cash - 200);
      this.police.setWanted(0);
      this.police.bustedTimer = 0;
      this.hud.setCash(this.player.cash);
    }
    // Interact prompt (E) — nearest vehicle in range.
    if (!this.player.vehicle) {
      const v2 = this.nearestVehicle(CONFIG.interactRange);
      this.hud.setInteract(v2 ? `[E] ${v2.traffic ? 'Bajak mobil' : `Naik ${v2.kind === 'bike' ? 'motor' : 'mobil'}`}` : null);
    } else {
      this.hud.setInteract('[E] Keluar kendaraan');
    }
  }

  refreshHudStatic() {
    this.hud.setCash(this.player.cash);
    this.hud.setAmmo(this.combat.ammo);
    this.hud.setHealth(this.player.health);
    this.hud.setJobList(JOBS, this.jobManager.completed, this.jobManager.activeIndex);
    this.hud.setStation(this.audio.stationIndex, this.audio.radioOn);
    this.hud.setObjective('Tekan 1–8 untuk mulai job, atau jelajahi kota.');
  }

  // --- frame: fixed-step accumulator (bug #4) ---------------------------------
  frame() {
    const now = performance.now();
    let frameDt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = 0;
    frameDt = Math.min(frameDt, 0.5);
    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator >= CONFIG.fixedStep && steps < 30) {
      this.step(CONFIG.fixedStep);
      this.accumulator -= CONFIG.fixedStep;
      steps += 1;
    }
    if (steps === 30) this.accumulator = 0;
    // Refresh the shadow map at most once every 3 s of wall time: a shadow
    // pass every rendered frame is far too slow on software GL.
    if (now - (this.lastShadowWall || 0) > 3000) {
      this.renderer.shadowMap.needsUpdate = true;
      this.lastShadowWall = now;
    }
    if (this.started) this.updateHudLive();
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    const game = new Game();
    game.init();
  } catch (err) {
    const el = document.getElementById('fatal');
    if (el) {
      el.textContent = `Gagal memuat game: ${err.message}`;
      el.classList.add('visible');
    }
    window.__gameError = String(err && err.message ? err.message : err);
    console.error(err);
  }
});
