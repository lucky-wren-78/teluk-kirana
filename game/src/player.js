// player.js — the player character: a small articulated low-poly figure with
// separate limb meshes so the arms and legs can swing, its on-foot movement
// and the walk/sprint animation. Who the player is — money, respect, jobs —
// lives in the game state in main.js; this module only moves the body.

import * as THREE from '../vendor/three.module.min.js';
import { TUNING } from './config.js';
import { angleDelta, clamp } from './random.js';
import { resolveCollisions } from './world.js';

// Builds a human figure ~1.8 m tall facing +Z, with pivoted limbs for animation.
export function createHumanFigure({ shirt, pants, skin, cap = null, skirt = false }) {
  const group = new THREE.Group();
  const mat = (hex) => new THREE.MeshLambertMaterial({ color: hex });
  const box = (w, h, d, hex, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex));
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };
  const limb = (w, h, d, hex, x, y, z) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex));
    m.position.y = -h / 2;
    m.castShadow = true;
    pivot.add(m);
    group.add(pivot);
    return pivot;
  };
  const legL = limb(0.21, 0.82, 0.24, pants, -0.13, 0.86, 0);
  const legR = limb(0.21, 0.82, 0.24, pants, 0.13, 0.86, 0);
  if (skirt) box(0.52, 0.4, 0.4, shirt, 0, 0.98, 0);
  const torso = box(0.56, 0.62, 0.3, shirt, 0, 1.18, 0);
  const armL = limb(0.15, 0.68, 0.17, shirt, -0.37, 1.44, 0);
  const armR = limb(0.15, 0.68, 0.17, shirt, 0.37, 1.44, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), mat(skin));
  head.position.set(0, 1.68, 0);
  head.castShadow = true;
  group.add(head);
  if (cap !== null) {
    const capMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.12, 10), mat(cap));
    capMesh.position.set(0, 1.82, 0);
    group.add(capMesh);
    box(0.4, 0.05, 0.24, cap, 0, 1.78, 0.24);
  }
  group.userData.limbs = { legL, legR, armL, armR, torso, head };
  return group;
}

export function animateFigure(figure, speedNorm, t, attacking = 0) {
  const limbs = figure.userData.limbs;
  if (!limbs) return;
  const cycle = t * (4 + speedNorm * 7);
  const swing = Math.sin(cycle) * 0.65 * speedNorm;
  limbs.legL.rotation.x = swing;
  limbs.legR.rotation.x = -swing;
  limbs.armL.rotation.x = -swing * 0.8;
  limbs.armR.rotation.x = attacking > 0 ? -2.1 + Math.sin(t * 26) * 0.5 : swing * 0.8;
  figure.position.y = Math.abs(Math.sin(cycle)) * 0.06 * speedNorm;
}

export function createPlayer(scene, x, z) {
  const mesh = createHumanFigure({ shirt: 0x12b5a5, pants: 0x2c3550, skin: 0xc98a5e, cap: 0xffd23e });
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh,
    heading: Math.PI,
    health: TUNING.playerHealth,
    attackTimer: 0,
    get x() { return mesh.position.x; },
    get z() { return mesh.position.z; },
  };
}

// Moves the player on foot. moveX/moveZ are a wish direction in world space
// (main.js rotates the keys by the camera yaw); returns the speed reached.
export function updatePlayerOnFoot(player, moveX, moveZ, sprint, dt, colliders, t) {
  const moving = Math.hypot(moveX, moveZ) > 0.05;
  let speed = 0;
  if (moving) {
    const len = Math.hypot(moveX, moveZ);
    const dirX = moveX / len;
    const dirZ = moveZ / len;
    const want = Math.atan2(dirX, dirZ);
    const turn = angleDelta(player.heading, want);
    player.heading += clamp(turn, -11 * dt, 11 * dt);
    speed = sprint ? TUNING.playerSprintSpeed : TUNING.playerWalkSpeed;
    // Turning hard costs speed, so the figure never slides sideways.
    const align = Math.max(0.25, 1 - Math.abs(turn) / 2.4);
    player.mesh.position.x += Math.sin(player.heading) * speed * dt * align;
    player.mesh.position.z += Math.cos(player.heading) * speed * dt * align;
  }
  resolveCollisions(player.mesh.position, TUNING.playerRadius, colliders);
  player.mesh.rotation.y = player.heading;
  player.attackTimer = Math.max(0, player.attackTimer - dt);
  animateFigure(player.mesh, clamp(speed / TUNING.playerSprintSpeed, 0, 1), t, player.attackTimer);
  return speed;
}
