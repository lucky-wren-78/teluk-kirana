// Teluk Kirana — vehicles: the cars and motorbikes the player can drive,
// the traffic that loops the road grid, and the physics that moves both.
//
// Two hard rules live here. First, every physics field starts as a finite
// number and is re-sanitised each step, so a vehicle can never NaN itself
// off the map. Second, only the vehicle the player is driving carries a
// real spotlight headlight — twenty spotlights would make every fragment
// on screen pay for all of them.
import * as THREE from 'three';
import { CONFIG, PARKED_VEHICLES, clampNumber, safeDivide } from './config.js';
import { createRng, range, pick } from './rng.js';
import { resolveCircleCollision } from './city.js';

const paintMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.3 });
const GLASS = new THREE.MeshStandardMaterial({ color: 0x16222c, roughness: 0.12, metalness: 0.7 });
const TIRE = new THREE.MeshStandardMaterial({ color: 0x131313, roughness: 1 });
const CHROME = new THREE.MeshStandardMaterial({ color: 0xd3dde2, roughness: 0.22, metalness: 0.85 });
const HEADLAMP = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffee88, emissiveIntensity: 1.7 });
const TAILLAMP = new THREE.MeshStandardMaterial({ color: 0x8f0f0f, emissive: 0xd21f1f, emissiveIntensity: 0.9 });

function wheel(x, z) {
  const w = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.27, 12), TIRE);
  w.rotation.z = Math.PI / 2;
  w.position.set(x, 0.37, z);
  w.castShadow = true;
  return w;
}

export function makeCarMesh(color, model = 'sedan') {
  const g = new THREE.Group();
  const paint = paintMat(color);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 4.4), paint);
  body.position.y = 0.63;
  body.castShadow = true;
  g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.1), paint);
  hood.position.set(0, 0.86, 1.75);
  g.add(hood);

  if (model === 'van') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.05, 3.7), GLASS);
    cabin.position.set(0, 1.32, -0.1);
    cabin.castShadow = true;
    g.add(cabin);
  } else if (model === 'pickup') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.58, 1.7), GLASS);
    cabin.position.set(0, 1.2, -1.05);
    cabin.castShadow = true;
    g.add(cabin);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.4, 1.7), paint);
    bed.position.set(0, 0.98, 1.25);
    g.add(bed);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xa9825a, roughness: 1 }));
    crate.position.set(0, 1.3, 1.25);
    g.add(crate);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.56, 2.15), GLASS);
    cabin.position.set(0, 1.18, -0.25);
    cabin.castShadow = true;
    g.add(cabin);
    if (model === 'hatch') {
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.42), paint);
      spoiler.position.set(0, 1.12, -2.05);
      g.add(spoiler);
    }
    if (model === 'taxi') {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.24, 0.42),
        new THREE.MeshStandardMaterial({ color: 0xf2b705, emissive: 0xf2b705, emissiveIntensity: 1.1 }));
      sign.position.set(0, 1.6, -0.25);
      g.add(sign);
    }
  }
  for (const s of [-0.63, 0.63]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.17, 0.1), HEADLAMP);
    head.position.set(s, 0.68, 2.21);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.1), TAILLAMP);
    tail.position.set(s, 0.68, -2.21);
    g.add(tail);
  }
  const wheels = [wheel(-0.96, 1.45), wheel(0.96, 1.45), wheel(-0.96, -1.45), wheel(0.96, -1.45)];
  for (const w of wheels) g.add(w);
  g.userData.wheels = wheels;
  return g;
}

export function makeBikeMesh(color) {
  const g = new THREE.Group();
  const paint = paintMat(color);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 2.05), paint);
  frame.position.y = 0.74;
  frame.castShadow = true;
  g.add(frame);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.34, 0.78), CHROME);
  tank.position.set(0, 1.04, 0.22);
  g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.13, 0.95),
    new THREE.MeshStandardMaterial({ color: 0x191919, roughness: 1 }));
  seat.position.set(0, 1.0, -0.55);
  g.add(seat);
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), CHROME);
  fork.position.set(0, 0.85, 0.92);
  fork.rotation.x = 0.35;
  g.add(fork);
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.82, 6), CHROME);
  bars.rotation.z = Math.PI / 2;
  bars.position.set(0, 1.16, 0.98);
  g.add(bars);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), HEADLAMP);
  lamp.position.set(0, 0.88, 1.06);
  g.add(lamp);
  const wheels = [];
  for (const wz of [0.98, -0.95]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.11, 8, 18), TIRE);
    w.position.set(0, 0.37, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Vehicle {
  constructor(kind, model, color, x, z, heading) {
    this.kind = kind;
    this.model = model;
    this.color = color;
    this.x = Number.isFinite(x) ? x : 0;
    this.z = Number.isFinite(z) ? z : 0;
    this.heading = Number.isFinite(heading) ? heading : 0;
    this.speed = 0;
    this.steer = 0;
    this.lean = 0;
    this.leanVelocity = 0;
    this.wheelSpin = 0;
    this.throttle = 0;
    this.brake = 0;
    this.headlightOn = false;
    this.spiked = false;
    this.driven = false;
    this.traffic = false;
    this.waypoints = [];
    this.waypointIndex = 0;
    this.mesh = kind === 'bike' ? makeBikeMesh(color) : makeCarMesh(color, model);
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // Built now, attached only while the player drives this vehicle.
    this.headlight = new THREE.SpotLight(0xfff2c0, 0, 58, 0.55, 0.45, 1.2);
    this.headlight.position.set(0, 0.95, 2.1);
    this.headlightTarget = new THREE.Object3D();
    this.headlightTarget.position.set(0, 0, 24);
    this.headlight.target = this.headlightTarget;
  }

  attachHeadlight() {
    if (!this.headlight.parent) {
      this.mesh.add(this.headlightTarget);
      this.mesh.add(this.headlight);
    }
  }

  detachHeadlight() {
    if (this.headlight.parent) {
      this.mesh.remove(this.headlight);
      this.mesh.remove(this.headlightTarget);
    }
    this.headlight.intensity = 0;
  }

  sanitize() {
    for (const key of ['x', 'z', 'heading', 'speed', 'steer', 'lean', 'leanVelocity', 'wheelSpin']) {
      if (!Number.isFinite(this[key])) this[key] = 0;
    }
  }

  drive(dt, input) {
    this.sanitize();
    const isBike = this.kind === 'bike';
    const topSpeed = isBike ? CONFIG.bikeTopSpeed : CONFIG.carTopSpeed;
    const accel = isBike ? CONFIG.bikeAccel : CONFIG.carAccel;
    const cap = this.spiked ? topSpeed * 0.22 : topSpeed;
    this.throttle = input.forward ? 1 : 0;
    this.brake = input.back ? 1 : 0;
    if (input.forward) this.speed += accel * dt;
    if (input.back) this.speed -= (this.speed > 0.5 ? 27 : 8.5) * dt;
    if (!input.forward && !input.back) {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8.5 * dt);
    }
    this.speed = clampNumber(this.speed, -9.5, cap);
    const speedFactor = safeDivide(Math.abs(this.speed), Math.abs(this.speed) + 6.5, 0);
    const steerWanted = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer += (steerWanted * 0.55 - this.steer) * Math.min(1, dt * 8);
    const turnRate = this.steer * speedFactor * (isBike ? 2.35 : 1.65);
    this.heading += turnRate * dt * Math.sign(this.speed || 1);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    if (isBike) {
      // Lean is a damped spring toward steer*speed — it settles, never spins.
      const leanTarget = clampNumber(-this.steer * speedFactor * 0.6, -0.62, 0.62);
      this.leanVelocity += ((leanTarget - this.lean) * 11 - this.leanVelocity * 6.5) * dt;
      this.lean = clampNumber(this.lean + this.leanVelocity * dt, -0.7, 0.7);
      if (!Number.isFinite(this.lean) || !Number.isFinite(this.leanVelocity)) {
        this.lean = 0;
        this.leanVelocity = 0;
      }
    } else {
      this.lean = 0;
      this.leanVelocity = 0;
    }
    this.wheelSpin += safeDivide(this.speed, 0.37, 0) * dt;
    this.sanitize();
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.set(0, this.heading, this.lean);
    for (const w of this.mesh.userData.wheels || []) {
      if (isBike) w.rotation.y = this.wheelSpin;
      else w.rotation.x = this.wheelSpin;
    }
    this.headlight.intensity = this.headlightOn ? 280 : 0;
  }

  applyColliders(colliders) {
    const pos = { x: this.x, z: this.z };
    resolveCircleCollision(colliders, pos, 1.7);
    if (pos.x !== this.x || pos.z !== this.z) {
      this.x = pos.x;
      this.z = pos.z;
      if (Math.abs(this.speed) > 6) this.speed *= 0.35;
    }
    // Vehicles may use the whole harbour apron and the bridge deck
    // (x up to ~305); the on-foot clamp is tighter and lives in player.js.
    this.x = clampNumber(this.x, -212, 305);
    this.z = clampNumber(this.z, -212, 212);
    this.mesh.position.set(this.x, 0, this.z);
  }

  setHeadlight(on) {
    this.headlightOn = on;
    this.headlight.intensity = on ? 280 : 0;
  }

  distanceTo(x, z) {
    const dx = this.x - x;
    const dz = this.z - z;
    return Math.hypot(dx, dz);
  }
}

export function spawnParkedVehicles(scene) {
  return PARKED_VEHICLES.map((spec) => {
    const v = new Vehicle(spec.kind, spec.model, spec.color, spec.x, spec.z, spec.heading);
    scene.add(v.mesh);
    return v;
  });
}

export function spawnTraffic(scene, count, rngSeed = 1234) {
  const rng = createRng(rngSeed);
  const colors = [0x7f8c8d, 0x2c3e50, 0xc0392b, 0x2980b9, 0xe67e22, 0x16a085, 0xecf0f1, 0x8e44ad, 0xd4ac0d];
  const roads = [];
  for (let c = -176; c <= 176; c += 44) roads.push(c);
  const traffic = [];
  for (let i = 0; i < count; i++) {
    const rx = pick(rng, roads);
    const rz = pick(rng, roads);
    const v = new Vehicle('car', pick(rng, ['sedan', 'sedan', 'hatch', 'pickup', 'van', 'taxi']),
      pick(rng, colors), rx, rz, 0);
    v.traffic = true;
    v.waypoints = [
      { x: rx, z: rz }, { x: rx + 44, z: rz }, { x: rx + 44, z: rz + 44 }, { x: rx, z: rz + 44 },
    ];
    v.mesh.position.set(v.x, 0, v.z);
    scene.add(v.mesh);
    traffic.push(v);
  }
  return traffic;
}

export function updateTraffic(traffic, dt) {
  for (const v of traffic) {
    v.sanitize();
    const wp = v.waypoints[v.waypointIndex % v.waypoints.length];
    const dx = wp.x - v.x;
    const dz = wp.z - v.z;
    if (Math.hypot(dx, dz) < 3.2) {
      v.waypointIndex = (v.waypointIndex + 1) % v.waypoints.length;
      continue;
    }
    const targetHeading = Math.atan2(dx, dz);
    let diff = targetHeading - v.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    v.heading += clampNumber(diff, -1.7 * dt, 1.7 * dt);
    v.speed += (CONFIG.trafficSpeed - v.speed) * Math.min(1, dt * 1.6);
    v.x += Math.sin(v.heading) * v.speed * dt;
    v.z += Math.cos(v.heading) * v.speed * dt;
    v.mesh.position.set(v.x, 0, v.z);
    v.mesh.rotation.y = v.heading;
    v.sanitize();
  }
}
