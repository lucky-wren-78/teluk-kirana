// police.js — the Patroli Kirana: the wanted system and everyone who answers
// it. Heat rises with crimes and cools when the player behaves; stars follow
// heat. Police cars hunt with a seek-and-ram driving model, foot patrols are
// implied by the busted radius, and from four stars a helicopter joins with a
// spotlight.

import * as THREE from '../vendor/three.module.min.js';
import { HEAT_STARS, TUNING, starsForHeat } from './config.js';
import { boxPart, coloredMesh, cylinderPart } from './geometry.js';
import { angleDelta, clamp, distance2d } from './random.js';
import { createVehicle, driveVehicle } from './vehicles.js';

export function buildHelicopter() {
  const group = new THREE.Group();
  const body = coloredMesh([
    boxPart(2.2, 1.9, 4.6, 0xf3ead8, 0, 0, 0.3),
    boxPart(2.0, 1.1, 1.2, 0x223844, 0, 0.25, 2.6),
    boxPart(0.5, 0.5, 4.6, 0x2f5fb3, 0, 0.25, -4.2),
    boxPart(1.7, 0.9, 0.24, 0x2f5fb3, 0, 0.9, -6.4),
    boxPart(2.6, 0.16, 0.5, 0x2f5fb3, -1.1, -1.15, 0.6),
    boxPart(2.6, 0.16, 0.5, 0x2f5fb3, 1.1, -1.15, 0.6),
    cylinderPart(0.09, 0.09, 1.1, 6, 0x3a4149, 0, 1.25, 0.3),
  ]);
  group.add(body);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(10.5, 0.07, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x22262c }),
  );
  rotor.position.set(0, 1.85, 0.3);
  group.add(rotor);
  const tailRotor = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1.7, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x22262c }),
  );
  tailRotor.position.set(0.3, 0.9, -6.4);
  group.add(tailRotor);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(7.5, 30, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.13,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  cone.position.set(0, -15.8, 0.6);
  group.add(cone);
  group.userData.rotor = rotor;
  group.userData.tailRotor = tailRotor;
  group.visible = false;
  return group;
}

export function createPoliceForce(scene) {
  const helicopter = buildHelicopter();
  scene.add(helicopter);
  return {
    scene,
    cars: [],
    helicopter,
    heat: 0,
    calmTime: 0,
    bustedTimer: 0,
    nearestCopDistance: 999,
    heliActive: false,
    flashPhase: 0,
    get stars() { return starsForHeat(this.heat); },
    addHeat(amount, minStars = 0) {
      this.heat = Math.max(this.heat + amount, minStars > 0 ? HEAT_STARS[minStars] : 0);
      this.calmTime = 0;
    },
    setMinStars(minStars) {
      this.heat = Math.max(this.heat, HEAT_STARS[minStars] + 1);
      this.calmTime = 0;
    },
    clearHeat() {
      this.heat = 0;
      this.calmTime = 0;
      this.bustedTimer = 0;
    },
  };
}

// Spawn on a street ring around the player, out of immediate sight.
function spawnPoliceCar(force, playerPos, rng) {
  for (let tries = 0; tries < 10; tries++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(58, 88);
    let x = playerPos.x + Math.sin(angle) * dist;
    let z = playerPos.z + Math.cos(angle) * dist;
    // Snap to the nearest street line on one axis so they arrive by road.
    if (rng.chance(0.5)) x = Math.round(x / 60) * 60;
    else z = Math.round(z / 60) * 60;
    if (Math.abs(x) > 262 || Math.abs(z) > 262) continue;
    const car = createVehicle(
      force.scene, 'police', 0xf3ead8, x, z,
      Math.atan2(playerPos.x - x, playerPos.z - z),
    );
    car.driver = 'police';
    car.ai = { reverseTime: 0, lastX: x, lastZ: z, stillTime: 0 };
    force.cars.push(car);
    return car;
  }
  return null;
}

export function updatePolice(force, dt, ctx, rng, t) {
  const { playerPos, playerSpeed, colliders, allVehicles } = ctx;
  // Heat cools once the player stops committing crimes for a while.
  force.calmTime += dt;
  if (force.calmTime > TUNING.heatCalmDelay && force.heat > 0) {
    force.heat = Math.max(0, force.heat - TUNING.heatDecayPerSecond * dt);
  }
  const stars = force.stars;
  const desired = stars === 0 ? 0 : Math.min(TUNING.policeMaxCars, stars + 1);
  // Retire far-away units when the heat is gone; top up when it rises.
  for (let i = force.cars.length - 1; i >= 0; i--) {
    const car = force.cars[i];
    const d = distance2d(car.x, car.z, playerPos.x, playerPos.z);
    if ((stars === 0 && d > 55) || d > 230) {
      force.scene.remove(car.mesh);
      force.cars.splice(i, 1);
    }
  }
  while (force.cars.length < desired) {
    if (!spawnPoliceCar(force, playerPos, rng)) break;
  }

  force.flashPhase = (t * 2.6) % 1;
  force.nearestCopDistance = 999;
  let bustedPressure = false;
  for (const car of force.cars) {
    const d = distance2d(car.x, car.z, playerPos.x, playerPos.z);
    force.nearestCopDistance = Math.min(force.nearestCopDistance, d);
    // Light bar strobes.
    const red = car.mesh.userData.lightRed;
    const blue = car.mesh.userData.lightBlue;
    if (red && blue) {
      const phase = (force.flashPhase + car.id * 0.37) % 1;
      red.visible = phase < 0.5;
      blue.visible = phase >= 0.5;
    }
    if (stars === 0) {
      // Heat is gone: cruise away from the player and despawn.
      const away = Math.atan2(car.x - playerPos.x, car.z - playerPos.z);
      const steer = clamp(angleDelta(car.heading, away) * 1.6, -1, 1);
      driveVehicle(car, d < 30 ? 0.7 : 0.35, steer, false, dt, colliders, allVehicles);
      continue;
    }
    // Hunt: aim at the player, leading a moving car a little.
    const lead = clamp(d / 26, 0, 1.1);
    const tx = playerPos.x + (ctx.playerVelX || 0) * lead;
    const tz = playerPos.z + (ctx.playerVelZ || 0) * lead;
    const want = Math.atan2(tx - car.x, tz - car.z);
    const delta = angleDelta(car.heading, want);
    let throttle = Math.abs(delta) > 1.9 ? -0.6 : 1;
    let steer = clamp(delta * 1.9, -1, 1);
    if (car.ai.reverseTime > 0) {
      car.ai.reverseTime -= dt;
      throttle = -1;
      steer = -steer;
    }
    // Pin the player, don't run them over.
    if (d < 8 && playerSpeed < 2.5) throttle = Math.min(throttle, 0.12);
    if (d < 26) throttle = Math.min(throttle, 0.85);
    const beforeX = car.x;
    const beforeZ = car.z;
    driveVehicle(car, throttle, steer, false, dt, colliders, allVehicles);
    // Unstick: if we barely moved while trying, back up and try again.
    const moved = distance2d(car.x, car.z, beforeX, beforeZ);
    if (Math.abs(car.speed) > 2 && moved < 0.35 * dt * 10) car.ai.stillTime += dt;
    else car.ai.stillTime = 0;
    if (car.ai.stillTime > 0.9) {
      car.ai.reverseTime = 0.75;
      car.ai.stillTime = 0;
    }
    if (d < TUNING.bustedRadius + 1.6 && playerSpeed < 1.4) bustedPressure = true;
  }

  // Busted pressure builds while a unit pins a slow player.
  if (bustedPressure && stars > 0) force.bustedTimer += dt;
  else force.bustedTimer = Math.max(0, force.bustedTimer - dt * 1.6);
  if (force.bustedTimer >= TUNING.bustedSeconds && ctx.onBusted) ctx.onBusted();

  // Helicopter from four stars: it orbits the player and paints them with light.
  force.heliActive = stars >= 4;
  const heli = force.helicopter;
  heli.visible = force.heliActive;
  if (force.heliActive) {
    const orbit = t * 0.32;
    const hx = playerPos.x + Math.sin(orbit) * 15;
    const hz = playerPos.z + Math.cos(orbit) * 15;
    heli.position.set(hx, 27 + Math.sin(t * 1.3) * 1.2, hz);
    heli.rotation.y = Math.atan2(playerPos.x - hx, playerPos.z - hz);
    heli.userData.rotor.rotation.y = t * 31;
    heli.userData.tailRotor.rotation.x = t * 40;
  }
}
