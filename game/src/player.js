// player.js — Kira on foot: a low-poly harbour courier with a walk cycle,
// plus the third-person camera rig that follows her (and her vehicle).

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { clamp, lerpAngle } from './rng.js';
import { resolveCollisions } from './city.js';

export function buildPlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xb97a56 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xe8542f }); // harbour-courier orange
  const pants = new THREE.MeshLambertMaterial({ color: 0x27384a });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.3), shirt);
  torso.position.y = 1.06;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.66;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0x0d3b3e }));
  cap.position.y = 1.82;
  group.add(cap);

  const limbs = { legs: [], arms: [] };
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.72, 0.19), pants);
    leg.geometry.translate(0, -0.36, 0);
    leg.position.set(0, 0.72, side * 0.13);
    group.add(leg);
    limbs.legs.push(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.13), shirt);
    arm.geometry.translate(0, -0.31, 0);
    arm.position.set(0, 1.36, side * 0.34);
    group.add(arm);
    limbs.arms.push(arm);
  }
  group.userData.limbs = limbs;
  return group;
}

export class Player {
  constructor(scene, colliders) {
    this.mesh = buildPlayerMesh();
    this.pos = this.mesh.position;
    this.pos.set(PLAYER.startPosition.x, 0, PLAYER.startPosition.z);
    this.heading = Math.PI; // facing the harbour water, east behind her
    this.speedNow = 0;
    this.walkPhase = 0;
    this.health = PLAYER.maxHealth;
    this.vehicle = null;    // vehicle she is driving, or null on foot
    this.colliders = colliders;
    scene.add(this.mesh);
  }

  get inVehicle() { return this.vehicle !== null; }

  // moveInput: {x: strafe-ish forward amount -1..1, z: sideways} in camera space,
  // already rotated into world space by the caller. Simpler contract: the caller
  // passes a world-space wish direction (wx, wz) and a sprint flag.
  update(dt, wishX, wishZ, sprinting) {
    if (this.inVehicle) {
      // Ride along inside the vehicle; hide the walking figure in the cabin.
      this.pos.copy(this.vehicle.pos);
      this.heading = this.vehicle.heading;
      this.mesh.position.set(this.pos.x, -3, this.pos.z); // tucked out of sight
      return;
    }
    this.mesh.position.y = 0;
    const wishLength = Math.hypot(wishX, wishZ);
    if (wishLength > 0.01) {
      const speed = sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      const nx = (wishX / wishLength) * speed;
      const nz = (wishZ / wishLength) * speed;
      this.pos.x += nx * dt;
      this.pos.z += nz * dt;
      this.speedNow = speed;
      const targetHeading = Math.atan2(nz, nx);
      this.heading = lerpAngle(this.heading, targetHeading, clamp(dt * 12, 0, 1));
      this.walkPhase += dt * (sprinting ? 13 : 9.5);
    } else {
      this.speedNow = 0;
      this.walkPhase += dt * 1.2; // idle sway
    }
    resolveCollisions(this.pos, PLAYER.radius, this.colliders);
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = -this.heading + Math.PI / 2;

    const limbs = this.mesh.userData.limbs;
    const swing = Math.sin(this.walkPhase) * (this.speedNow > 0 ? 0.62 : 0.05);
    limbs.legs[0].rotation.x = swing;
    limbs.legs[1].rotation.x = -swing;
    limbs.arms[0].rotation.x = -swing * 0.8;
    limbs.arms[1].rotation.x = swing * 0.8;
  }

  enterVehicle(vehicle) {
    this.vehicle = vehicle;
    vehicle.driver = 'player';
  }

  exitVehicle() {
    if (!this.vehicle) return null;
    const vehicle = this.vehicle;
    vehicle.driver = null;
    vehicle.speed = 0;
    this.vehicle = null;
    // Step out on the left side of the vehicle.
    const sideX = Math.sin(vehicle.heading) * 2.2;
    const sideZ = -Math.cos(vehicle.heading) * 2.2;
    this.pos.set(vehicle.pos.x + sideX, 0, vehicle.pos.z + sideZ);
    resolveCollisions(this.pos, PLAYER.radius, this.colliders);
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    return vehicle;
  }

  teleport(x, z, heading) {
    if (this.inVehicle) this.exitVehicle();
    this.pos.set(x, 0, z);
    if (heading !== undefined) this.heading = heading;
    this.mesh.position.set(x, 0, z);
  }
}

// Third-person camera: trails behind a focus point, mouse-drag orbits it,
// and screenshot mode can pin it exactly with setShotCamera.
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI;
    this.pitch = 0.32;
    this.distance = 9.5;
    this.smoothed = new THREE.Vector3(150, 4, 44);
    this.pinned = null;
  }

  pin(position, lookAt) {
    this.pinned = { position, lookAt };
    this.camera.position.copy(position);
    this.camera.lookAt(lookAt);
  }

  unpin() { this.pinned = null; }

  addDrag(dx, dy) {
    this.yaw -= dx * 0.005;
    this.pitch = clamp(this.pitch + dy * 0.004, 0.06, 1.15);
  }

  update(dt, focusPos, focusHeading, driving) {
    if (this.pinned) return;
    const dist = driving ? 11.5 : this.distance;
    const height = driving ? 4.4 : 3.1;
    // When driving, ease the camera behind the vehicle's heading.
    if (driving) {
      const behind = focusHeading + Math.PI;
      let delta = behind - this.yaw;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.yaw += delta * clamp(dt * 1.6, 0, 1);
    }
    const target = new THREE.Vector3(
      focusPos.x + Math.cos(this.yaw) * Math.cos(this.pitch) * dist,
      height + Math.sin(this.pitch) * dist * 0.55,
      focusPos.z + Math.sin(this.yaw) * Math.cos(this.pitch) * dist
    );
    const blend = clamp(dt * (driving ? 5.5 : 8), 0, 1);
    this.smoothed.lerp(target, blend);
    this.camera.position.copy(this.smoothed);
    this.camera.lookAt(focusPos.x, 1.6, focusPos.z);
  }
}
