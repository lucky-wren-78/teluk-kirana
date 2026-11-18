// The player on foot: walk/run with camera-relative steering, collision
// against buildings, and a simple low-poly body that faces where it walks.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { collideCircle } from './city.js';

function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1f6f4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.5), jacket);
  body.position.y = 1.05; g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xc98d64 }),
  );
  head.position.y = 1.85; g.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0xe4572e }),
  );
  cap.position.y = 2.08; g.add(cap);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2e });
  for (const x of [-0.22, 0.22]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.9, 0.36), legMat);
    leg.position.set(x, 0.45, 0); g.add(leg);
  }
  return g;
}

export function createPlayer(scene, city) {
  const mesh = buildPlayerMesh();
  mesh.position.copy(city.spawn.player);
  scene.add(mesh);
  return {
    mesh,
    pos: mesh.position,
    heading: 0,
    speed: 0,
    health: CONFIG.player.health,
    cash: CONFIG.player.startCash,
    ammo: CONFIG.player.startAmmo,
    inVehicle: false,
    vehicle: null,
    dead: false,
    walkPhase: 0,
  };
}

export function updatePlayer(world, dt, input, camYaw) {
  const { player, city } = world;
  if (player.inVehicle || player.dead) return;
  const run = input.run ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
  let fx = 0, fz = 0;
  if (input.forward) { fx += Math.sin(camYaw); fz += Math.cos(camYaw); }
  if (input.back) { fx -= Math.sin(camYaw); fz -= Math.cos(camYaw); }
  if (input.left) { fx -= Math.cos(camYaw); fz += Math.sin(camYaw); }
  if (input.right) { fx += Math.cos(camYaw); fz -= Math.sin(camYaw); }
  const len = Math.hypot(fx, fz);
  if (len > 0.01) {
    fx /= len; fz /= len;
    const targetHeading = Math.atan2(fx, fz);
    let dh = targetHeading - player.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    player.heading += dh * Math.min(1, dt * 12);
    player.speed = run;
    player.walkPhase += dt * run * 1.4;
    const nx = player.pos.x + fx * run * dt;
    const nz = player.pos.z + fz * run * dt;
    const res = collideCircle(city, nx, nz, CONFIG.player.radius);
    player.pos.x = res.x; player.pos.z = res.z;
    // Walk bob.
    player.mesh.position.y = Math.abs(Math.sin(player.walkPhase)) * 0.08;
  } else {
    player.speed = 0;
    player.mesh.position.y = 0;
  }
  player.mesh.rotation.y = player.heading;
  world.speedKmh = player.speed * 3.6;
}

export function damagePlayer(world, amount, source) {
  const { player } = world;
  if (player.dead || player.inVehicle) return;
  player.health -= amount;
  world.hud.flashDamage();
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    world.hud.showGameOver('Kamu tertangkap / tewas di jalanan Teluk Kirana.');
    world.audio.siren(false);
  }
}
