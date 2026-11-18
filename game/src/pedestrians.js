// Teluk Kirana — pedestrians: shoppers in the market, workers on the
// quay, kids cutting across the plaza. They stroll between waypoints,
// pause, and sprint away from gunfire. In screenshot mode a crowd can be
// staged around the camera so the city never photographs empty.
import * as THREE from 'three';
import { createRng, range, pick } from './rng.js';
import { resolveCircleCollision } from './city.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xecf0f1, 0xfd79a8, 0x00cec9, 0xe67e22, 0x1abc9c];
const SKIN_TONES = [0xb9795a, 0x8d5a3b, 0xd9a066, 0x6e4426];

function makePedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: pick(rng, SHIRTS), roughness: 0.92 });
  const skin = new THREE.MeshStandardMaterial({ color: pick(rng, SKIN_TONES), roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.7, 0.3), shirt);
  torso.position.y = 0.99;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.52;
  head.castShadow = true;
  g.add(head);
  if (rng() < 0.4) { // a cap or a sun hat on some heads
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.09, 10),
      new THREE.MeshStandardMaterial({ color: pick(rng, SHIRTS), roughness: 0.9 }));
    hat.position.y = 1.68;
    g.add(hat);
  }
  const legMat = new THREE.MeshStandardMaterial({ color: pick(rng, [0x2c2f33, 0x4a3728, 0x1f3a5f, 0x5d6d7e]), roughness: 1 });
  for (const s of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.19), legMat);
    leg.position.set(s, 0.31, 0);
    g.add(leg);
  }
  if (rng() < 0.3) { // a shopping bag or a crate in hand
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.16),
      new THREE.MeshStandardMaterial({ color: pick(rng, [0xf5eeda, 0xd94f3d, 0x2e86de]), roughness: 1 }));
    bag.position.set(0.42, 0.78, 0);
    g.add(bag);
  }
  return g;
}

export class Pedestrian {
  constructor(scene, x, z, rng) {
    this.x = x;
    this.z = z;
    this.heading = range(rng, 0, Math.PI * 2);
    this.speed = range(rng, 1.05, 2.3);
    this.targetX = x;
    this.targetZ = z;
    this.wait = range(rng, 0, 3);
    this.fleeing = false;
    this.bobPhase = range(rng, 0, 6);
    this.mesh = makePedMesh(rng);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
  }

  pickTarget(rng) {
    this.targetX = Math.max(-206, Math.min(214, this.x + range(rng, -58, 58)));
    this.targetZ = Math.max(-206, Math.min(206, this.z + range(rng, -58, 58)));
  }

  // Teleport (used by screenshot staging): stand at x,z facing `heading`.
  placeAt(x, z, heading) {
    this.x = x;
    this.z = z;
    this.targetX = x;
    this.targetZ = z;
    this.heading = heading;
    this.wait = 0;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
  }

  update(dt, colliders, rng, playerPos, gunfireAt) {
    if (gunfireAt) {
      const dx = this.x - gunfireAt.x;
      const dz = this.z - gunfireAt.z;
      const d = Math.hypot(dx, dz);
      if (d < 42) {
        this.fleeing = true;
        this.targetX = this.x + (dx / (d || 1)) * 55;
        this.targetZ = this.z + (dz / (d || 1)) * 55;
        this.wait = 0;
      }
    }
    if (this.wait > 0) {
      this.wait -= dt;
      this.mesh.position.y = 0;
      return;
    }
    const dx = this.targetX - this.x;
    const dz = this.targetZ - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.4) {
      this.fleeing = false;
      this.wait = range(rng, 0.8, 5.5);
      this.pickTarget(rng);
      return;
    }
    const speed = this.fleeing ? this.speed * 2.7 : this.speed;
    this.heading = Math.atan2(dx, dz);
    const pos = {
      x: this.x + Math.sin(this.heading) * speed * dt,
      z: this.z + Math.cos(this.heading) * speed * dt,
    };
    resolveCircleCollision(colliders, pos, 0.5);
    this.x = pos.x;
    this.z = pos.z;
    this.bobPhase += dt * speed * 3.4;
    this.mesh.position.set(this.x, Math.abs(Math.sin(this.bobPhase)) * 0.045, this.z);
    this.mesh.rotation.y = this.heading;
  }
}

export function spawnPedestrians(scene, count) {
  const rng = createRng(777);
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard < count * 6) {
    guard += 1;
    const x = range(rng, -192, 202);
    const z = range(rng, -192, 202);
    if (x > 190) continue; // not in the sea
    peds.push(new Pedestrian(scene, x, z, rng));
  }
  return peds;
}
