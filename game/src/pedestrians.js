// Pedestrians: low-poly walkers on the sidewalks who wander between
// intersections, flee from gunfire, and panic when a car comes too close.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { collideCircle } from './city.js';

const SHIRT_COLORS = [0xe4572e, 0x2e86ab, 0xf2c94c, 0x8e44ad, 0xdddddd, 0x229954, 0xe67e22];

function buildWalkerMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRT_COLORS) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.42), shirt);
  body.position.y = 0.95; g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xc98d64 }),
  );
  head.position.y = 1.65; g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), legMat);
  legL.position.set(-0.18, 0.4, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.18; g.add(legR);
  g.userData.legL = legL; g.userData.legR = legR;
  return g;
}

export function createPedestrians(scene, rng, city) {
  const p = { list: [], rng, city, scene };
  for (let i = 0; i < CONFIG.pedestrian.count; i += 1) {
    spawnWalker(p, rng.range(-256, 256), rng.range(-256, 256), false);
  }
  return p;
}

export function spawnWalker(p, x, z, fleeing) {
  const mesh = buildWalkerMesh(p.rng);
  const road = p.city.roadLines;
  // Walkers stay near roads: snap to a nearby road line.
  const rx = road.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  mesh.position.set(rx + p.rng.range(-8, 8), 0, z);
  p.scene.add(mesh);
  const w = {
    mesh, pos: mesh.position,
    heading: p.rng.range(0, Math.PI * 2),
    speed: CONFIG.pedestrian.speed * p.rng.range(0.8, 1.2),
    target: null, fleeing: !!fleeing, fleeTimer: fleeing ? 6 : 0,
    phase: p.rng.range(0, 6), alive: true,
  };
  p.list.push(w);
  return w;
}

function pickTarget(p, w) {
  const roads = p.city.roadLines;
  const rx = roads[Math.floor(p.rng.next() * roads.length)];
  const rz = roads[Math.floor(p.rng.next() * roads.length)];
  w.target = { x: rx + p.rng.range(-8, 8), z: rz + p.rng.range(-8, 8) };
}

export function updatePedestrians(world, dt) {
  const { pedestrians, player, city } = world;
  for (const w of pedestrians.list) {
    if (!w.alive) continue;
    if (w.fleeTimer > 0) {
      w.fleeTimer -= dt;
      const dx = w.pos.x - player.pos.x, dz = w.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      w.heading = Math.atan2(dx / d, dz / d);
      w.speed = CONFIG.pedestrian.fleeSpeed;
    } else {
      w.speed = CONFIG.pedestrian.speed;
      if (!w.target) pickTarget(pedestrians, w);
      const dx = w.target.x - w.pos.x, dz = w.target.z - w.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) { w.target = null; continue; }
      w.heading = Math.atan2(dx / d, dz / d);
    }
    const nx = w.pos.x + Math.sin(w.heading) * w.speed * dt;
    const nz = w.pos.z + Math.cos(w.heading) * w.speed * dt;
    const res = collideCircle(city, nx, nz, 0.5);
    w.pos.x = res.x; w.pos.z = res.z;
    w.phase += dt * w.speed * 2.2;
    w.mesh.rotation.y = w.heading;
    w.mesh.userData.legL.rotation.x = Math.sin(w.phase) * 0.6;
    w.mesh.userData.legR.rotation.x = -Math.sin(w.phase) * 0.6;
    // A car barrelling at a walker makes them run.
    if (!w.fleeing) {
      for (const car of world.vehicles.list) {
        if (car.driver === 'player' && Math.abs(car.speed) > 8) {
          const d = car.pos.distanceTo(w.pos);
          if (d < 10) { w.fleeTimer = 3; w.fleeing = true; break; }
        }
      }
    }
  }
}

export function fleeFrom(world, x, z, radius) {
  for (const w of world.pedestrians.list) {
    if (!w.alive) continue;
    const d = Math.hypot(w.pos.x - x, w.pos.z - z);
    if (d < radius) { w.fleeTimer = 5; w.fleeing = true; }
  }
}
