// vehicles.js - car factory plus the traffic system for Teluk Kirana.
// Cars are built from boxes and cylinders: a rounded body, a cabin,
// four wheels, glowing head and tail lights. Traffic cars follow the
// road grid in loops and brake when the car ahead is too close.

import * as THREE from 'three';
import { GRID, PITCH, CITY_HALF, gridToWorld, CAR_COLORS } from './config.js';
import { clamp, turnToward, angleDelta, distance2d } from './rng.js';

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17181c });
const glassMat = new THREE.MeshPhongMaterial({ color: 0x22384a, shininess: 90 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });

// Build one car mesh. Options: color, police livery, taxi sign.
export function buildCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ color, shininess: 70 });

  // Lower body with slightly rounded feel via a second sloped hood box.
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.55, 4.3), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 1.1), paint);
  hood.position.set(0, 0.78, 1.75);
  hood.rotation.x = 0.1;
  group.add(hood);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.05, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.08, 1.9), paint);
  roof.position.set(0, 1.36, -0.25);
  group.add(roof);

  // Wheels.
  const wheels = [];
  for (const [sx, sz] of [[-0.85, 1.42], [0.85, 1.42], [-0.85, -1.42], [0.85, -1.42]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx, 0.36, sz);
    group.add(wheel);
    wheels.push(wheel);
  }

  // Lights.
  for (const sx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), headMat);
    head.position.set(sx, 0.62, 2.16);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), tailMat);
    tail.position.set(sx, 0.66, -2.16);
    group.add(tail);
  }

  if (opts.police) {
    // White doors band and a red/blue light bar that flashes.
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.3, 2.2),
      new THREE.MeshPhongMaterial({ color: 0xf2f4f6, shininess: 60 }),
    );
    band.position.y = 0.58;
    group.add(band);
    const barBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x22242a }),
    );
    barBase.position.set(0, 1.46, -0.25);
    group.add(barBase);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x2255ff });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.36), redMat);
    red.position.set(-0.31, 1.58, -0.25);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.36), blueMat);
    blue.position.set(0.31, 1.58, -0.25);
    group.add(blue);
    group.userData.lightbar = { redMat, blueMat };
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.12, 4.32),
      new THREE.MeshLambertMaterial({ color: 0x2456c8 }),
    );
    stripe.position.y = 0.34;
    group.add(stripe);
  }

  if (opts.taxi) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xffd23c }),
    );
    sign.position.set(0, 1.5, -0.25);
    group.add(sign);
  }

  group.userData.wheels = wheels;
  return group;
}

// A traffic car state object.
export function makeTrafficCar(scene, rng, colliders) {
  const color = rng.pick(CAR_COLORS);
  const taxi = rng.chance(0.14);
  const mesh = buildCarMesh(taxi ? 0xf2b13c : color, { taxi });
  scene.add(mesh);
  // Pick a random road loop: choose an axis-aligned circuit.
  const car = {
    mesh,
    x: 0, z: 0, heading: 0, speed: 0,
    cruise: rng.range(9, 14),
    health: 100,
    driverFleeing: 0,
    isTaxi: taxi,
    route: [],
    routeIdx: 0,
    stuck: 0,
    honkAt: 0,
  };
  resetTrafficRoute(car, rng, true);
  return car;
}

// Give a traffic car a fresh rectangular loop around one block ring.
export function resetTrafficRoute(car, rng, anywhere = false) {
  const gx = rng.int(0, GRID - 2);
  const gz = rng.int(0, GRID - 2);
  const x0 = gridToWorld(gx);
  const x1 = gridToWorld(gx + 1);
  const z0 = gridToWorld(gz);
  const z1 = gridToWorld(gz + 1);
  const lane = 3.1; // right-hand lane offset
  // Drive the ring clockwise in road space.
  car.route = [
    { x: x1 - lane, z: z0 + lane, dir: 0 },
    { x: x1 - lane, z: z1 - lane, dir: 1 },
    { x: x0 + lane, z: z1 - lane, dir: 2 },
    { x: x0 + lane, z: z0 + lane, dir: 3 },
  ];
  car.routeIdx = rng.int(0, 3);
  if (anywhere) {
    const node = car.route[car.routeIdx];
    const next = car.route[(car.routeIdx + 1) % 4];
    const t = rng.float();
    car.x = node.x + (next.x - node.x) * t;
    car.z = node.z + (next.z - node.z) * t;
    car.heading = Math.atan2(next.x - node.x, next.z - node.z);
  }
  placeCarMesh(car);
}

export function placeCarMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
}

// Update all traffic cars for one frame.
export function updateTraffic(cars, dt, obstacles, onHonk) {
  for (const car of cars) {
    if (car.driverFleeing > 0) {
      // The driver bailed out after a carjacking attempt: car rolls to a stop.
      car.speed = Math.max(0, car.speed - 10 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      placeCarMesh(car);
      continue;
    }
    if (car.parked) { placeCarMesh(car); continue; }

    const target = car.route[(car.routeIdx + 1) % 4];
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 3.2) {
      car.routeIdx = (car.routeIdx + 1) % 4;
    }
    const wantHeading = Math.atan2(dx, dz);
    car.heading = turnToward(car.heading, wantHeading, 1.7 * dt);

    // Look ahead: slow down if something is close in front.
    const fx = car.x + Math.sin(car.heading) * 6;
    const fz = car.z + Math.cos(car.heading) * 6;
    let blocked = false;
    for (const o of obstacles) {
      if (o === car) continue;
      if (distance2d(fx, fz, o.x, o.z) < 3.4) { blocked = true; break; }
    }
    const wantSpeed = blocked ? 0 : car.cruise;
    if (blocked && car.speed > 2 && onHonk && Math.random() < 0.01) onHonk(car);
    car.speed += clamp(wantSpeed - car.speed, -22 * dt, 7 * dt);
    if (Math.abs(car.speed) < 0.05 && blocked) car.stuck += dt; else car.stuck = 0;

    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.x = clamp(car.x, -CITY_HALF - PITCH / 2, CITY_HALF + PITCH / 2);
    car.z = clamp(car.z, -CITY_HALF - PITCH / 2, CITY_HALF + PITCH / 2);

    // Spin the wheels with speed.
    const wheels = car.mesh.userData.wheels;
    if (wheels) for (const w of wheels) w.rotation.x += car.speed * dt * 1.4;
    placeCarMesh(car);
  }
}

// Spawn a row of parked cars along block edges.
export function spawnParkedCars(scene, rng, count) {
  const parked = [];
  let tries = 0;
  while (parked.length < count && tries < count * 30) {
    tries++;
    const horizontal = rng.chance(0.5);
    const line = gridToWorld(rng.int(0, GRID - 1));
    const along = rng.range(-CITY_HALF, CITY_HALF);
    const side = rng.sign() * (3.9);
    const x = horizontal ? along : line + side;
    const z = horizontal ? line + side : along;
    let clear = true;
    for (const p of parked) if (distance2d(x, z, p.x, p.z) < 6) { clear = false; break; }
    if (!clear) continue;
    const taxi = rng.chance(0.1);
    const mesh = buildCarMesh(taxi ? 0xf2b13c : rng.pick(CAR_COLORS), { taxi });
    scene.add(mesh);
    const car = {
      mesh, x, z,
      heading: horizontal ? Math.PI / 2 * rng.sign() : (rng.chance(0.5) ? 0 : Math.PI),
      speed: 0, cruise: 0, health: 100, parked: true, isTaxi: taxi,
      route: [], routeIdx: 0, driverFleeing: 0, stuck: 0,
    };
    if (!horizontal) car.heading = rng.chance(0.5) ? 0 : Math.PI;
    else car.heading = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    placeCarMesh(car);
    parked.push(car);
  }
  return parked;
}

// Damage helper shared by combat and collisions.
export function damageCar(car, amount) {
  car.health -= amount;
  if (car.health < 30 && !car.smoking) {
    car.smoking = true;
  }
  return car.health <= 0;
}
