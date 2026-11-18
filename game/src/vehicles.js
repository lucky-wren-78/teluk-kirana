// vehicles.js — the cars of Teluk Kirana: one merged-mesh factory for every
// kind (sedan, taxi, sport, van and the police Patroli), the arcade driving
// model the player uses, and the traffic system that keeps the streets alive
// on its own.

import * as THREE from '../vendor/three.module.min.js';
import { TUNING } from './config.js';
import { boxPart, coloredMesh, cylinderPart } from './geometry.js';
import { angleDelta, clamp } from './random.js';
import { resolveCollisions } from './world.js';

export const CAR_KINDS = {
  sedan: { name: 'Senja Sedan', maxSpeed: 31, accel: 13, length: 4.5, width: 1.9 },
  taxi: { name: 'Taksi Teluk', maxSpeed: 31, accel: 13, length: 4.5, width: 1.9 },
  sport: { name: 'Kirana Comet GT', maxSpeed: 42, accel: 19, length: 4.4, width: 1.95 },
  van: { name: 'Pelabuhan Box Van', maxSpeed: 26, accel: 10, length: 5.2, width: 2.1 },
  police: { name: 'Patroli Kirana', maxSpeed: 38, accel: 17, length: 4.6, width: 1.95 },
};

export const TRAFFIC_COLORS = [
  0xe2483d, 0xf2b13c, 0x2f7f8f, 0xf3ead8, 0x3f7a4e,
  0x7a4a8f, 0xd96c2c, 0x4a6fa5, 0xb8b0a0, 0x22262c,
];

// Builds one car as a single vertex-coloured mesh (plus a flashing light bar
// for police). The car faces +Z; heading 0 therefore drives toward +Z (south).
export function buildCarMesh(kind, colorHex) {
  const spec = CAR_KINDS[kind];
  const L = spec.length;
  const W = spec.width;
  const dark = 0x1d2126;
  const glass = 0x223844;
  const parts = [
    boxPart(W, 0.55, L, colorHex, 0, 0.55, 0),
    boxPart(W * 0.92, 0.28, L * 0.94, colorHex, 0, 0.28, 0),
  ];
  if (kind === 'van') {
    parts.push(boxPart(W * 0.96, 1.15, L * 0.72, 0xe8e2d4, 0, 1.35, -L * 0.08));
    parts.push(boxPart(W * 0.8, 0.6, 0.3, glass, 0, 1.05, L * 0.36));
  } else if (kind === 'sport') {
    parts.push(boxPart(W * 0.78, 0.42, L * 0.44, glass, 0, 0.98, -L * 0.05));
    parts.push(boxPart(W * 0.9, 0.1, 0.5, dark, 0, 1.02, -L * 0.46));
    parts.push(boxPart(0.14, 0.3, 0.3, dark, -W * 0.36, 0.8, -L * 0.46));
    parts.push(boxPart(0.14, 0.3, 0.3, dark, W * 0.36, 0.8, -L * 0.46));
    parts.push(boxPart(W * 0.7, 0.16, 0.8, colorHex, 0, 0.42, L * 0.44));
  } else {
    parts.push(boxPart(W * 0.8, 0.5, L * 0.46, glass, 0, 1.02, -L * 0.03));
    parts.push(boxPart(W * 0.84, 0.12, L * 0.5, colorHex, 0, 1.3, -L * 0.03));
  }
  if (kind === 'taxi') parts.push(boxPart(0.7, 0.22, 0.34, 0xffd23e, 0, 1.47, -L * 0.03));
  if (kind === 'police') {
    parts.push(boxPart(W * 0.99, 0.2, L * 0.4, 0x2f5fb3, 0, 0.62, 0.1));
    parts.push(boxPart(W * 0.6, 0.13, L * 0.7, 0x2f5fb3, 0, 0.3, 0));
  }
  // Wheels + lights.
  const wheelSpots = [
    [-W / 2, L * 0.32], [W / 2, L * 0.32], [-W / 2, -L * 0.32], [W / 2, -L * 0.32],
  ];
  for (const [wx, wz] of wheelSpots) {
    parts.push(cylinderPart(0.36, 0.36, 0.24, 10, dark, wx, 0.36, wz, 0, 0, Math.PI / 2));
  }
  parts.push(boxPart(0.34, 0.14, 0.06, 0xfff3b0, -W * 0.3, 0.62, L / 2 + 0.01));
  parts.push(boxPart(0.34, 0.14, 0.06, 0xfff3b0, W * 0.3, 0.62, L / 2 + 0.01));
  parts.push(boxPart(0.34, 0.12, 0.06, 0xd92c1e, -W * 0.3, 0.62, -L / 2 - 0.01));
  parts.push(boxPart(0.34, 0.12, 0.06, 0xd92c1e, W * 0.3, 0.62, -L / 2 - 0.01));
  const group = new THREE.Group();
  group.add(coloredMesh(parts));
  if (kind === 'police') {
    const barRed = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2a1e }),
    );
    barRed.position.set(-0.3, 1.42, -L * 0.03);
    const barBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.16, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2a6bff }),
    );
    barBlue.position.set(0.3, 1.42, -L * 0.03);
    group.add(barRed);
    group.add(barBlue);
    group.userData.lightRed = barRed;
    group.userData.lightBlue = barBlue;
  }
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return group;
}

let vehicleSeq = 1;

export function createVehicle(scene, kind, colorHex, x, z, heading) {
  const spec = CAR_KINDS[kind];
  const mesh = buildCarMesh(kind, colorHex);
  mesh.position.set(x, 0.05, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    id: vehicleSeq++,
    kind,
    name: spec.name,
    mesh,
    heading,
    speed: 0,
    maxSpeed: spec.maxSpeed,
    accel: spec.accel,
    health: 100,
    parked: false,
    driver: null, // null | 'traffic' | 'player' | 'police' | 'posed'
    ai: null,
    stuckTime: 0,
    get x() { return mesh.position.x; },
    get z() { return mesh.position.z; },
  };
}

export function syncVehicleMesh(vehicle) {
  vehicle.mesh.position.y = 0.05;
  vehicle.mesh.rotation.y = vehicle.heading;
}

// The arcade driving model shared by the player (input-driven) and, in a
// looser form, by the police. Returns the impact speed of any hard collision
// this step.
export function driveVehicle(vehicle, throttle, steer, handbrake, dt, colliders, others) {
  const spec = CAR_KINDS[vehicle.kind];
  if (throttle > 0) {
    vehicle.speed += spec.accel * throttle * dt * (vehicle.speed < 0 ? 2.2 : 1);
  } else if (throttle < 0) {
    if (vehicle.speed > 0.5) vehicle.speed += spec.accel * 2.4 * throttle * dt;
    else vehicle.speed += spec.accel * 0.55 * throttle * dt;
  }
  const drag = handbrake ? 2.6 : 0.55;
  vehicle.speed -= vehicle.speed * drag * dt;
  if (!throttle) {
    vehicle.speed -= Math.sign(vehicle.speed) * Math.min(Math.abs(vehicle.speed), 3.2 * dt);
  }
  vehicle.speed = clamp(vehicle.speed, -11, spec.maxSpeed);
  const speedRatio = clamp(Math.abs(vehicle.speed) / spec.maxSpeed, 0, 1);
  const steerAuthority = (1 - speedRatio * 0.52) * (handbrake ? 1.5 : 1);
  const steerGain = clamp(Math.abs(vehicle.speed) / 6, 0, 1);
  vehicle.heading += steer * steerAuthority * 1.65 * dt * (vehicle.speed >= 0 ? 1 : -1) * steerGain;
  const fx = Math.sin(vehicle.heading);
  const fz = Math.cos(vehicle.heading);
  vehicle.mesh.position.x += fx * vehicle.speed * dt;
  vehicle.mesh.position.z += fz * vehicle.speed * dt;
  let impact = 0;
  const before = Math.abs(vehicle.speed);
  const pos = vehicle.mesh.position;
  const px = pos.x;
  const pz = pos.z;
  resolveCollisions(pos, TUNING.carRadius, colliders);
  if (Math.abs(pos.x - px) > 0.01 || Math.abs(pos.z - pz) > 0.01) {
    if (before > 7) impact = before;
    vehicle.speed *= 0.45;
  }
  // Car-to-car: soft push apart, momentum shared.
  for (const other of others) {
    if (other === vehicle) continue;
    const dx = pos.x - other.mesh.position.x;
    const dz = pos.z - other.mesh.position.z;
    const d2 = dx * dx + dz * dz;
    const minD = 3.6;
    if (d2 < minD * minD && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      const push = (minD - d) / 2;
      pos.x += (dx / d) * push;
      pos.z += (dz / d) * push;
      other.mesh.position.x -= (dx / d) * push;
      other.mesh.position.z -= (dz / d) * push;
      if (before > 8) impact = Math.max(impact, before * 0.8);
      vehicle.speed *= 0.6;
      if (other.driver === 'traffic') other.speed = Math.min(other.speed ?? 0, 2);
    }
  }
  syncVehicleMesh(vehicle);
  return impact;
}

// ---------------------------------------------------------------------------
// Traffic: cars that follow the street grid, keep to the right-hand lane,
// turn at intersections and brake for whatever is ahead of them.
// ---------------------------------------------------------------------------

const STREET_LINES = [];
for (let v = -240; v <= 240; v += 60) STREET_LINES.push(v);

// Right-hand traffic: the lane sits to the driver's right of the centre line.
function laneOffsetFor(axis, dir) {
  if (axis === 'x') return dir > 0 ? 4.2 : -4.2;
  return dir > 0 ? -4.2 : 4.2;
}

function headingFor(axis, dir) {
  if (axis === 'x') return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  return dir > 0 ? 0 : Math.PI;
}

function spawnTrafficCar(scene, rng, vehicles) {
  const axis = rng.chance(0.5) ? 'x' : 'z';
  const dir = rng.chance(0.5) ? 1 : -1;
  const line = rng.pick(STREET_LINES);
  const along = rng.range(-250, 250);
  const off = laneOffsetFor(axis, dir);
  const x = axis === 'x' ? along : line + off;
  const z = axis === 'x' ? line + off : along;
  const kind = rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'van', 'sport']);
  const car = createVehicle(scene, kind, kind === 'taxi' ? 0xffd23e : rng.pick(TRAFFIC_COLORS), x, z, 0);
  car.driver = 'traffic';
  car.speed = TUNING.trafficSpeed * rng.range(0.8, 1.1);
  car.ai = { axis, dir, line, mode: 'leg', target: null, cruise: car.speed };
  car.heading = headingFor(axis, dir);
  syncVehicleMesh(car);
  vehicles.push(car);
  return car;
}

export function createTrafficSystem(scene, rng, count) {
  const vehicles = [];
  for (let i = 0; i < count; i++) spawnTrafficCar(scene, rng, vehicles);
  return { vehicles, scene, rng };
}

function trafficAheadBlocked(car, allVehicles, playerVehicle) {
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  const check = (other) => {
    if (other === car) return false;
    const dx = other.mesh.position.x - car.mesh.position.x;
    const dz = other.mesh.position.z - car.mesh.position.z;
    const ahead = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    return ahead > 0.5 && ahead < 10.5 && side < 2.7;
  };
  for (const other of allVehicles) if (check(other)) return true;
  if (playerVehicle && check(playerVehicle)) return true;
  return false;
}

export function updateTraffic(system, dt, allVehicles, playerVehicle, colliders) {
  const { vehicles, rng } = system;
  for (const car of vehicles) {
    if (car.driver !== 'traffic') continue;
    const ai = car.ai;
    const blocked = trafficAheadBlocked(car, allVehicles, playerVehicle);
    const targetSpeed = blocked ? 0 : ai.cruise;
    car.speed += clamp(targetSpeed - car.speed, -22 * dt, 7 * dt);
    if (ai.mode === 'leg') {
      const along = ai.axis === 'x' ? car.mesh.position.x : car.mesh.position.z;
      const step = ai.dir * car.speed * dt;
      if (ai.axis === 'x') car.mesh.position.x += step;
      else car.mesh.position.z += step;
      const nextIntersection = ai.dir > 0
        ? (Math.floor(along / 60) + 1) * 60
        : (Math.ceil(along / 60) - 1) * 60;
      if ((ai.dir > 0 && along + step >= nextIntersection) || (ai.dir < 0 && along + step <= nextIntersection)) {
        decideTurn(car, nextIntersection, rng);
      }
      if (Math.abs(along) > 262) recycleTrafficCar(car, rng);
    } else {
      // Turning toward the exit point of the intersection.
      const t = ai.target;
      const dx = t.x - car.mesh.position.x;
      const dz = t.z - car.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      const move = Math.min(dist, car.speed * dt);
      if (dist > 0.05) {
        car.mesh.position.x += (dx / dist) * move;
        car.mesh.position.z += (dz / dist) * move;
        const want = Math.atan2(dx, dz);
        car.heading += clamp(angleDelta(car.heading, want), -2.6 * dt, 2.6 * dt);
      }
      if (dist < 2.4) {
        car.ai = { axis: t.axis, dir: t.dir, line: t.line, mode: 'leg', target: null, cruise: ai.cruise };
        car.heading = headingFor(t.axis, t.dir);
        const off = laneOffsetFor(t.axis, t.dir);
        if (t.axis === 'x') car.mesh.position.z = t.line + off;
        else car.mesh.position.x = t.line + off;
      }
    }
    resolveCollisions(car.mesh.position, 2.0, colliders);
    syncVehicleMesh(car);
  }
}

function decideTurn(car, intersection, rng) {
  const ai = car.ai;
  const roll = rng.next();
  if (roll < 0.55) return; // straight on: stay in leg mode
  const left = roll < 0.775;
  // The intersection centre: one coordinate is the cross street we reached,
  // the other is the street we are travelling on.
  const cx = ai.axis === 'x' ? intersection : ai.line;
  const cz = ai.axis === 'x' ? ai.line : intersection;
  // Current forward vector; left of (fx, fz) is (fz, -fx), right is (-fz, fx).
  const fx = ai.axis === 'x' ? ai.dir : 0;
  const fz = ai.axis === 'z' ? ai.dir : 0;
  const nfx = left ? fz : -fz;
  const nfz = left ? -fx : fx;
  const newAxis = nfx !== 0 ? 'x' : 'z';
  const newDir = nfx !== 0 ? nfx : nfz;
  const newLine = newAxis === 'x' ? cz : cx; // the street we turn onto
  const off = laneOffsetFor(newAxis, newDir);
  const exit = {
    x: newAxis === 'x' ? cx + newDir * 15 : newLine + off,
    z: newAxis === 'x' ? newLine + off : cz + newDir * 15,
    axis: newAxis,
    dir: newDir,
    line: newLine,
  };
  car.ai = { ...ai, mode: 'turn', target: exit };
}

function recycleTrafficCar(car, rng) {
  const ai = car.ai;
  if (ai.axis === 'x') car.mesh.position.x = -Math.sign(car.mesh.position.x) * 255;
  else car.mesh.position.z = -Math.sign(car.mesh.position.z) * 255;
  car.speed = ai.cruise;
}

// Parked cars along the kerbs: the raw material of carjacking.
export function spawnParkedCars(scene, rng, count) {
  const parked = [];
  const kinds = ['sedan', 'sedan', 'sport', 'van', 'taxi', 'sedan'];
  for (let i = 0; i < count; i++) {
    const vertical = rng.chance(0.5);
    const line = rng.pick(STREET_LINES);
    const side = rng.chance(0.5) ? 6.9 : -6.9;
    const along = rng.range(-245, 245);
    const x = vertical ? line + side : along;
    const z = vertical ? along : line + side;
    const kind = rng.pick(kinds);
    const heading = vertical ? (side > 0 ? 0 : Math.PI) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    const car = createVehicle(scene, kind, kind === 'taxi' ? 0xffd23e : rng.pick(TRAFFIC_COLORS), x, z, heading);
    car.parked = true;
    parked.push(car);
  }
  // One guaranteed Comet GT parked on the Palm Heights kerb for job 2.
  const comet = createVehicle(scene, 'sport', 0xd92c6e, -150, -180 + 6.9, Math.PI / 2);
  comet.parked = true;
  comet.isJobCar = true;
  parked.push(comet);
  return parked;
}
