// The law: a 0-5 wanted level driven by heat. Patrol cars cruise until the
// heat rises, then chase and ram; a helicopter with a spotlight joins at
// three stars; at four and five stars roadblocks with spike strips appear
// ahead of the player and popped tyres slow the getaway car.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { collideCircle } from './city.js';
import { damagePlayer } from './player.js';

function buildHelicopter() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2f4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 6), bodyMat);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5), bodyMat);
  tail.position.set(0, 0.3, -5); g.add(tail);
  const rotorMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.5), rotorMat);
  rotor.position.y = 1.1; g.add(rotor);
  g.userData.rotor = rotor;
  const spot = new THREE.SpotLight(0xfff2b0, 1500, CONFIG.police.spotlightRange, 0.35, 0.5, 1.2);
  spot.position.set(0, -0.8, 0);
  g.add(spot);
  g.userData.spot = spot;
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(7, CONFIG.police.heliHeight, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.y = -CONFIG.police.heliHeight / 2;
  cone.rotation.x = Math.PI;
  g.add(cone);
  g.userData.cone = cone;
  return g;
}

function buildRoadblock(scene) {
  const g = new THREE.Group();
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xe67e22 });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  for (let i = -1; i <= 1; i += 1) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 0.5), i % 2 === 0 ? stripeMat : whiteMat);
    bar.position.set(i * 3.6, 0.55, 0); g.add(bar);
  }
  const spikes = new THREE.Group();
  const spikeMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  for (let i = 0; i < 9; i += 1) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 4), spikeMat);
    s.position.set(-4 + i, 0.35, 0); spikes.add(s);
  }
  spikes.position.z = 4;
  g.add(spikes);
  g.userData.spikes = spikes;
  scene.add(g);
  return g;
}

export function createPolice(scene, rng, city) {
  const heli = buildHelicopter();
  heli.visible = false;
  scene.add(heli);
  return {
    scene, rng, city,
    wanted: 0, heat: 0, lastCrimeAt: -999,
    patrol: [], chasers: [], heli, heliOn: false,
    roadblocks: [], roadblockTimer: 20, sirenOn: false,
  };
}

function spawnPoliceCar(world, x, z) {
  const { police, scene } = world;
  // Reuse the car builder from vehicles via a fresh group here to avoid a cycle.
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: 0xdddddd });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), paint);
  body.position.y = 0.65; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.2), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  cabin.position.set(0, 1.35, -0.2); g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.42, wz); g.add(w);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
  bar.position.set(0, 1.85, -0.2); g.add(bar);
  g.position.set(x, 0, z);
  scene.add(g);
  const car = {
    kind: 'police', mesh: g, pos: g.position,
    heading: 0, speed: 0, driver: 'police', alive: true, tirePopped: false,
    lightPhase: world.police.rng.range(0, 6),
  };
  world.vehicles.list.push(car);
  return car;
}

export function addHeat(world, amount) {
  const p = world.police;
  p.heat = Math.min(100, p.heat + amount);
  p.lastCrimeAt = world.time;
  const want = Math.min(5, Math.ceil(p.heat / 20));
  if (want > p.wanted) {
    p.wanted = want;
    world.hud.toast(`Bintang ${want}! Polisi mengejarmu.`);
    world.audio.siren(true);
  }
}

function ensureChasers(world) {
  const p = world.police;
  const want = p.wanted;
  const target = want === 0 ? 0 : Math.min(2 + want, 6);
  while (p.chasers.length < target) {
    const a = p.rng.range(0, Math.PI * 2);
    const x = world.player.pos.x + Math.sin(a) * 60;
    const z = world.player.pos.z + Math.cos(a) * 60;
    const car = spawnPoliceCar(world, x, z);
    p.chasers.push(car);
  }
  while (p.chasers.length > target) {
    const car = p.chasers.pop();
    car.alive = false;
    car.mesh.visible = false;
    const i = world.vehicles.list.indexOf(car);
    if (i >= 0) world.vehicles.list.splice(i, 1);
  }
}

function updateChasers(world, dt) {
  const p = world.police;
  for (const car of p.chasers) {
    const dx = world.player.pos.x - car.pos.x;
    const dz = world.player.pos.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let dh = want - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += Math.max(-1.6, Math.min(1.6, dh * 2)) * dt * Math.min(1, Math.abs(car.speed) / 10 + 0.3);
    const target = dist > 30 ? CONFIG.police.chaseSpeed : CONFIG.police.chaseSpeed * 0.7;
    car.speed += (target - car.speed) * Math.min(1, dt * 0.8);
    const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
    const res = collideCircle(world.city, nx, nz, 2.2);
    car.pos.x = res.x; car.pos.z = res.z;
    car.mesh.rotation.y = car.heading;
    car.lightPhase += dt * 10;
    car.mesh.children.forEach((c) => {
      if (c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y > 1.8) {
        c.material.color.setHex(Math.sin(car.lightPhase) > 0 ? 0x2244ff : 0xff2222);
      }
    });
    // Ram the player: on foot it hurts, in a car it shoves.
    if (dist < CONFIG.police.ramDistance) {
      if (world.player.inVehicle) {
        const veh = world.vehicles.playerVehicle;
        veh.speed *= 0.6;
        world.events.push({ type: 'crash', at: car.pos.clone() });
      } else {
        damagePlayer(world, 12, 'police');
        car.speed *= -0.4;
      }
    }
  }
}

function updateHelicopter(world, dt) {
  const p = world.police;
  const want = p.wanted >= 3;
  if (want && !p.heliOn) {
    p.heliOn = true;
    p.heli.visible = true;
    world.hud.toast('Helikopter polisi di atasmu!');
  } else if (!want && p.heliOn) {
    p.heliOn = false;
    p.heli.visible = false;
  }
  if (!p.heliOn) return;
  const target = world.player.pos;
  const orbit = world.time * 0.25;
  const hx = target.x + Math.sin(orbit) * 26;
  const hz = target.z + Math.cos(orbit) * 26;
  p.heli.position.x += (hx - p.heli.position.x) * Math.min(1, dt * 1.2);
  p.heli.position.z += (hz - p.heli.position.z) * Math.min(1, dt * 1.2);
  p.heli.position.y = CONFIG.police.heliHeight;
  p.heli.rotation.y = Math.atan2(target.x - p.heli.position.x, target.z - p.heli.position.z);
  p.heli.userData.rotor.rotation.y += dt * 22;
  p.heli.userData.spot.target.position.set(target.x - p.heli.position.x, -CONFIG.police.heliHeight, target.z - p.heli.position.z);
  p.heli.userData.spot.target.updateMatrixWorld();
}

function placeRoadblock(world) {
  const p = world.police;
  const heading = world.player.heading;
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const px = world.player.pos.x + fx * 55;
  const pz = world.player.pos.z + fz * 55;
  const g = buildRoadblock(world.scene);
  g.position.set(px, 0, pz);
  g.rotation.y = heading + Math.PI / 2;
  p.roadblocks.push({ mesh: g, spikes: g.userData.spikes, hit: false });
  if (p.roadblocks.length > 3) {
    const old = p.roadblocks.shift();
    world.scene.remove(old.mesh);
  }
  world.hud.toast('Roadblock di depan! Ada spike strip.');
}

function updateRoadblocks(world, dt) {
  const p = world.police;
  p.roadblockTimer -= dt;
  if (p.wanted >= CONFIG.police.roadblockAtStars && p.roadblockTimer <= 0) {
    placeRoadblock(world);
    p.roadblockTimer = 26;
  }
  const veh = world.vehicles.playerVehicle;
  for (const rb of p.roadblocks) {
    if (rb.hit || !veh || !world.player.inVehicle) continue;
    const d = Math.hypot(veh.pos.x - rb.mesh.position.x, veh.pos.z - rb.mesh.position.z);
    if (d < 5) {
      rb.hit = true;
      veh.tirePopped = true;
      veh.speed *= CONFIG.police.spikeSlow;
      world.hud.toast('Ban kena spike strip! Mobil melambat.');
      world.audio.blip();
      setTimeout(() => { veh.tirePopped = false; }, 9000);
    }
  }
}

export function updatePolice(world, dt) {
  const p = world.police;
  // Heat decays after a quiet spell; the wanted level follows it down.
  if (world.time - p.lastCrimeAt > CONFIG.police.heatDecayDelaySec && p.heat > 0) {
    p.heat = Math.max(0, p.heat - CONFIG.police.heatDecayPerSec * dt);
    const want = Math.ceil(p.heat / 20);
    if (want < p.wanted) {
      p.wanted = want;
      if (want === 0) {
        world.hud.toast('Kamu lolos dari kejaran.');
        world.audio.siren(false);
      }
    }
  }
  ensureChasers(world);
  updateChasers(world, dt);
  updateHelicopter(world, dt);
  updateRoadblocks(world, dt);
}

export function setWanted(world, level) {
  const p = world.police;
  p.wanted = level;
  p.heat = level * 20;
  p.lastCrimeAt = world.time;
  if (level > 0) world.audio.siren(true);
  else world.audio.siren(false);
}
