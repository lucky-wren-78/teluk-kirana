// Teluk Kirana: Heat Season — game orchestration (v6).
//
// Simulation runs on a fixed 1/60 s accumulator, so physics is identical
// at any frame rate; rendering just consumes however many steps are due.
// The chase camera is collision-resolved against the city's building
// AABBs every frame, so it can never clip inside a wall. Screenshot mode
// (?shot=<id>) freezes the clock, the weather and the helicopter, stages
// extra traffic and a crowd around the subject, and starts a story job —
// every cover shot shows a living game, HUD and all.
import * as THREE from 'three';
import { CONFIG, clampNumber, districtAt } from './config.js';
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
  // Golden dusk on the bridge: bike three-quarter rear, police on its
  // tail, helicopter spotlight raking the deck, skyline behind.
  '1-dusk-bridge-pursuit': {
    timeOfDay: 17.5, rain: 0, wanted: 4, vehicle: 'bike', place: 'bridge',
    camera: { distance: 11.5, height: 3.6, yawOffset: 2.59 }, job: 3, cruise: 10,
  },
  // Midday market rush: on foot in the square, stalls and crowd ahead,
  // traffic crossing the road in the foreground.
  '2-market-rush-noon': {
    timeOfDay: 12.3, rain: 0, wanted: 0, vehicle: 'foot', place: 'market',
    camera: { distance: 12.5, height: 5.4, yawOffset: 0.8 }, job: 0, cruise: 0,
  },
  // Rainy night stand-off: wanted 5, roadblock dead ahead, headlights
  // and wet asphalt, seen from a low three-quarter angle.
  '3-rain-roadblock-stand': {
    timeOfDay: 22.7, rain: 1, wanted: 5, vehicle: 'car', place: 'roadblock',
    camera: { distance: 11, height: 2.4, yawOffset: -0.3 }, job: 7, cruise: 0,
  },
  // Sunrise run along the quay: low sun over the sea, cranes and
  // container stacks flanking the road, helicopter low ahead.
  '4-harbor-sunrise-run': {
    timeOfDay: 6.55, rain: 0, wanted: 3, vehicle: 'car', vehicleColor: 0xc0392b, place: 'harbor',
    camera: { distance: 14, height: 3.4, yawOffset: -0.5 }, job: 4, cruise: 5,
  },
};

function parseShot() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  if (!name || !Object.prototype.hasOwnProperty.call(SHOT_PRESETS, name)) return null;
  return { name, ...SHOT_PRESETS[name] };
}

export class Game {
  constructor() {
    this.started = false;
    this.paused = false;
    this.shot = parseShot();
    this.timeOfDay = 9.6;
    this.rainLevel = 0;
    this.rainTarget = 0;
    this.accumulator = 0;
    this.lastFrame = performance.now();
    this.simTime = 0;
    this.cameraYaw = Math.PI;
    this.cameraPitch = 0.34;
    this.cameraDistance = 10.5;
    this.keys = {};
    this.dragging = false;
    this.lastPointer = { x: 0, y: 0 };
    this.jobMarker = null;
    this.shotCruise = 0;
    this.nightLightsAdded = false;
    this.audio = new GameAudio();
    this.hud = new Hud();
  }

  init() {
    const canvas = document.getElementById('game-canvas');
    // antialias off: software GL pays several times the fragment cost for
    // MSAA, and 1280x720 stays crisp without it.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // The shadow map refreshes on a timer, not per frame: the sun crawls,
    // and a full shadow pass per frame is the slowest thing on weak GPUs.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fb9dc);
    this.scene.fog = new THREE.Fog(0x8fb9dc, 95, 470);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 950);

    this.sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, far: 520 });
    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xbcd8ff, 0x8a7a5a, 0.85);
    this.scene.add(this.hemi);

    this.city = buildCity(this.scene);
    this.player = new Player(this.scene);
    this.vehicles = spawnParkedVehicles(this.scene);
    this.traffic = spawnTraffic(this.scene, 16);
    this.peds = spawnPedestrians(this.scene, 38);
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

  // --- rain ---------------------------------------------------------------
  buildRain() {
    const count = 1700;
    const positions = new Float32Array(count * 3);
    const rng = createRng(31337);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = range(rng, -48, 48);
      positions[i * 3 + 1] = range(rng, 0, 46);
      positions[i * 3 + 2] = range(rng, -48, 48);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rain = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xaecfec, size: 0.23, transparent: true, opacity: 0.65,
    }));
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  updateRain(dt) {
    this.rainLevel += (this.rainTarget - this.rainLevel) * Math.min(1, dt * 0.7);
    this.rain.visible = this.rainLevel > 0.05;
    if (!this.rain.visible) return;
    const pos = this.rain.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 44;
      if (y < 0) {
        y = 44;
        pos.setX(i, this.player.x + (Math.random() - 0.5) * 96);
        pos.setZ(i, this.player.z + (Math.random() - 0.5) * 96);
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }

  // --- day / night ----------------------------------------------------------
  updateDayNight(dt) {
    if (!this.shot) this.timeOfDay = (this.timeOfDay + (dt / CONFIG.dayLengthSeconds) * 24) % 24;
    const t = this.timeOfDay;
    const sunAngle = ((t - 6) / 12) * Math.PI;
    const sunHeight = Math.sin(sunAngle);
    const daylight = clampNumber(sunHeight * 1.6 + 0.12, 0.06, 1);
    const golden = clampNumber(1 - Math.abs(sunHeight) * 3.1, 0, 1) * (t > 12 ? 1 : 0.55);
    const sky = new THREE.Color(0x8fb9dc)
      .lerp(new THREE.Color(0x0a1428), 1 - daylight);
    if (golden > 0.05 && sunHeight > -0.25) sky.lerp(new THREE.Color(0xef8438), golden * 0.55);
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(sky);
    this.sun.color.setHex(0xfff2d0).lerp(new THREE.Color(0xff7733), golden * 0.7);
    this.sun.intensity = 0.38 + daylight * 2.35;
    this.sun.position.set(
      this.player.x + Math.cos(sunAngle) * 165,
      Math.max(14, sunHeight * 175),
      this.player.z + 95,
    );
    this.sunTarget.position.set(this.player.x, 0, this.player.z);
    this.hemi.intensity = 0.3 + daylight * 0.62;
    const night = daylight < 0.35;
    if (this.city.lamps.length) {
      this.city.lamps[0].mat.emissiveIntensity = night ? 2.8 : 0.35;
    }
    if (night && !this.nightLightsAdded) {
      for (const pl of this.city.nightLights) {
        pl.intensity = 300;
        this.scene.add(pl);
      }
      this.nightLightsAdded = true;
    } else if (!night && this.nightLightsAdded) {
      for (const pl of this.city.nightLights) this.scene.remove(pl);
      this.nightLightsAdded = false;
    }
    if (this.player.vehicle) this.player.vehicle.setHeadlight(night || this.rainLevel > 0.5);
    this.isNight = night;
    this.daylight = daylight;
    // Water sheen follows the light: bright sparkle by day, inky at night.
    for (const w of this.city.water) {
      w.material.emissiveIntensity = 0.25 + daylight * 0.55 + golden * 0.35;
    }
  }

  // --- screenshot staging ---------------------------------------------------
  applyShotPreset() {
    const s = this.shot;
    const rng = createRng(seedFromString(s.name));
    this.timeOfDay = s.timeOfDay;
    this.rainTarget = s.rain;
    this.rainLevel = s.rain;
    this.police.setWanted(s.wanted);
    this.cameraDistance = s.camera.distance;
    this.cameraPitch = s.camera.height / s.camera.distance;

    if (s.place === 'bridge') {
      this.player.x = 214; this.player.z = 0; this.player.heading = Math.PI / 2;
    } else if (s.place === 'market') {
      this.player.x = -3; this.player.z = 7; this.player.heading = Math.PI;
    } else if (s.place === 'roadblock') {
      this.player.x = 44; this.player.z = 4; this.player.heading = 0;
    } else if (s.place === 'harbor') {
      // Eastbound along the quay toward the water at dawn, photographed
      // from the front three-quarter: the low sun lights the car's front,
      // and the cranes, containers and skyline fill the background.
      this.player.x = 196; this.player.z = -24; this.player.heading = Math.PI / 2;
    }
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.player.mesh.rotation.y = this.player.heading;
    this.cameraYaw = this.player.heading + s.camera.yawOffset;
    this.shotCruise = s.cruise || 0;

    if (s.wanted >= 3) {
      this.police.heliFrozen = true;
      this.police.heliAngle = this.player.heading + 0.45;
      if (s.place === 'harbor') {
        this.police.heliAltitude = 13;
        this.police.heliAngle = this.player.heading + 0.15;
      }
      if (s.place === 'bridge') {
        // The bridge camera looks back west, into the sunset: put the
        // helicopter ahead-west of the rider so its beam is in frame.
        this.police.heliAltitude = 18;
        this.police.heliAngle = this.player.heading - 2.9;
      }
    // Only the roadblock shot wants auto-spawned roadblocks; everywhere
    // else they would wander into the staged frame uninvited.
    if (s.place !== 'roadblock') this.police.suppressBlocks = true;
    }
    // Two patrol cars staged on the subject's tail — the chase is visible
    // in the first frame, not after a random spawn delay. Their chase
    // speed is capped just above the subject's cruise so they trail the
    // shot instead of swarming through the camera.
    if (s.cruise) this.police.cruiseCap = s.cruise + 2.5;
    if (s.wanted >= 2) {
      const back = s.cruise ? 17 : 13;
      const c1 = this.police.spawnPoliceCar(
        this.player.x - Math.sin(this.player.heading) * back,
        this.player.z - Math.cos(this.player.heading) * back,
      );
      c1.heading = this.player.heading;
      const c2 = this.police.spawnPoliceCar(
        this.player.x - Math.sin(this.player.heading) * (back + 9) + Math.cos(this.player.heading) * 3.4,
        this.player.z - Math.cos(this.player.heading) * (back + 9) - Math.sin(this.player.heading) * 3.4,
      );
      c2.heading = this.player.heading;
    }

    if (s.vehicle === 'bike' || s.vehicle === 'car') {
      let best = null;
      let bestD = Infinity;
      for (const v of this.vehicles) {
        if (v.kind !== s.vehicle) continue;
        // A preset may name the exact paint it wants (a bright colour
        // that still reads in dawn/dusk light).
        if (s.vehicleColor !== undefined && v.color !== s.vehicleColor) continue;
        const d = v.distanceTo(this.player.x, this.player.z);
        if (d < bestD) { bestD = d; best = v; }
      }
      if (!best && s.vehicleColor !== undefined) {
        for (const v of this.vehicles) {
          if (v.kind !== s.vehicle) continue;
          const d = v.distanceTo(this.player.x, this.player.z);
          if (d < bestD) { bestD = d; best = v; }
        }
      }
      if (best) {
        best.x = this.player.x + Math.sin(this.player.heading) * 1.6;
        best.z = this.player.z + Math.cos(this.player.heading) * 1.6;
        best.heading = this.player.heading;
        best.mesh.position.set(best.x, 0, best.z);
        best.mesh.rotation.y = best.heading;
        this.player.enterVehicle(best);
        best.speed = s.vehicle === 'bike' ? 13 : 10;
      }
    }

    if (s.place === 'roadblock') {
      const dx = Math.sin(this.player.heading);
      const dz = Math.cos(this.player.heading);
      const px = -dz;
      const pz = dx;
      this.police.makeRoadblock(this.player.x + dx * 17, this.player.z + dz * 17, this.player.heading);
      this.police.makeRoadblock(this.player.x + dx * 27 + px * 6.5, this.player.z + dz * 27 + pz * 6.5, this.player.heading);
      // A patrol car parked sideways across the lane at the first block.
      const guard = this.police.spawnPoliceCar(this.player.x + dx * 15.5 + px * 4.5, this.player.z + dz * 15.5 + pz * 4.5);
      guard.heading = this.player.heading + Math.PI / 2;
    }

    this.stageLife(s, rng);

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

  // Deterministic life staging: nearby traffic and a crowd, placed from a
  // seeded RNG so every render of a shot frames the same living street.
  stageLife(s, rng) {
    const px = this.player.x;
    const pz = this.player.z;
    const fx = Math.sin(this.player.heading);
    const fz = Math.cos(this.player.heading);
    const rx = -fz;
    const rz = fx;
    // Traffic: two cars ahead on the subject's line, two crossing behind.
    // The market is the exception: its life crosses the frame on the z=0
    // avenue, between the camera and the stalls.
    const trafficSpots = s.place === 'market'
      ? [
        { abs: { x: -17, z: -2.6 }, heading: Math.PI / 2 },
        { abs: { x: 19, z: 2.6 }, heading: -Math.PI / 2 },
        { abs: { x: -33, z: 2.6 }, heading: Math.PI / 2 },
        { abs: { x: 34, z: -2.6 }, heading: -Math.PI / 2 },
      ]
      : [
        { along: 26, side: 3.2, heading: this.player.heading },
        { along: 44, side: -3.4, heading: this.player.heading + Math.PI },
        { along: -18, side: 12, heading: this.player.heading + Math.PI / 2 },
        { along: -30, side: -14, heading: this.player.heading - Math.PI / 2 },
      ];
    trafficSpots.forEach((spot, i) => {
      const v = this.traffic[i % this.traffic.length];
      if (!v) return;
      if (spot.abs) {
        v.x = spot.abs.x;
        v.z = spot.abs.z;
      } else {
        v.x = px + fx * spot.along + rx * spot.side;
        v.z = pz + fz * spot.along + rz * spot.side;
      }
      v.heading = spot.heading;
      v.speed = CONFIG.trafficSpeed;
      v.mesh.position.set(v.x, 0, v.z);
      v.mesh.rotation.y = v.heading;
      // Give staged traffic a loop that keeps it inside the shot's
      // scenery — otherwise the traffic AI beelines to its random patrol
      // rectangle and the frame empties (or a car crosses the harbour).
      if (s.place === 'bridge') {
        v.waypoints = [
          { x: 206, z: 3 }, { x: 302, z: 3 }, { x: 302, z: -3 }, { x: 206, z: -3 },
        ];
        v.waypointIndex = spot.side > 0 ? 1 : 3;
      } else if (s.place === 'market') {
        v.waypoints = [
          { x: -64, z: -2.6 }, { x: 64, z: -2.6 }, { x: 64, z: 2.6 }, { x: -64, z: 2.6 },
        ];
        v.waypointIndex = spot.heading > 0 ? 1 : 3;
      }
    });
    // A crowd within sight of the camera, denser for the market shot.
    const crowdCount = s.place === 'market' ? 22 : 10;
    for (let i = 0; i < crowdCount && i < this.peds.length; i++) {
      const ped = this.peds[i];
      const along = range(rng, 4, 30);
      const side = range(rng, -13, 13);
      ped.placeAt(px + fx * along + rx * side, pz + fz * along + rz * side, range(rng, 0, Math.PI * 2));
      ped.pickTarget(rng);
      // Market crowds linger at the stalls instead of wandering off-frame.
      if (s.place === 'market') ped.wait = range(rng, 2.5, 7);
    }
  }

  // --- input ------------------------------------------------------------------
  bindInput() {
    const keyMap = {
      KeyW: 'forward', ArrowUp: 'forward',
      KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'shift', ShiftRight: 'shift',
    };
    window.addEventListener('keydown', (e) => {
      if (keyMap[e.code]) {
        this.keys[keyMap[e.code]] = true;
        e.preventDefault();
      }
      if (e.code === 'KeyE') this.onInteract();
      if (e.code === 'KeyF') this.onShoot();
      if (e.code === 'KeyQ') this.cycleRadio();
      if (e.code === 'KeyR') this.toggleRadio();
      if (e.code === 'KeyM') this.toggleMute();
      if (e.code === 'KeyH') this.saveNow();
      if (e.code === 'Escape') this.togglePause();
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 8) this.tryStartJob(n - 1);
      }
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
      this.cameraPitch = clampNumber(this.cameraPitch + (e.clientY - this.lastPointer.y) * 0.003, 0.06, 1.05);
      this.lastPointer = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', () => { this.dragging = false; });
    canvas.addEventListener('click', () => {
      if (this.started && !this.paused) this.onShoot();
    });
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  bindUi() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    on('start-btn', () => this.startGame(false));
    on('continue-btn', () => this.startGame(true));
    on('save-btn', () => this.saveNow());
    on('radio-btn', () => this.cycleRadio());
    on('mute-btn', () => this.toggleMute());
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn && hasSave()) continueBtn.classList.remove('hidden');
    document.querySelectorAll('[data-job]').forEach((btn) => {
      btn.addEventListener('click', () => this.tryStartJob(Number(btn.dataset.job)));
    });
  }

  togglePause() {
    if (!this.started || this.shot) return;
    this.paused = !this.paused;
    const el = document.getElementById('pause-screen');
    if (el) el.classList.toggle('hidden', !this.paused);
  }

  startGame(continueSave) {
    this.audio.ensure();
    this.started = true;
    const overlay = document.getElementById('start-screen');
    if (overlay) overlay.classList.add('hidden');
    const hud = document.getElementById('hud');
    if (hud) hud.classList.remove('hidden');
    if (continueSave) this.applySaveIfAny();
    this.hud.toast('Selamat datang di Teluk Kirana — tekan 1–8 untuk job, E untuk naik kendaraan.');
  }

  applySaveIfAny() {
    const data = loadGame();
    if (!data) return;
    if (Number.isFinite(data.cash)) this.player.cash = data.cash;
    if (Array.isArray(data.completedJobs) && this.jobManager) {
      for (const id of data.completedJobs) this.jobManager.completed.add(id);
    }
    if (Number.isFinite(data.timeOfDay) && !this.shot) this.timeOfDay = data.timeOfDay;
  }

  saveNow() {
    if (!this.started) return;
    const ok = saveGame({
      cash: this.player.cash,
      completedJobs: [...this.jobManager.completed],
      timeOfDay: this.timeOfDay,
      player: { x: this.player.x, z: this.player.z },
    });
    this.hud.toast(ok ? 'Progress tersimpan.' : 'Penyimpanan tidak tersedia di browser ini.');
  }

  tryStartJob(index) {
    if (!this.started || this.paused) return;
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
      this.jobMarker = payload.target;
      this.hud.setObjective(`► ${payload.title}: ${payload.brief} → ${payload.target.label}`);
      this.hud.toast(`Job dimulai: ${payload.title}`);
    } else if (event === 'job-done') {
      this.player.cash += payload.reward;
      this.jobMarker = null;
      this.police.addHeat(payload.wantedOnComplete * 18);
      this.hud.setCash(this.player.cash);
      this.hud.setObjective('Job selesai! Tekan 1–8 untuk job berikutnya, atau cari taksi & balapan.');
      this.hud.setJobList(JOBS, this.jobManager.completed, -1);
      this.hud.toast(`Job selesai! +$${payload.reward}`);
      this.audio.playJobDone();
      this.saveNow();
    } else if (event === 'taxi-pickup') {
      this.jobMarker = payload.dropoff;
      this.hud.setObjective('Antar penumpang ke tujuan!');
      this.hud.toast('Penumpang naik. Antar ke tujuan!');
    } else if (event === 'taxi-done') {
      this.player.cash += payload.fare;
      this.jobMarker = null;
      this.hud.setCash(this.player.cash);
      this.hud.toast(`Taksi selesai! +$${payload.fare}`);
      this.audio.playJobDone();
    } else if (event === 'race-done') {
      this.player.cash += 850;
      this.jobMarker = null;
      this.hud.setCash(this.player.cash);
      this.hud.toast(`Balapan menang! +$850 (${payload.time.toFixed(1)} dtk)`);
      this.audio.playJobDone();
    }
  }

  cycleRadio() {
    if (!this.audio.ensure()) return;
    const station = this.audio.cycleStation();
    this.hud.setStation(this.audio.stationIndex, this.audio.radioOn, this.audio.muted);
    this.hud.toast(`Radio: ${station.name}`);
  }

  toggleRadio() {
    if (!this.audio.ensure()) return;
    const on = this.audio.toggleRadio();
    this.hud.setStation(this.audio.stationIndex, on, this.audio.muted);
  }

  toggleMute() {
    if (!this.audio.ensure()) return;
    const muted = this.audio.toggleMute();
    this.hud.setStation(this.audio.stationIndex, this.audio.radioOn, muted);
    this.hud.toast(muted ? 'Suara dibisukan.' : 'Suara menyala.');
  }

  nearestVehicle(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const list of [this.vehicles, this.traffic]) {
      for (const v of list) {
        const d = v.distanceTo(this.player.x, this.player.z);
        if (d < bestD) { bestD = d; best = v; }
      }
    }
    return best;
  }

  onInteract() {
    if (!this.started || this.paused) return;
    if (this.jobManager.stage === 'dialogue') {
      const finished = this.jobManager.advanceDialogue();
      const line = this.jobManager.currentDialogue;
      if (line) this.hud.showDialogue(line, 'Tekan E untuk lanjut dialog');
      if (finished) this.hud.hideDialogue();
      return;
    }
    if (this.player.vehicle) {
      this.player.exitVehicle();
      this.hud.toast('Kamu turun. (E untuk naik lagi)');
      return;
    }
    const v = this.nearestVehicle(CONFIG.interactRange);
    if (v) {
      if (v.traffic) {
        this.traffic = this.traffic.filter((t) => t !== v);
        v.traffic = false;
        this.police.addHeat(22);
        this.hud.toast('Carjacking! Polisi mengejarmu. ★');
      }
      this.player.enterVehicle(v);
      this.audio.playPickup();
    }
  }

  onShoot() {
    if (!this.started || this.paused || this.player.vehicle) return;
    const targets = [];
    for (const p of this.peds) targets.push(p.mesh);
    for (const c of this.police.cars) targets.push(c.mesh);
    const result = this.combat.shootFromCamera(targets, this.audio);
    if (!result) {
      if (this.combat.ammo <= 0) this.hud.toast('Magasin kosong — pistol isi ulang otomatis, tunggu sebentar.');
      return;
    }
    this.hud.setAmmo(this.combat.ammo);
    if (result.hit) {
      this.police.addHeat(12);
      this.hud.toast('Kena! Polisi menuju ke sini.');
    }
    if (this.combat.lastShotAt) {
      const rng = createRng(2024);
      for (const p of this.peds) p.update(0, this.city.colliders, rng, this.player, this.combat.lastShotAt);
    }
  }

  // --- fixed-step simulation --------------------------------------------------
  step(dt) {
    this.simTime += dt;
    if (!this.started || this.paused) return;
    const input = {
      forward: !!this.keys.forward,
      back: !!this.keys.back,
      left: !!this.keys.left,
      right: !!this.keys.right,
      shift: !!this.keys.shift,
    };
    this.player.update(dt, input, this.city.colliders, this.cameraYaw);
    if (this.player.vehicle) {
      const v = this.player.vehicle;
      if (this.shotCruise) input.forward = true;
      v.drive(dt, input);
      if (this.shotCruise) v.speed = Math.min(v.speed, this.shotCruise);
      v.applyColliders(this.city.colliders);
      // While driving, the player's map position IS the vehicle: police,
      // jobs, the minimap and the camera all read player.x / player.z.
      this.player.x = v.x;
      this.player.z = v.z;
      this.player.heading = v.heading;
      if (!this.shot) this.cameraYaw = v.heading;
    }
    updateTraffic(this.traffic, dt);
    const pedRng = createRng(5000 + Math.floor(this.simTime * 2));
    for (const p of this.peds) p.update(dt, this.city.colliders, pedRng, this.player, null);
    this.police.update(dt, this.player, this.player.vehicle, () => {
      this.hud.toast('Ban kena spike strip! Mobil melambat.');
      this.audio.playCrash();
    });
    if (this.jobManager.update(this.player)) this.refreshHudStatic();
    this.jobManager.updateTaxi(this.player);
    this.jobManager.updateRace(dt, this.player);
    this.combat.update(dt);
    this.audio.update();
    const v = this.player.vehicle;
    this.audio.setEngine(!!v, v ? Math.abs(v.speed) / 42 : 0);
    this.audio.setSiren(this.police.sirenOn);
    if (!this.shot && Math.random() < dt * 0.007) {
      this.rainTarget = this.rainTarget > 0.5 ? 0 : 1;
    }
    this.updateRain(dt);
    this.updateDayNight(dt);
    // Animated water: a slow swell on the sea planes.
    const swell = Math.sin(this.simTime * 0.7) * 0.05;
    for (const w of this.city.water) w.position.y = 0.02 + swell;
  }

  // --- camera -------------------------------------------------------------------
  resolveCameraCollision(desired, target) {
    const p = desired.clone();
    for (const c of this.city.colliders) {
      if (c.bridge) continue;
      if (p.x > c.minX - 0.6 && p.x < c.maxX + 0.6 && p.z > c.minZ - 0.6 && p.z < c.maxZ + 0.6) {
        if (p.y < c.top + 1.7) p.y = c.top + 1.7;
      }
    }
    if (p.y < 1.5) p.y = 1.5;
    const toCam = p.clone().sub(target);
    if (toCam.length() < 2.4) {
      toCam.setLength(2.4);
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
    // Behind the subject: focus MINUS facing*dist. (Facing the other way
    // photographs headlights and hides the road ahead — a bug we do not
    // ship twice.)
    const yaw = this.shot ? this.cameraYaw : this.player.vehicle ? this.player.vehicle.heading : this.cameraYaw;
    const desired = new THREE.Vector3(
      focus.x - Math.sin(yaw) * dist * Math.cos(pitch),
      focus.y + dist * Math.sin(pitch) + 1.1,
      focus.z - Math.cos(yaw) * dist * Math.cos(pitch),
    );
    const safe = this.resolveCameraCollision(desired, focus);
    // Shot mode snaps to the staged framing; play mode eases toward it.
    this.camera.position.lerp(safe, this.shot ? 1 : 0.32);
    this.camera.lookAt(focus.x, focus.y + 0.4, focus.z);
  }

  updateHudLive() {
    const v = this.player.vehicle;
    this.hud.setSpeed(v ? v.speed * 3.6 : 0, !!v);
    this.hud.setWanted(this.police.wanted);
    this.hud.setHealth(this.player.health);
    this.hud.setClock(this.timeOfDay, (this.timeOfDay % 1) * 60, this.rainLevel > 0.4);
    this.hud.setDistrict(districtAt(this.player.x, this.player.z).name);
    this.hud.drawMinimap(this);
    if (this.police.bustedTimer > 2.5) {
      this.hud.toast('BUSTED! Polisi menangkapmu — denda $200, wanted direset.');
      this.player.cash = Math.max(0, this.player.cash - 200);
      this.police.setWanted(0);
      this.police.bustedTimer = 0;
      this.hud.setCash(this.player.cash);
    }
    if (!this.player.vehicle) {
      const near = this.nearestVehicle(CONFIG.interactRange);
      this.hud.setInteract(near ? `[E] ${near.traffic ? 'Bajak mobil' : `Naik ${near.kind === 'bike' ? 'motor' : 'mobil'}`}` : null);
    } else {
      this.hud.setInteract('[E] Turun dari kendaraan');
    }
  }

  refreshHudStatic() {
    this.hud.setCash(this.player.cash);
    this.hud.setAmmo(this.combat.ammo);
    this.hud.setHealth(this.player.health);
    this.hud.setJobList(JOBS, this.jobManager.completed, this.jobManager.activeIndex);
    this.hud.setStation(this.audio.stationIndex, this.audio.radioOn, this.audio.muted);
    // Never clobber a live job's objective line with the idle hint — in
    // shot mode the staged job IS the mission text the frame must show.
    const active = this.jobManager.activeJob;
    if (active && this.jobManager.stage === 'go') {
      this.hud.setObjective(`► ${active.title}: ${active.brief} → ${active.target.label}`);
    } else if (this.jobManager.stage !== 'done') {
      this.hud.setObjective('Tekan 1–8 untuk mulai job, atau jelajahi kota.');
    }
  }

  // --- frame loop: fixed-step accumulator ---------------------------------------
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
    if (now - (this.lastShadowWall || 0) > 3000) {
      this.renderer.shadowMap.needsUpdate = true;
      this.lastShadowWall = now;
    }
    if (this.started && !this.paused) this.updateHudLive();
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
