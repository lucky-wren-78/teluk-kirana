// Teluk Kirana — pedestrians: market shoppers, harbour workers and night owls
// who wander the sidewalks, scatter when gunfire sounds, and cross the roads.
import * as THREE from 'three';
import { createRng, range, pick } from './rng.js';
import { resolveCircleCollision } from './city.js';

const SHIRT_COLORS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xecf0f1, 0xfd79a8, 0x00cec9];

function makePedMesh(color) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb9795a, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.68, 0.3), shirt);
  body.position.y = 0.98;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.5;
  g.add(head);
  for (const s of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.6, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1 }));
    leg.position.set(s, 0.3, 0);
    g.add(leg);
  }
  return g;
}

export class Pedestrian {
  constructor(scene, x, z, rng) {
    this.x = x;
    this.z = z;
    this.heading = range(rng, 0, Math.PI * 2);
    this.speed = range(rng, 1.1, 2.2);
    this.targetX = x;
    this.targetZ = z;
    this.wait = range(rng, 0, 4);
    this.fleeing = false;
    this.mesh = makePedMesh(pick(rng, SHIRT_COLORS));
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
  }

  pickTarget(rng) {
    this.targetX = this.x + range(rng, -60, 60);
    this.targetZ = this.z + range(rng, -60, 60);
    this.targetX = Math.max(-205, Math.min(215, this.targetX));
    this.targetZ = Math.max(-205, Math.min(205, this.targetZ));
  }

  update(dt, colliders, rng, playerPos, gunfireAt) {
    if (gunfireAt) {
      const dx = this.x - gunfireAt.x;
      const dz = this.z - gunfireAt.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 40) {
        this.fleeing = true;
        this.targetX = this.x + (dx / (d || 1)) * 60;
        this.targetZ = this.z + (dz / (d || 1)) * 60;
      }
    }
    if (this.wait > 0) {
      this.wait -= dt;
      return;
    }
    const dx = this.targetX - this.x;
    const dz = this.targetZ - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 1.5) {
      this.fleeing = false;
      this.wait = range(rng, 1, 6);
      this.pickTarget(rng);
      return;
    }
    const speed = this.fleeing ? this.speed * 2.6 : this.speed;
    this.heading = Math.atan2(dx, dz);
    const pos = { x: this.x + Math.sin(this.heading) * speed * dt, z: this.z + Math.cos(this.heading) * speed * dt };
    resolveCircleCollision(colliders, pos, 0.5);
    this.x = pos.x;
    this.z = pos.z;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }
}

export function spawnPedestrians(scene, count) {
  const rng = createRng(4242);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const x = range(rng, -190, 200);
    const z = range(rng, -190, 200);
    if (Math.abs(x) < 12 && Math.abs(z) < 20) continue;
    peds.push(new Pedestrian(scene, x, z, rng));
  }
  return peds;
}
