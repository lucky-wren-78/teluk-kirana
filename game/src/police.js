// police.js — the Teluk Kirana heat: wanted stars, patrol-car pursuit,
// the spotlight helicopter, roadblocks with spike strips, and the bust meter.
//
// Heat is a points pool: crimes add points, staying clean bleeds them off.
// Stars are read from the pool against WANTED.thresholds, and the response
// escalates with the stars — more cars, then the helicopter at 3, then
// roadblocks at 4 and 5.

import * as THREE from 'three';
import { WANTED, ROAD_LINES, CITY } from './config.js';
import { clamp, distance2d } from './rng.js';
import { Vehicle } from './vehicles.js';

function buildHelicopter() {
  const heli = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.9, 2.1), bodyMat);
  body.position.y = 0;
  heli.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.65, 0.5, 2.15), new THREE.MeshLambertMaterial({ color: 0x2244cc }));
  heli.add(stripe);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 0.5), bodyMat);
  tail.position.set(-4.2, 0.4, 0);
  heli.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.08, 0.7), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.25;
  heli.add(rotor);
  heli.userData.rotor = rotor;
  // Searchlight: a real spotlight plus a translucent cone so the beam reads
  // on camera at dusk.
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(7.5, 30, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = -15.5;
  heli.add(beam);
  const light = new THREE.SpotLight(0xfff2b0, 0, 90, 0.42, 0.5, 0.6);
  light.position.set(0, -1, 0);
  heli.add(light);
  heli.add(light.target);
  light.target.position.set(0, -30, 0);
  heli.userData.light = light;
  heli.userData.beam = beam;
  return heli;
}

function buildRoadblock(scene, rng, x, z, heading) {
  const group = new THREE.Group();
  const cars = [];
  for (const offset of [-3.4, 3.4]) {
    const car = new Vehicle(scene, 'police', 0xf0f0f0, x + Math.cos(heading + Math.PI / 2) * offset, z + Math.sin(heading + Math.PI / 2) * offset, heading + Math.PI / 2);
    car.driver = 'roadblock';
    cars.push(car);
  }
  // Spike strip: a dark band with pale teeth across the lane.
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 9.5), new THREE.MeshLambertMaterial({ color: 0x1c1c1e }));
  strip.position.set(x, 0.06, z);
  strip.rotation.y = -heading;
  scene.add(strip);
  group.userData.spiked = false;
  return { cars, strip, x, z, heading, tripped: false };
}

export class PoliceSystem {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.heat = 0;
    this.cars = [];
    this.bustProgress = 0;
    this.onBusted = null;
    this.spawnCooldown = 0;
    this.roadblock = null;
    this.roadblockCooldown = 0;
    this.helicopter = buildHelicopter();
    this.helicopter.visible = false;
    this.helicopterActive = false;
    scene.add(this.helicopter);
  }

  get stars() {
    let stars = 0;
    for (let i = 1; i <= WANTED.maxStars; i++) {
      if (this.heat >= WANTED.thresholds[i]) stars = i;
    }
    return stars;
  }

  addHeat(amount) {
    this.heat = clamp(this.heat + amount, 0, WANTED.thresholds[WANTED.maxStars] + 40);
  }

  setHeat(amount) { this.heat = amount; }

  clearHeat() {
    this.heat = 0;
    this.bustProgress = 0;
  }

  spawnCarNear(playerPos) {
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(55, 80);
    let x = clamp(playerPos.x + Math.cos(angle) * dist, -CITY.halfSize + 10, CITY.halfSize + 60);
    let z = clamp(playerPos.z + Math.sin(angle) * dist, -CITY.halfSize + 10, CITY.halfSize - 10);
    // Snap to the nearest road line so spawns arrive on asphalt.
    const snap = (v) => ROAD_LINES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    if (Math.abs(snap(x) - x) < Math.abs(snap(z) - z)) x = snap(x); else z = snap(z);
    const car = new Vehicle(this.scene, 'police', 0xf0f0f0, x, z, this.rng.range(0, Math.PI * 2));
    car.driver = 'police';
    this.cars.push(car);
    return car;
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    this.cars.splice(this.cars.indexOf(car), 1);
  }

  clearRoadblock() {
    if (!this.roadblock) return;
    for (const car of this.roadblock.cars) this.scene.remove(car.mesh);
    this.scene.remove(this.roadblock.strip);
    this.roadblock = null;
  }

  update(dt, player) {
    // player: { pos, vehicle (or null), speed }
    const stars = this.stars;
    if (stars === 0) {
      // Nobody is looking: units drift away and despawn.
      for (const car of [...this.cars]) {
        car.drive(dt, 0.2, 0, this.colliders);
        if (distance2d(car.pos.x, car.pos.z, player.pos.x, player.pos.z) > 60) this.removeCar(car);
      }
      if (this.helicopterActive) { this.helicopterActive = false; this.helicopter.visible = false; }
      this.clearRoadblock();
      this.bustProgress = 0;
      return;
    }
    this.heat = Math.max(WANTED.thresholds[stars], this.heat - WANTED.decayPerSecond * dt * 0.25);

    // Maintain the fleet size for the current star level.
    this.spawnCooldown -= dt;
    const wanted = WANTED.policeCarsByStars[stars];
    if (this.cars.length < wanted && this.spawnCooldown <= 0) {
      this.spawnCarNear(player.pos);
      this.spawnCooldown = 1.6;
    }
    for (const car of [...this.cars]) {
      const d = distance2d(car.pos.x, car.pos.z, player.pos.x, player.pos.z);
      if (d > 190) { this.removeCar(car); continue; }
      // Pursuit steering: aim at a point a little ahead of the target.
      const lead = clamp(player.speed * 0.35, -6, 10);
      const tx = player.pos.x + Math.cos(player.heading || 0) * lead;
      const tz = player.pos.z + Math.sin(player.heading || 0) * lead;
      const desired = Math.atan2(tz - car.pos.z, tx - car.pos.x);
      let delta = desired - car.heading;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const steer = clamp(delta * 1.9, -1, 1);
      const throttle = d > 7 ? 1 : d > 3.5 ? 0.35 : -0.25;
      car.drive(dt, throttle, steer, this.colliders);
    }

    // Helicopter joins at three stars.
    const wantHeli = stars >= WANTED.helicopterFromStars;
    if (wantHeli && !this.helicopterActive) { this.helicopterActive = true; this.helicopter.visible = true; }
    if (!wantHeli && this.helicopterActive) { this.helicopterActive = false; this.helicopter.visible = false; }
    if (this.helicopterActive) {
      const h = this.helicopter;
      const orbit = performance.now() / 2600;
      h.position.set(
        player.pos.x + Math.cos(orbit) * 15,
        26 + Math.sin(performance.now() / 900) * 1.5,
        player.pos.z + Math.sin(orbit) * 15
      );
      h.rotation.y = -orbit - Math.PI / 2;
      h.userData.rotor.rotation.y += dt * 28;
      h.userData.light.intensity = 2600;
      h.userData.light.target.position.set(player.pos.x - h.position.x, -30, player.pos.z - h.position.z);
    }

    // Roadblocks at four and five stars, thrown across the player's road.
    this.roadblockCooldown -= dt;
    if (stars >= WANTED.roadblockFromStars && !this.roadblock && this.roadblockCooldown <= 0) {
      const heading = player.heading || 0;
      const bx = player.pos.x + Math.cos(heading) * 52;
      const bz = player.pos.z + Math.sin(heading) * 52;
      if (Math.abs(bx) < CITY.halfSize && Math.abs(bz) < CITY.halfSize) {
        this.roadblock = buildRoadblock(this.scene, this.rng, bx, bz, heading);
      }
      this.roadblockCooldown = 14;
    }
    if (this.roadblock) {
      const rb = this.roadblock;
      const d = distance2d(player.pos.x, player.pos.z, rb.x, rb.z);
      if (player.vehicle && !rb.tripped && d < 4.6) {
        rb.tripped = true;
        player.vehicle.spikeSlowTimer = 4.5;
        player.vehicle.speed *= 0.4;
      }
      if (d > 120) this.clearRoadblock();
    }

    // Bust meter: a cop close to a slow or on-foot player fills it.
    let nearestCop = Infinity;
    for (const car of this.cars) {
      nearestCop = Math.min(nearestCop, distance2d(car.pos.x, car.pos.z, player.pos.x, player.pos.z));
    }
    const vulnerable = !player.vehicle || Math.abs(player.speed) < 1.2;
    if (vulnerable && nearestCop < (player.vehicle ? 5.5 : WANTED.bustDistance + 1.6)) {
      this.bustProgress += dt / WANTED.bustSeconds;
      if (this.bustProgress >= 1) {
        this.bustProgress = 0;
        if (this.onBusted) this.onBusted();
      }
    } else {
      this.bustProgress = Math.max(0, this.bustProgress - dt * 0.7);
    }
  }

  // Positions for the minimap: police cars and the helicopter.
  blips() {
    const out = this.cars.map((c) => ({ x: c.pos.x, z: c.pos.z, kind: 'police' }));
    if (this.roadblock) for (const c of this.roadblock.cars) out.push({ x: c.pos.x, z: c.pos.z, kind: 'police' });
    if (this.helicopterActive) out.push({ x: this.helicopter.position.x, z: this.helicopter.position.z, kind: 'heli' });
    return out;
  }
}
