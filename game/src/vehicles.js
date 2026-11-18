// Teluk Kirana — vehicles: drivable cars and motorbikes, traffic AI, carjacking.
// Bug #1 fix: every physics field is initialised to a finite number, every
// division is guarded, and update() re-sanitises state so no NaN can survive
// a frame. Bug #6 fix: the two vehicles nearest PLAYER_SPAWN are parked
// inside E-interaction range by construction (see config PARKED_VEHICLES).
import * as THREE from 'three';
import { CONFIG, PARKED_VEHICLES, clampNumber, safeDivide } from './config.js';
import { createRng, range, pick } from './rng.js';
import { resolveCircleCollision } from './city.js';

function bodyMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
}
const glassMat = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.7 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.25, metalness: 0.8 });

function makeWheel() {
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12), tireMat);
  wheel.rotation.z = Math.PI / 2;
  wheel.castShadow = true;
  return wheel;
}

export function makeCarMesh(color, model = 'sedan') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat(color));
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabinH = model === 'van' ? 1.0 : 0.55;
  const cabinL = model === 'van' ? 3.6 : 2.2;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, cabinH, cabinL), glassMat);
  cabin.position.set(0, 1.15 + (model === 'van' ? 0.2 : 0), model === 'pickup' ? -0.9 : -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  if (model === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.35, 1.6), bodyMat(color));
    bed.position.set(0, 0.95, 1.3);
    g.add(bed);
  }
  if (model === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xf2b705, emissive: 0xf2b705, emissiveIntensity: 0.8 }));
    sign.position.set(0, 1.62, -0.2);
    g.add(sign);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffee88, emissiveIntensity: 1.6 });
  for (const s of [-0.62, 0.62]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    lamp.position.set(s, 0.66, 2.22);
    g.add(lamp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0xcc0000, emissiveIntensity: 0.9 }));
    tail.position.set(s, 0.66, -2.22);
    g.add(tail);
  }
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = makeWheel();
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

export function makeBikeMesh(color) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.1), bodyMat(color));
  frame.position.y = 0.75;
  frame.castShadow = true;
  g.add(frame);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.8), chromeMat);
  tank.position.set(0, 1.05, 0.25);
  g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 }));
  seat.position.set(0, 1.02, -0.55);
  g.add(seat);
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), chromeMat);
  bars.rotation.z = Math.PI / 2;
  bars.position.set(0, 1.15, 0.95);
  g.add(bars);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffee88, emissiveIntensity: 1.8 }));
  head.position.set(0, 0.85, 1.08);
  g.add(head);
  const wheels = [];
  for (const wz of [0.95, -0.95]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.11, 8, 18), tireMat);
    w.position.set(0, 0.36, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Vehicle {
  constructor(kind, model, color, x, z, heading) {
    // All physics state initialised to finite numbers — never undefined, never NaN.
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
    // Headlight: created here but NOT added to the mesh. A real SpotLight on
    // every vehicle would put 20+ spotlights into every material's shader and
    // make every fragment pay for all of them — so the light is attached only
    // to the vehicle the player is driving (see attachHeadlight).
    this.headlight = new THREE.SpotLight(0xfff2c0, 0, 55, 0.55, 0.45, 1.2);
    this.headlight.position.set(0, 0.9, 2.1);
    this.headlightTarget = new THREE.Object3D();
    this.headlightTarget.position.set(0, 0, 22);
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
    for (const key of ['x', 'z', 'heading', 'speed', 'steer', 'lean', 'leanVelocity', 'wheelSpin', 'throttle', 'brake']) {
      if (!Number.isFinite(this[key])) this[key] = 0;
    }
  }

  // input: {forward, back, left, right} booleans. dt is a fixed step.
  drive(dt, input) {
    this.sanitize();
    const top = this.kind === 'bike' ? CONFIG.bikeTopSpeed : CONFIG.carTopSpeed;
    const accel = this.kind === 'bike' ? CONFIG.bikeAccel : CONFIG.carAccel;
    const maxSpeed = this.spiked ? top * 0.25 : top;
    this.throttle = input.forward ? 1 : 0;
    this.brake = input.back ? 1 : 0;
    if (input.forward) this.speed += accel * dt;
    if (input.back) this.speed -= (this.speed > 0.5 ? 26 : 8) * dt;
    if (!input.forward && !input.back) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt);
    this.speed = clampNumber(this.speed, -9, maxSpeed);
    // Steering authority grows with speed but never divides by zero.
    const speedFactor = safeDivide(Math.abs(this.speed), Math.abs(this.speed) + 6, 0);
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer += (steerTarget * 0.55 - this.steer) * Math.min(1, dt * 8);
    const turnRate = this.steer * speedFactor * (this.kind === 'bike' ? 2.3 : 1.7);
    this.heading += turnRate * dt * Math.sign(this.speed || 1);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    // Motorbike lean: spring toward a target set by steering and speed, critically damped.
    if (this.kind === 'bike') {
      const leanTarget = clampNumber(-this.steer * speedFactor * 0.55, -0.6, 0.6);
      this.leanVelocity += (leanTarget - this.lean) * 10 * dt - this.leanVelocity * 6 * dt;
      this.lean += this.leanVelocity * dt;
      this.lean = clampNumber(this.lean, -0.7, 0.7);
      if (!Number.isFinite(this.lean) || !Number.isFinite(this.leanVelocity)) {
        this.lean = 0;
        this.leanVelocity = 0;
      }
    } else {
      this.lean = 0;
      this.leanVelocity = 0;
    }
    this.wheelSpin += safeDivide(this.speed, 0.36, 0) * dt;
    this.sanitize();
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.set(0, this.heading, this.lean);
    const wheels = this.mesh.userData.wheels || [];
    for (const w of wheels) {
      if (this.kind === 'bike') w.rotation.y = this.wheelSpin;
      else w.rotation.x = this.wheelSpin;
    }
    this.headlight.intensity = this.headlightOn ? 260 : 0;
  }

  applyColliders(colliders) {
    const pos = { x: this.x, z: this.z };
    resolveCircleCollision(colliders, pos, 1.7);
    if (pos.x !== this.x || pos.z !== this.z) {
      this.x = pos.x;
      this.z = pos.z;
      if (Math.abs(this.speed) > 6) this.speed *= 0.4;
    }
    this.x = clampNumber(this.x, -212, 218);
    this.z = clampNumber(this.z, -212, 212);
    this.mesh.position.set(this.x, 0, this.z);
  }

  setHeadlight(on) {
    this.headlightOn = on;
    this.headlight.intensity = on ? 260 : 0;
  }

  distanceTo(x, z) {
    const dx = this.x - x;
    const dz = this.z - z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}

export function spawnParkedVehicles(scene) {
  const vehicles = [];
  for (const spec of PARKED_VEHICLES) {
    const v = new Vehicle(spec.kind, spec.model, spec.color, spec.x, spec.z, spec.heading);
    scene.add(v.mesh);
    vehicles.push(v);
  }
  return vehicles;
}

export function spawnTraffic(scene, count, rngSeed = 77) {
  const rng = createRng(rngSeed);
  const colors = [0x7f8c8d, 0x2c3e50, 0xc0392b, 0x2980b9, 0xe67e22, 0x16a085, 0xecf0f1, 0x8e44ad];
  const traffic = [];
  const roads = [];
  for (let c = -176; c <= 176; c += 44) roads.push(c);
  for (let i = 0; i < count; i++) {
    const v = new Vehicle('car', pick(rng, ['sedan', 'sedan', 'pickup', 'van']), pick(rng, colors),
      range(rng, -180, 180), range(rng, -180, 180), range(rng, 0, Math.PI * 2));
    v.traffic = true;
    // rectangular loop on the road grid
    const rx = pick(rng, roads);
    const rz = pick(rng, roads);
    const half = 44;
    v.waypoints = [
      { x: rx, z: rz }, { x: rx + half, z: rz }, { x: rx + half, z: rz + half }, { x: rx, z: rz + half },
    ];
    v.x = rx;
    v.z = rz;
    v.mesh.position.set(v.x, 0, v.z);
    scene.add(v.mesh);
    traffic.push(v);
  }
  return traffic;
}

export function updateTraffic(traffic, dt, colliders) {
  for (const v of traffic) {
    v.sanitize();
    const wp = v.waypoints[v.waypointIndex % v.waypoints.length];
    const dx = wp.x - v.x;
    const dz = wp.z - v.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 3) {
      v.waypointIndex = (v.waypointIndex + 1) % v.waypoints.length;
      continue;
    }
    const targetHeading = Math.atan2(dx, dz);
    let diff = targetHeading - v.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    v.heading += clampNumber(diff, -1.6 * dt, 1.6 * dt);
    v.speed += (CONFIG.trafficSpeed - v.speed) * Math.min(1, dt * 1.5);
    v.x += Math.sin(v.heading) * v.speed * dt;
    v.z += Math.cos(v.heading) * v.speed * dt;
    v.mesh.position.set(v.x, 0, v.z);
    v.mesh.rotation.y = v.heading;
    v.sanitize();
  }
}
