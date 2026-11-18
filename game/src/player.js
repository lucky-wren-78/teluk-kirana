// Teluk Kirana — the player on foot, and getting in and out of vehicles.
// Bug #2 fix: `heading` is initialised to 0 at spawn, is a plain finite number,
// and is never deleted or reassigned to undefined anywhere in the game.
import * as THREE from 'three';
import { CONFIG, PLAYER_SPAWN, clampNumber } from './config.js';
import { resolveCircleCollision } from './city.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x1f6f8b, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc68863, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), jacket);
  body.position.y = 1.08;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.68;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0xd94f3d, roughness: 0.7 }));
  cap.position.y = 1.88;
  g.add(cap);
  for (const s of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
    leg.position.set(s, 0.36, 0);
    leg.castShadow = true;
    g.add(leg);
  }
  for (const s of [-0.38, 0.38]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.18), jacket);
    arm.position.set(s, 1.08, 0);
    g.add(arm);
  }
  return g;
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.x = PLAYER_SPAWN.x;
    this.z = PLAYER_SPAWN.z;
    this.heading = PLAYER_SPAWN.heading ?? 0;
    this.speed = 0;
    this.walkPhase = 0;
    this.vehicle = null;
    this.cash = 250;
    this.ammo = 48;
    this.health = 100;
    this.mesh = makePlayerMesh();
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    scene.add(this.mesh);
  }

  get position() {
    return { x: this.x, z: this.z, heading: this.heading };
  }

  update(dt, input, colliders, cameraYaw) {
    if (this.vehicle) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    // Heading is always a finite number; guard once per frame, never delete.
    if (!Number.isFinite(this.heading)) this.heading = 0;
    const run = input.shift ? CONFIG.playerRunSpeed : CONFIG.playerWalkSpeed;
    let mx = 0;
    let mz = 0;
    if (input.forward) { mx += Math.sin(cameraYaw); mz += Math.cos(cameraYaw); }
    if (input.back) { mx -= Math.sin(cameraYaw); mz -= Math.cos(cameraYaw); }
    if (input.left) { mx -= Math.cos(cameraYaw); mz += Math.sin(cameraYaw); }
    if (input.right) { mx += Math.cos(cameraYaw); mz -= Math.sin(cameraYaw); }
    const len = Math.sqrt(mx * mx + mz * mz);
    if (len > 0.001) {
      mx /= len;
      mz /= len;
      this.speed = run;
      this.heading = Math.atan2(mx, mz);
      const pos = { x: this.x + mx * run * dt, z: this.z + mz * run * dt };
      resolveCircleCollision(colliders, pos, 0.6);
      this.x = clampNumber(pos.x, -212, 218);
      this.z = clampNumber(pos.z, -212, 212);
      this.walkPhase += dt * run * 1.6;
    } else {
      this.speed = 0;
    }
    this.mesh.position.set(this.x, Math.abs(Math.sin(this.walkPhase)) * 0.05, this.z);
    this.mesh.rotation.y = this.heading;
  }

  enterVehicle(vehicle) {
    if (!vehicle) return false;
    this.vehicle = vehicle;
    vehicle.driven = true;
    vehicle.attachHeadlight();
    this.mesh.visible = false;
    return true;
  }

  exitVehicle() {
    if (!this.vehicle) return false;
    const v = this.vehicle;
    this.vehicle = null;
    v.driven = false;
    v.detachHeadlight();
    v.speed = 0;
    // Step out to the side of the vehicle, clear of its body.
    this.x = v.x - Math.cos(v.heading) * 2.4;
    this.z = v.z + Math.sin(v.heading) * 2.4;
    if (!Number.isFinite(this.heading)) this.heading = 0;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    return true;
  }
}
