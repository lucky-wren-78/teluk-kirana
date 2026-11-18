// pedestrians.js — the walking population of Teluk Kirana.
// Each pedestrian strolls a sidewalk loop around a city block. When a gunshot,
// a crash or a speeding car erupts nearby they panic: arms up, sprint away
// from the trouble, then calm down and resume their stroll.

import * as THREE from 'three';
import { ROAD_LINES, CITY } from './config.js';
import { clamp, distance2d } from './rng.js';

const SHIRT_COLOURS = [0xe8e3d8, 0x38b8a8, 0xd94f6a, 0x4a7dd9, 0xe0c33a, 0x7dd94a, 0xd97a2e, 0x9e6ad9];
const SKIN_TONES = [0x8a5a3b, 0xb97a56, 0x6e4526, 0xd9a878];

function buildPedestrianMesh(rng) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: rng.pick(SKIN_TONES) });
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRT_COLOURS) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.66, 0.26), shirt);
  torso.position.y = 1.02;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 7), skin);
  head.position.y = 1.56;
  group.add(head);
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.68, 0.16), new THREE.MeshLambertMaterial({ color: 0x333a44 }));
    leg.geometry.translate(0, -0.34, 0);
    leg.position.set(0, 0.68, side * 0.11);
    group.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.56, 0.11), shirt);
    arm.geometry.translate(0, -0.28, 0);
    arm.position.set(0, 1.3, side * 0.3);
    group.add(arm);
    arms.push(arm);
  }
  group.userData.legs = legs;
  group.userData.arms = arms;
  return group;
}

export class PedestrianCrowd {
  constructor(scene, rng, count) {
    this.members = [];
    this.rng = rng;
    for (let i = 0; i < count; i++) {
      const mesh = buildPedestrianMesh(rng);
      // A sidewalk loop: pick a block, walk its perimeter.
      const bi = rng.int(0, ROAD_LINES.length - 2);
      const bj = rng.int(0, ROAD_LINES.length - 2);
      const cx = (ROAD_LINES[bi] + ROAD_LINES[bi + 1]) / 2;
      const cz = (ROAD_LINES[bj] + ROAD_LINES[bj + 1]) / 2;
      const half = (CITY.blockSize - CITY.roadWidth) / 2 - 0.6;
      const member = {
        mesh,
        cx, cz, half,
        edge: rng.int(0, 3),
        t: rng.float(),
        speed: rng.range(1.1, 1.9),
        panic: 0,
        fleeX: 0, fleeZ: 0,
        phase: rng.range(0, 9),
        down: false,
      };
      this.placeOnLoop(member);
      scene.add(mesh);
      this.members.push(member);
    }
  }

  placeOnLoop(m) {
    const h = m.half;
    const perimeter = [
      { x: m.cx - h + m.t * 2 * h, z: m.cz - h },
      { x: m.cx + h, z: m.cz - h + m.t * 2 * h },
      { x: m.cx + h - m.t * 2 * h, z: m.cz + h },
      { x: m.cx - h, z: m.cz + h - m.t * 2 * h },
    ];
    const p = perimeter[m.edge];
    m.mesh.position.set(p.x, 0, p.z);
  }

  // Something loud happened at (x, z): nearby pedestrians panic and flee.
  scareAt(x, z, radius) {
    for (const m of this.members) {
      const d = distance2d(m.mesh.position.x, m.mesh.position.z, x, z);
      if (d < radius && !m.down) {
        m.panic = this.rng.range(1.6, 3.2);
        const dx = m.mesh.position.x - x;
        const dz = m.mesh.position.z - z;
        const len = Math.hypot(dx, dz) || 1;
        m.fleeX = dx / len;
        m.fleeZ = dz / len;
      }
    }
  }

  knockDown(x, z, radius) {
    for (const m of this.members) {
      const d = distance2d(m.mesh.position.x, m.mesh.position.z, x, z);
      if (d < radius && !m.down) {
        m.down = true;
        m.mesh.rotation.x = Math.PI / 2;
        m.mesh.position.y = 0.25;
        return m;
      }
    }
    return null;
  }

  update(dt) {
    for (const m of this.members) {
      if (m.down) continue;
      m.phase += dt * (m.panic > 0 ? 15 : 8);
      const swing = Math.sin(m.phase) * 0.55;
      m.mesh.userData.legs[0].rotation.x = swing;
      m.mesh.userData.legs[1].rotation.x = -swing;
      if (m.panic > 0) {
        m.panic -= dt;
        m.mesh.position.x += m.fleeX * 5.4 * dt;
        m.mesh.position.z += m.fleeZ * 5.4 * dt;
        m.mesh.rotation.y = -Math.atan2(m.fleeZ, m.fleeX) + Math.PI / 2;
        m.mesh.userData.arms[0].rotation.x = Math.PI * 0.9;
        m.mesh.userData.arms[1].rotation.x = Math.PI * 0.9;
        // Clamp to the island.
        m.mesh.position.x = clamp(m.mesh.position.x, -CITY.halfSize, CITY.halfSize + 40);
        m.mesh.position.z = clamp(m.mesh.position.z, -CITY.halfSize, CITY.halfSize + 10);
      } else {
        m.mesh.userData.arms[0].rotation.x = -swing * 0.7;
        m.mesh.userData.arms[1].rotation.x = swing * 0.7;
        const loopLength = 2 * m.half;
        m.t += (m.speed * dt) / loopLength;
        if (m.t >= 1) { m.t = 0; m.edge = (m.edge + 1) % 4; }
        const before = { x: m.mesh.position.x, z: m.mesh.position.z };
        this.placeOnLoop(m);
        const dx = m.mesh.position.x - before.x;
        const dz = m.mesh.position.z - before.z;
        if (Math.abs(dx) + Math.abs(dz) > 0.001) {
          m.mesh.rotation.y = -Math.atan2(dz, dx) + Math.PI / 2;
        }
      }
    }
  }
}
