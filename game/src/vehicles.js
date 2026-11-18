// Vehicles: the player's car and motorbike, NPC traffic on road loops, and
// carjacking. Driving is arcade: accelerate, steer, brake, handbrake drift;
// the bike leans into corners. Traffic follows rectangular road loops.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { collideCircle, nearestRoadPoint } from './city.js';
import { spawnWalker } from './pedestrians.js';

const CAR_COLORS = [0xc0392b, 0x2471a3, 0xf2c94c, 0x7d3c98, 0xdddddd, 0x222222, 0x229954, 0xe67e22];
const BIKE_COLORS = [0xe74c3c, 0x1abc9c, 0xf39c12];

function buildCarBody(color, isPolice = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), paint);
  body.position.y = 0.65; g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 2.2),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0x111111 : 0x1a2733 }),
  );
  cabin.position.set(0, 1.35, -0.2); g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-1.05, 1.45], [1.05, 1.45], [-1.05, -1.45], [1.05, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.42, z); g.add(w);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), headMat);
    h.position.set(x, 0.7, 2.21); g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const x of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), tailMat);
    t.position.set(x, 0.7, -2.21); g.add(t);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    bar.position.set(0, 1.85, -0.2); g.add(bar);
    g.userData.lightBar = bar;
  }
  return g;
}

function buildBike(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.1), paint);
  body.position.y = 0.75; g.add(body);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.9), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  seat.position.set(0, 1.0, -0.4); g.add(seat);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.22, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const z of [0.85, -0.85]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(0, 0.38, z); g.add(w);
  }
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  lamp.position.set(0, 0.8, 1.06); g.add(lamp);
  return g;
}

function makeVehicle(scene, kind, color, x, z, heading) {
  const mesh = kind === 'bike' ? buildBike(color) : buildCarBody(color, kind === 'police');
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    kind, mesh, color,
    pos: mesh.position,
    heading, speed: 0, steer: 0,
    driver: null, // 'player' | 'npc' | null
    alive: true, tirePopped: false,
  };
}

export function createVehicles(scene, rng, city) {
  const v = {
    list: [], traffic: [], playerCar: null, playerBike: null,
    playerVehicle: null, nearestCar: null,
  };
  // The player's own car and bike, parked near the spawn.
  v.playerCar = makeVehicle(scene, 'car', 0xc0392b, city.spawn.car.x, city.spawn.car.z, 0);
  v.playerCar.driver = null;
  v.list.push(v.playerCar);
  v.playerBike = makeVehicle(scene, 'bike', 0xe74c3c, city.spawn.bike.x, city.spawn.bike.z, 0.6);
  v.list.push(v.playerBike);

  // NPC traffic on rectangular loops along the road grid.
  const roads = city.roadLines;
  for (let i = 0; i < CONFIG.traffic.count; i += 1) {
    const r1 = rng.pick(roads), r2 = rng.pick(roads);
    const loop = { minX: Math.min(r1, r2), maxX: Math.max(r1, r2), minZ: -256, maxZ: 256 };
    if (Math.abs(r1 - r2) < 64) { loop.minZ = Math.min(r1, r2); loop.maxZ = Math.max(r1, r2); loop.minX = -256; loop.maxX = 256; }
    const x = rng.range(loop.minX + 8, loop.maxX - 8);
    const z = rng.range(loop.minZ + 8, loop.maxZ - 8);
    const car = makeVehicle(scene, 'car', rng.pick(CAR_COLORS), x, z, rng.range(0, Math.PI * 2));
    car.driver = 'npc';
    car.loop = loop;
    car.loopDir = rng.chance(0.5) ? 1 : -1;
    car.targetSpeed = CONFIG.traffic.speed * rng.range(0.8, 1.15);
    v.list.push(car);
    v.traffic.push(car);
  }
  return v;
}

// Drive one vehicle with arcade physics. Returns distance travelled.
function driveVehicle(world, veh, dt, throttle, steerInput, brake) {
  const cfg = veh.kind === 'bike' ? CONFIG.bike : CONFIG.car;
  const maxSpd = (veh.tirePopped ? CONFIG.police.spikeSlow : 1) * cfg.maxSpeed;
  if (throttle > 0) veh.speed += cfg.accel * throttle * dt;
  if (throttle < 0) veh.speed += cfg.reverseAccel * throttle * dt;
  if (brake) veh.speed -= Math.sign(veh.speed) * cfg.brake * dt;
  veh.speed -= veh.speed * cfg.drag * dt * 0.4;
  veh.speed = Math.max(-cfg.maxReverse || -12, Math.min(maxSpd, veh.speed));
  if (Math.abs(veh.speed) < 0.05 && throttle === 0) veh.speed = 0;
  const steerAngle = steerInput * cfg.steer * Math.min(1, Math.abs(veh.speed) / 8 + 0.25);
  veh.heading += steerAngle * (veh.speed / Math.max(6, Math.abs(veh.speed))) * dt * (veh.speed >= 0 ? 1 : -1);
  const nx = veh.pos.x + Math.sin(veh.heading) * veh.speed * dt;
  const nz = veh.pos.z + Math.cos(veh.heading) * veh.speed * dt;
  const res = collideCircle(world.city, nx, nz, cfg.radius);
  if (res.hit && Math.abs(veh.speed) > 6) {
    veh.speed *= 0.45;
    world.events.push({ type: 'crash', at: veh.pos.clone() });
  }
  veh.pos.x = res.x; veh.pos.z = res.z;
  veh.mesh.rotation.y = veh.heading;
  if (veh.kind === 'bike') {
    // Lean into the turn.
    const targetLean = -steerInput * CONFIG.bike.lean * Math.min(1, Math.abs(veh.speed) / 20);
    veh.mesh.rotation.z += (targetLean - veh.mesh.rotation.z) * Math.min(1, dt * 8);
  }
  return Math.abs(veh.speed) * dt;
}

function updateTraffic(world, dt) {
  const { vehicles } = world;
  for (const car of vehicles.traffic) {
    if (!car.alive || car.driver !== 'npc') continue;
    // Follow the loop rectangle: pick the nearest edge, drive along it.
    const l = car.loop;
    const px = car.pos.x, pz = car.pos.z;
    // Choose target corner ahead based on loop direction.
    const corners = [
      [l.minX, l.minZ], [l.maxX, l.minZ], [l.maxX, l.maxZ], [l.minX, l.maxZ],
    ];
    let best = null; let bestD = Infinity;
    for (const [cx, cz] of corners) {
      const d = (cx - px) ** 2 + (cz - pz) ** 2;
      if (d < bestD) { bestD = d; best = [cx, cz]; }
    }
    // Drive toward the next corner in loop order.
    const idx = corners.findIndex(([cx, cz]) => cx === best[0] && cz === best[1]);
    const nextIdx = (idx + (car.loopDir > 0 ? 1 : 3)) % 4;
    const [tx, tz] = corners[nextIdx];
    const want = Math.atan2(tx - px, tz - pz);
    let dh = want - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dh * 1.5));
    // Slow down if a vehicle is right ahead.
    let throttle = 1;
    for (const other of vehicles.list) {
      if (other === car || !other.alive) continue;
      const dx = other.pos.x - px, dz = other.pos.z - pz;
      const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
      const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
      if (ahead > 0 && ahead < CONFIG.traffic.minGap && side < 3) { throttle = 0; break; }
    }
    driveVehicle(world, car, dt, throttle, steer, false);
    car.speed = Math.min(car.speed, car.targetSpeed);
  }
}

export function updateVehicles(world, dt, input) {
  const { vehicles, player } = world;
  updateTraffic(world, dt);
  const veh = vehicles.playerVehicle;
  if (veh && player.inVehicle) {
    const throttle = (input.forward ? 1 : 0) - (input.back ? 0.7 : 0);
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    driveVehicle(world, veh, dt, throttle, steer, input.handbrake);
    player.pos.copy(veh.pos);
    player.heading = veh.heading;
    world.speedKmh = Math.abs(veh.speed) * 3.6;
  } else {
    world.speedKmh = 0;
  }
  // Nearest drivable car for the E prompt / carjacking.
  let best = null; let bestD = 9;
  for (const car of vehicles.list) {
    if (!car.alive || car.driver === 'player' || car.driver === 'police') continue;
    const d = car.pos.distanceTo(player.pos);
    if (d < bestD) { bestD = d; best = car; }
  }
  vehicles.nearestCar = best;
}

export function enterVehicle(world, veh) {
  const { vehicles, player, audio } = world;
  if (veh.driver === 'npc') {
    // Carjacking: the driver flees on foot, the heat rises.
    veh.driver = 'player';
    world.police.addHeat(world, CONFIG.police.heatPerCrime.stealCar);
    world.hud.toast('Mobil dibajak! Polisi mengejar.');
    world.pedestrians.spawnWalker(world.pedestrians, veh.pos.x + 2, veh.pos.z + 2, true);
    audio.horn();
  } else {
    veh.driver = 'player';
  }
  vehicles.playerVehicle = veh;
  player.inVehicle = true;
  player.vehicle = veh;
  player.mesh.visible = false;
  audio.blip();
}

export function exitVehicle(world) {
  const { vehicles, player } = world;
  const veh = vehicles.playerVehicle;
  if (!veh) return;
  veh.driver = null;
  veh.speed = 0;
  vehicles.playerVehicle = null;
  player.inVehicle = false;
  player.vehicle = null;
  player.pos.set(veh.pos.x + 2.5, 0, veh.pos.z + 2.5);
  player.mesh.visible = true;
}
