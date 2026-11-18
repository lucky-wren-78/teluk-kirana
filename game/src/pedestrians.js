// pedestrians.js - citizens of Teluk Kirana walking the sidewalks.
// Each pedestrian walks between waypoints along the block edges,
// wears a random bright shirt, and runs away when danger is near:
// a gunshot, a fast car, or a crash.

import * as THREE from 'three';
import { GRID, PITCH, CITY_HALF, gridToWorld, SHIRT_COLORS, WORLD_EDGE } from './config.js';
import { clamp, turnToward, distance2d } from './rng.js';
import { pointBlocked } from './city.js';

const skinTones = [0xe8b88a, 0xc98a5e, 0x9a6544, 0x7a4a2e, 0xf2c9a0];

// Build one simple pedestrian figure.
export function buildPedMesh(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRT_COLORS) });
  const skin = new THREE.MeshLambertMaterial({ color: rng.pick(skinTones) });
  const pants = new THREE.MeshLambertMaterial({ color: rng.pick([0x2c3e50, 0x5a4632, 0x37474f, 0x6d4c41]) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.3), shirt);
  torso.position.y = 1.06;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 7), skin);
  head.position.y = 1.6;
  group.add(head);
  const limbs = [];
  for (const sx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.2), pants);
    leg.position.set(sx, 0.36, 0);
    group.add(leg);
    limbs.push(leg);
  }
  for (const sx of [-0.36, 0.36]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.56, 0.15), shirt);
    arm.position.set(sx, 1.06, 0);
    group.add(arm);
    limbs.push(arm);
  }
  group.userData.limbs = limbs;
  return group;
}

// A sidewalk waypoint: a corner of a block, offset onto the pavement.
function randomWaypoint(rng) {
  const gx = rng.int(0, GRID - 2);
  const gz = rng.int(0, GRID - 2);
  const cx = gridToWorld(gx) + PITCH / 2;
  const cz = gridToWorld(gz) + PITCH / 2;
  const half = PITCH / 2 - 4.4;
  const side = rng.int(0, 3);
  if (side === 0) return { x: cx + rng.range(-half, half), z: cz - half };
  if (side === 1) return { x: cx + rng.range(-half, half), z: cz + half };
  if (side === 2) return { x: cx - half, z: cz + rng.range(-half, half) };
  return { x: cx + half, z: cz + rng.range(-half, half) };
}

export class Pedestrian {
  constructor(scene, rng, colliders) {
    this.mesh = buildPedMesh(rng);
    scene.add(this.mesh);
    const start = randomWaypoint(rng);
    this.x = start.x;
    this.z = start.z;
    this.target = randomWaypoint(rng);
    this.heading = rng.range(0, Math.PI * 2);
    this.speed = rng.range(1.1, 1.9);
    this.phase = rng.range(0, Math.PI * 2);
    this.flee = 0;         // seconds of panic left
    this.fleeFrom = null;  // point to run away from
    this.dead = false;
    this.deadTime = 0;
    this.rng = rng;
    this.colliders = colliders;
  }

  scare(fromX, fromZ, seconds = 4) {
    if (this.dead) return;
    this.flee = Math.max(this.flee, seconds);
    this.fleeFrom = { x: fromX, z: fromZ };
  }

  kill() {
    this.dead = true;
    this.deadTime = 0;
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.25;
  }

  update(dt) {
    if (this.dead) {
      this.deadTime += dt;
      return;
    }
    let tx;
    let tz;
    let speed = this.speed;
    if (this.flee > 0 && this.fleeFrom) {
      this.flee -= dt;
      // Run directly away from the danger point.
      const dx = this.x - this.fleeFrom.x;
      const dz = this.z - this.fleeFrom.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      tx = this.x + (dx / len) * 10;
      tz = this.z + (dz / len) * 10;
      speed = 4.6;
    } else {
      tx = this.target.x;
      tz = this.target.z;
      if (distance2d(this.x, this.z, tx, tz) < 1.2) {
        this.target = randomWaypoint(this.rng);
        return;
      }
    }
    const want = Math.atan2(tx - this.x, tz - this.z);
    this.heading = turnToward(this.heading, want, 6 * dt);
    let nx = this.x + Math.sin(this.heading) * speed * dt;
    let nz = this.z + Math.cos(this.heading) * speed * dt;
    // Keep off the building lots: if the next step is blocked, turn.
    if (pointBlocked(this.colliders, nx, nz, 0.4)) {
      this.heading += 1.8 * dt * 3;
      nx = this.x + Math.sin(this.heading) * speed * dt;
      nz = this.z + Math.cos(this.heading) * speed * dt;
      if (pointBlocked(this.colliders, nx, nz, 0.4)) return;
    }
    this.x = clamp(nx, -WORLD_EDGE, WORLD_EDGE);
    this.z = clamp(nz, -WORLD_EDGE, WORLD_EDGE + 30);
    this.phase += dt * speed * 4.4;
    this.mesh.position.set(this.x, Math.abs(Math.sin(this.phase)) * 0.04, this.z);
    this.mesh.rotation.y = this.heading;
    const limbs = this.mesh.userData.limbs;
    const swing = Math.sin(this.phase) * (this.flee > 0 ? 0.8 : 0.45);
    limbs[0].rotation.x = swing;
    limbs[1].rotation.x = -swing;
    limbs[2].rotation.x = -swing;
    limbs[3].rotation.x = swing;
  }
}

export function spawnPedestrians(scene, rng, colliders, count) {
  const list = [];
  for (let i = 0; i < count; i++) list.push(new Pedestrian(scene, rng, colliders));
  return list;
}

// Panic everyone near a point (gunshot, crash, fast car).
export function scareNearby(peds, x, z, radius, seconds = 4) {
  for (const ped of peds) {
    if (!ped.dead && distance2d(x, z, ped.x, ped.z) < radius) ped.scare(x, z, seconds);
  }
}
