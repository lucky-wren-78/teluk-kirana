// vehicles.js — cars and motorbikes: meshes, arcade physics, AI traffic.
// Cars are roomy and stable; motorbikes are a separate, twitchier class —
// quicker steering, higher top speed, and a visible lean into corners.

import * as THREE from 'three';
import { ROAD_LINES, CITY } from './config.js';
import { clamp, lerpAngle } from './rng.js';
import { resolveCollisions } from './city.js';

export const VEHICLE_SPECS = {
  car:   { maxSpeed: 33, reverseSpeed: 9, accel: 15, brake: 30, turnRate: 1.55, width: 1.9, length: 4.3, grip: 7 },
  motor: { maxSpeed: 39, reverseSpeed: 6, accel: 21, brake: 34, turnRate: 2.5, width: 0.8, length: 2.2, grip: 9 },
  police:{ maxSpeed: 36, reverseSpeed: 9, accel: 18, brake: 32, turnRate: 1.8, width: 1.9, length: 4.4, grip: 8 },
};

const CAR_COLOURS = [0xd94f38, 0x2e7d9e, 0xe0a83a, 0x4a9e57, 0xd9d3c3, 0x7a4a9e, 0x38b8a8, 0xc0c6cc];

function wheelMesh(radius, width) {
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, width, 10),
    new THREE.MeshLambertMaterial({ color: 0x17181a })
  );
  wheel.rotation.z = Math.PI / 2;
  return wheel;
}

// Build the visible mesh for a vehicle kind. Returns a group whose forward is
// +X when rotation.y = -heading (three.js convention used across the game:
// heading 0 faces +X, and group.rotation.y = -heading).
export function buildVehicleMesh(kind, colour) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colour });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2f3d });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0x665f43 });
  const parts = { wheels: [], headlightMat, body: null, leanPart: null };

  if (kind === 'motor') {
    const frame = new THREE.Group();
    const tank = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.42, 0.42), paint);
    tank.position.y = 0.72;
    frame.add(tank);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.36), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    seat.position.set(-0.55, 0.82, 0);
    frame.add(seat);
    const rider = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.4), new THREE.MeshLambertMaterial({ color: 0x30455c }));
    torso.position.y = 0.55;
    rider.add(torso);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 7), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    helmet.position.set(0.05, 1.1, 0);
    rider.add(helmet);
    rider.position.set(-0.25, 0.85, 0);
    rider.rotation.z = -0.25;
    frame.add(rider);
    group.add(frame);
    parts.leanPart = frame;
    for (const wx of [0.78, -0.78]) {
      const wheel = wheelMesh(0.34, 0.12);
      wheel.position.set(wx, 0.34, 0);
      group.add(wheel);
      parts.wheels.push(wheel);
    }
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.24), headlightMat);
    lamp.position.set(0.95, 0.78, 0);
    group.add(lamp);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.72, 1.9), paint);
    body.position.y = 0.62;
    group.add(body);
    parts.body = body;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 1.7), glass);
    cabin.position.set(-0.15, 1.24, 0);
    group.add(cabin);
    for (const [wx, wz] of [[1.45, 0.95], [1.45, -0.95], [-1.45, 0.95], [-1.45, -0.95]]) {
      const wheel = wheelMesh(0.38, 0.24);
      wheel.position.set(wx, 0.38, wz);
      group.add(wheel);
      parts.wheels.push(wheel);
    }
    for (const wz of [0.6, -0.6]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.34), headlightMat);
      lamp.position.set(2.16, 0.72, wz);
      group.add(lamp);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.34), new THREE.MeshBasicMaterial({ color: 0x7a1d12 }));
      tail.position.set(-2.16, 0.74, wz);
      group.add(tail);
    }
    if (kind === 'police') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 1.2), new THREE.MeshBasicMaterial({ color: 0x2244cc }));
      bar.position.set(-0.15, 1.66, 0);
      group.add(bar);
      parts.lightBar = bar;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.32, 0.2, 1.92), new THREE.MeshLambertMaterial({ color: 0x2244cc }));
      stripe.position.y = 0.66;
      group.add(stripe);
    }
  }
  group.userData.parts = parts;
  return group;
}

export class Vehicle {
  constructor(scene, kind, colour, x, z, heading) {
    this.kind = kind;
    this.spec = VEHICLE_SPECS[kind === 'police' ? 'police' : kind];
    this.mesh = buildVehicleMesh(kind, colour);
    this.mesh.position.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.driver = null;      // 'player' | 'traffic' | 'police' | null (parked)
    this.spikeSlowTimer = 0; // roadblock spike strips bite through this
    scene.add(this.mesh);
    this.syncMesh(0);
  }

  get pos() { return this.mesh.position; }

  // Arcade drive step. throttle -1..1, steer -1..1 (left positive).
  drive(dt, throttle, steer, colliders) {
    const spec = this.spec;
    const slowFactor = this.spikeSlowTimer > 0 ? 0.35 : 1;
    this.spikeSlowTimer = Math.max(0, this.spikeSlowTimer - dt);
    const topSpeed = spec.maxSpeed * slowFactor;
    if (throttle > 0) this.speed += spec.accel * throttle * dt * (1 - Math.max(0, this.speed) / (topSpeed + 6));
    else if (throttle < 0) {
      if (this.speed > 0.6) this.speed -= spec.brake * dt;
      else this.speed = Math.max(-spec.reverseSpeed, this.speed + spec.accel * throttle * dt);
    } else {
      this.speed -= this.speed * 0.55 * dt; // engine drag
      if (Math.abs(this.speed) < 0.05) this.speed = 0;
    }
    this.speed = clamp(this.speed, -spec.reverseSpeed, topSpeed);
    const steerAuthority = clamp(Math.abs(this.speed) / 6, 0, 1) * (this.speed < 0 ? -1 : 1);
    this.steer = steer;
    this.heading += steer * spec.turnRate * steerAuthority * dt * clamp(Math.abs(this.speed) / 10, 0.25, 1);
    const step = {
      x: this.pos.x + Math.cos(this.heading) * this.speed * dt,
      z: this.pos.z + Math.sin(this.heading) * this.speed * dt,
    };
    if (colliders) {
      const before = { x: step.x, z: step.z };
      resolveCollisions(step, spec.width * 0.62, colliders);
      if (Math.abs(step.x - before.x) > 0.01 || Math.abs(step.z - before.z) > 0.01) {
        this.speed *= 0.45; // kissed a wall
        this.health = Math.max(0, this.health - Math.abs(this.speed) * 0.12);
      }
    }
    this.pos.x = step.x;
    this.pos.z = step.z;
    this.syncMesh(dt);
  }

  syncMesh(dt) {
    this.mesh.position.y = 0;
    this.mesh.rotation.y = -this.heading;
    const parts = this.mesh.userData.parts;
    for (const wheel of parts.wheels) wheel.rotation.x += (this.speed * (dt || 0)) / 0.38;
    if (parts.leanPart) {
      const targetLean = clamp(-this.steer * clamp(Math.abs(this.speed) / 18, 0, 1) * 0.5, -0.55, 0.55);
      parts.leanPart.rotation.x += (targetLean - parts.leanPart.rotation.x) * 0.18;
    }
    if (parts.lightBar) {
      const flash = Math.floor(performance.now() / 280) % 2 === 0;
      parts.lightBar.material.color.setHex(flash ? 0x3366ff : 0xff3333);
    }
  }

  setHeadlights(on) {
    this.mesh.userData.parts.headlightMat.color.setHex(on ? 0xffe9a8 : 0x665f43);
  }
}

// --- AI traffic -------------------------------------------------------------
// Each traffic vehicle patrols the grid: it follows its current road line and,
// at intersections, sometimes turns onto the crossing road.
class TrafficDriver {
  constructor(vehicle, rng) {
    this.vehicle = vehicle;
    this.rng = rng;
    this.axis = rng.chance(0.5) ? 'x' : 'z';
    this.laneSign = rng.chance(0.5) ? 1 : -1;
    this.cruise = rng.range(8, 13.5);
    this.snapToRoad();
  }

  snapToRoad() {
    const v = this.vehicle;
    const nearest = (value) => ROAD_LINES.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
    if (this.axis === 'x') {
      v.pos.z = nearest(v.pos.z) + this.laneSign * 2.6;
      v.heading = this.laneSign > 0 ? 0 : Math.PI;
      // right-hand traffic: heading +x keeps the lane on the south side
      v.heading = v.pos.z % 2 === 0 ? v.heading : v.heading;
    } else {
      v.pos.x = nearest(v.pos.x) + this.laneSign * 2.6;
      v.heading = this.laneSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    v.syncMesh(0);
  }

  update(dt, others, colliders) {
    const v = this.vehicle;
    // Slow down for a vehicle ahead in the same lane.
    let throttle = 0.55;
    for (const other of others) {
      if (other === v) continue;
      const dx = other.pos.x - v.pos.x;
      const dz = other.pos.z - v.pos.z;
      const ahead = dx * Math.cos(v.heading) + dz * Math.sin(v.heading);
      const side = -dx * Math.sin(v.heading) + dz * Math.cos(v.heading);
      if (ahead > 0 && ahead < 9 && Math.abs(side) < 1.8) { throttle = ahead < 5 ? -0.4 : 0.05; break; }
    }
    if (v.speed < this.cruise) throttle = Math.max(throttle, 0.5);
    else throttle = Math.min(throttle, 0);

    // Near an intersection along our axis, maybe turn.
    const along = this.axis === 'x' ? v.pos.x : v.pos.z;
    const cross = this.axis === 'x' ? v.pos.z : v.pos.x;
    for (const line of ROAD_LINES) {
      if (Math.abs(along - line) < 1.2 && Math.abs(cross - line) < CITY.roadWidth) {
        if (this.rng.chance(0.4)) {
          this.axis = this.axis === 'x' ? 'z' : 'x';
          this.laneSign = this.rng.chance(0.5) ? 1 : -1;
          if (this.axis === 'x') { v.pos.z = line + this.laneSign * 2.6; }
          else { v.pos.x = line + this.laneSign * 2.6; }
        }
        break;
      }
    }
    // Steer back toward the lane centreline.
    const laneCentre = this.axis === 'x'
      ? Math.round((cross - this.laneSign * 2.6) / 1) // placeholder, refined below
      : 0;
    void laneCentre;
    const desired = this.axis === 'x'
      ? (this.headingTargetX(v))
      : (this.headingTargetZ(v));
    let steer = clamp((desired - v.heading) * 2.2, -0.7, 0.7);
    if (Math.abs(Math.sin(v.heading)) < 0.05 && this.axis === 'z') steer = clamp((desired - v.heading) * 2.2, -0.7, 0.7);
    v.drive(dt, throttle, steer, null);
    // Keep traffic out of buildings: nudge back to the road if it drifted.
    if (Math.abs(v.speed) > 0) {
      const nearest = (value) => ROAD_LINES.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
      if (this.axis === 'x') v.pos.z += (nearest(v.pos.z - this.laneSign * 2.6) + this.laneSign * 2.6 - v.pos.z) * 0.04;
      else v.pos.x += (nearest(v.pos.x - this.laneSign * 2.6) + this.laneSign * 2.6 - v.pos.x) * 0.04;
    }
    void colliders;
  }

  headingTargetX(v) {
    const dir = Math.cos(v.heading) >= 0 ? 0 : Math.PI;
    return dir;
  }
  headingTargetZ(v) {
    return Math.sin(v.heading) >= 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}

export function createTraffic(scene, rng, count, colliders) {
  const vehicles = [];
  const drivers = [];
  for (let i = 0; i < count; i++) {
    const kind = rng.chance(0.22) ? 'motor' : 'car';
    const lineX = rng.pick(ROAD_LINES);
    const lineZ = rng.pick(ROAD_LINES);
    const alongX = rng.chance(0.5);
    const x = alongX ? rng.range(-CITY.halfSize + 20, CITY.halfSize - 20) : lineX + (rng.chance(0.5) ? 2.6 : -2.6);
    const z = alongX ? lineZ + (rng.chance(0.5) ? 2.6 : -2.6) : rng.range(-CITY.halfSize + 20, CITY.halfSize - 20);
    const vehicle = new Vehicle(scene, kind, rng.pick(CAR_COLOURS), x, z, 0);
    vehicle.driver = 'traffic';
    vehicles.push(vehicle);
    drivers.push(new TrafficDriver(vehicle, rng));
  }
  return {
    vehicles,
    update(dt) {
      for (const driver of drivers) {
        if (driver.vehicle.driver === 'traffic') driver.update(dt, vehicles, colliders);
      }
    },
  };
}

// Parked vehicles along kerbs — the carjacking buffet.
export function createParkedVehicles(scene, rng, count) {
  const parked = [];
  for (let i = 0; i < count; i++) {
    const kind = rng.chance(0.3) ? 'motor' : 'car';
    const vertical = rng.chance(0.5);
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(-CITY.halfSize + 24, CITY.halfSize - 24);
    const side = rng.chance(0.5) ? 4.6 : -4.6;
    const x = vertical ? line + side : along;
    const z = vertical ? along : line + side;
    const heading = vertical ? Math.PI / 2 : 0;
    const vehicle = new Vehicle(scene, kind, rng.pick(CAR_COLOURS), x, z, heading + (rng.chance(0.5) ? 0 : Math.PI));
    parked.push(vehicle);
  }
  return parked;
}

export { lerpAngle };
