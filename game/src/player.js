// Teluk Kirana — the player character on foot, and the doorway into
// every vehicle: entering hides the walker and hands control to the car,
// exiting steps out beside it. `heading` is born as a finite number at
// spawn and is guarded every step — it is never allowed to go undefined.
import * as THREE from 'three';
import { CONFIG, PLAYER_SPAWN, clampNumber } from './config.js';
import { resolveCircleCollision } from './city.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x117a8b, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc68863, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.95 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.8, 0.37), jacket);
  torso.position.y = 1.09;
  torso.castShadow = true;
  g.add(torso);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.39),
    new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.8 }));
  stripe.position.y = 1.22;
  g.add(stripe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.7;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.11, 12),
    new THREE.MeshStandardMaterial({ color: 0xd94f3d, roughness: 0.7 }));
  cap.position.y = 1.9;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.24),
    new THREE.MeshStandardMaterial({ color: 0xd94f3d, roughness: 0.7 }));
  brim.position.set(0, 1.86, 0.3);
  g.add(brim);
  for (const s of [-0.17, 0.17]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.74, 0.25), pants);
    leg.position.set(s, 0.37, 0);
    leg.castShadow = true;
    g.add(leg);
  }
  for (const s of [-0.4, 0.4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.68, 0.18), jacket);
    arm.position.set(s, 1.09, 0);
    g.add(arm);
  }
  return g;
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.x = PLAYER_SPAWN.x;
    this.z = PLAYER_SPAWN.z;
    this.heading = Number.isFinite(PLAYER_SPAWN.heading) ? PLAYER_SPAWN.heading : 0;
    this.speed = 0;
    this.walkPhase = 0;
    this.vehicle = null;
    this.cash = 300;
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
    if (!Number.isFinite(this.heading)) this.heading = 0;
    const pace = input.shift ? CONFIG.playerRunSpeed : CONFIG.playerWalkSpeed;
    let mx = 0;
    let mz = 0;
    if (input.forward) { mx += Math.sin(cameraYaw); mz += Math.cos(cameraYaw); }
    if (input.back) { mx -= Math.sin(cameraYaw); mz -= Math.cos(cameraYaw); }
    if (input.left) { mx -= Math.cos(cameraYaw); mz += Math.sin(cameraYaw); }
    if (input.right) { mx += Math.cos(cameraYaw); mz -= Math.sin(cameraYaw); }
    const len = Math.hypot(mx, mz);
    if (len > 0.001) {
      mx /= len;
      mz /= len;
      this.speed = pace;
      this.heading = Math.atan2(mx, mz);
      const pos = { x: this.x + mx * pace * dt, z: this.z + mz * pace * dt };
      resolveCircleCollision(colliders, pos, 0.6);
      this.x = clampNumber(pos.x, -212, 216);
      this.z = clampNumber(pos.z, -212, 212);
      this.walkPhase += dt * pace * 1.7;
    } else {
      this.speed = 0;
    }
    this.mesh.position.set(this.x, Math.abs(Math.sin(this.walkPhase)) * 0.055, this.z);
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
    // Out the left door, clear of the bodywork.
    this.x = v.x - Math.cos(v.heading) * 2.5;
    this.z = v.z + Math.sin(v.heading) * 2.5;
    if (!Number.isFinite(this.heading)) this.heading = v.heading;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    return true;
  }
}
