// player.js - the player character and driving for Teluk Kirana.
// On foot the player is a simple colourful capsule figure who walks
// and sprints with WASD. Pressing E near a car enters it (stealing it
// when it has a driver). Driving is arcade style: accelerate, brake,
// steer, with simple collision response against buildings and cars.

import * as THREE from 'three';
import { PLAYER, DRIVE, WORLD_EDGE } from './config.js';
import { clamp, lerp, turnToward, distance2d } from './rng.js';
import { collideCircle, clampToWorld } from './city.js';

// Build the on-foot character: legs, torso, arms and a head.
export function buildPlayerMesh() {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xe4572e });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.72;
  group.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.23, 0.1, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2b13c }),
  );
  cap.position.y = 1.88;
  group.add(cap);
  const legs = [];
  for (const sx of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.24), pants);
    leg.position.set(sx, 0.4, 0);
    group.add(leg);
    legs.push(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.18), shirt);
    arm.position.set(sx * 2.4, 1.14, 0);
    group.add(arm);
    legs.push(arm);
  }
  group.userData.limbs = legs;
  return group;
}

export class Player {
  constructor(scene, startX, startZ) {
    this.mesh = buildPlayerMesh();
    this.mesh.position.set(startX, 0, startZ);
    scene.add(this.mesh);
    this.x = startX;
    this.z = startZ;
    this.heading = Math.PI; // face south toward the harbour
    this.health = PLAYER.maxHealth;
    this.lastHurtAt = -99;
    this.car = null;        // the car being driven, or null on foot
    this.walkPhase = 0;
    this.speedNow = 0;      // for the HUD speedometer
    this.dead = false;
    // Driving state lives here so any car can be driven.
    this.throttle = 0;
    this.steer = 0;
    this.carSpeed = 0;
  }

  get pos() {
    if (this.car) return { x: this.car.x, z: this.car.z };
    return { x: this.x, z: this.z };
  }

  get visiblePos() {
    return this.pos;
  }

  hurt(amount, now) {
    if (this.dead) return;
    this.health -= amount;
    this.lastHurtAt = now;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  healFull() {
    this.health = PLAYER.maxHealth;
    this.dead = false;
  }

  // Enter a car. Returns true when it was a carjacking (car had a driver).
  enterCar(car) {
    const jacked = !car.parked;
    this.car = car;
    car.parked = false;
    car.driverFleeing = 0;
    this.carSpeed = car.speed || 0;
    this.mesh.visible = false;
    return jacked;
  }

  exitCar() {
    if (!this.car) return;
    const car = this.car;
    // Step out to the left side of the car.
    const sideX = Math.cos(car.heading) * -1.6;
    const sideZ = -Math.sin(car.heading) * -1.6;
    this.x = clampToWorld(car.x + sideX);
    this.z = clampToWorld(car.z + sideZ);
    this.heading = car.heading;
    car.speed = 0;
    this.car = null;
    this.carSpeed = 0;
    this.mesh.visible = true;
  }

  // Find the nearest enterable car within reach.
  nearestCar(cars, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      const d = distance2d(this.x, this.z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  update(dt, input, colliders, allCars, now) {
    // Slow health regeneration after a quiet spell.
    if (!this.dead && this.health > 0 && now - this.lastHurtAt > PLAYER.regenDelay) {
      this.health = Math.min(PLAYER.maxHealth, this.health + PLAYER.regenPerSecond * dt);
    }
    if (this.car) this.updateDriving(dt, input, colliders, allCars);
    else this.updateOnFoot(dt, input, colliders, now);
  }

  updateOnFoot(dt, input, colliders, now) {
    let mx = 0;
    let mz = 0;
    if (input.forward) mz += 1;
    if (input.back) mz -= 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    const sprint = input.sprint;
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    this.speedNow = moving ? speed : 0;
    if (moving) {
      // Movement is relative to the camera yaw stored on the input.
      const yaw = input.camYaw;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const wx = (mz * sin - mx * cos);
      const wz = (mz * cos - mx * sin);
      const len = Math.sqrt(wx * wx + wz * wz) || 1;
      const vx = (wx / len) * speed;
      const vz = (wz / len) * speed;
      let nx = this.x + vx * dt;
      let nz = this.z + vz * dt;
      const res = collideCircle(colliders, nx, nz, PLAYER.radius);
      nx = res.x;
      nz = res.z;
      this.x = clampToWorld(nx);
      this.z = clamp(nz, -WORLD_EDGE - 6, WORLD_EDGE + 40);
      this.heading = turnToward(this.heading, Math.atan2(vx, vz), 12 * dt);
      this.walkPhase += dt * (sprint ? 13 : 9);
    }
    this.mesh.position.set(this.x, Math.abs(Math.sin(this.walkPhase)) * 0.05, this.z);
    this.mesh.rotation.y = this.heading;
    // Swing the limbs while walking.
    const limbs = this.mesh.userData.limbs;
    if (limbs) {
      const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
      limbs[0].rotation.x = swing;
      limbs[1].rotation.x = -swing;
      limbs[2].rotation.x = -swing;
      limbs[3].rotation.x = swing;
    }
  }

  updateDriving(dt, input, colliders, allCars) {
    const car = this.car;
    let speed = this.carSpeed;
    const forward = Math.sign(speed) >= 0;
    if (input.forward) {
      speed += DRIVE.accel * dt * (1 - Math.max(0, speed) / (DRIVE.maxSpeed + 6));
    } else if (input.back) {
      if (speed > 0.6) speed -= DRIVE.brake * dt;
      else speed -= DRIVE.reverse * dt * (1 + Math.min(0, speed) / DRIVE.maxReverse);
    } else {
      speed -= speed * DRIVE.drag * dt;
      if (Math.abs(speed) < 0.08) speed = 0;
    }
    speed = clamp(speed, -DRIVE.maxReverse, DRIVE.maxSpeed);

    let steer = 0;
    if (input.left) steer += 1;
    if (input.right) steer -= 1;
    this.steer = lerp(this.steer, steer, 1 - Math.pow(0.0001, dt));
    const speedFactor = clamp(Math.abs(speed) / 8, 0, 1);
    const turnRate = DRIVE.gripTurn * this.steer * speedFactor * (forward ? 1 : -1);
    if (Math.abs(speed) > 0.2) car.heading += turnRate * dt * clamp(Math.abs(speed) / 10, 0.35, 1);

    let nx = car.x + Math.sin(car.heading) * speed * dt;
    let nz = car.z + Math.cos(car.heading) * speed * dt;

    // Collide with buildings: stop and bounce a little.
    const res = collideCircle(colliders, nx, nz, 1.7);
    if (res.hit) {
      if (Math.abs(speed) > 9) this.crashHurt = Math.abs(speed);
      speed *= -0.25;
      nx = res.x;
      nz = res.z;
    }
    // Collide with other cars: push and slow.
    for (const other of allCars) {
      if (other === car) continue;
      const d = distance2d(nx, nz, other.x, other.z);
      if (d < 3.1 && d > 0.001) {
        const push = (3.1 - d) / 2;
        const ux = (nx - other.x) / d;
        const uz = (nz - other.z) / d;
        nx += ux * push;
        nz += uz * push;
        other.x -= ux * push * 0.6;
        other.z -= uz * push * 0.6;
        if (Math.abs(speed) > 7) {
          this.crashHurt = Math.abs(speed) * 0.8;
          this.hitCar = other;
        }
        speed *= 0.55;
      }
    }
    car.x = clampToWorld(nx);
    car.z = clamp(nz, -WORLD_EDGE - 6, WORLD_EDGE + 40);
    car.speed = speed;
    this.carSpeed = speed;
    this.speedNow = Math.abs(speed) * 3.6; // km/h for the HUD
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const wheels = car.mesh.userData.wheels;
    if (wheels) for (const w of wheels) w.rotation.x += speed * dt * 1.4;
  }

  // Third person chase camera. mode is 'foot' or 'car'.
  updateCamera(camera, dt, input) {
    const p = this.pos;
    const dist = this.car ? 10.5 : 6.4;
    const height = this.car ? 3.6 : 2.6;
    const yaw = input.camYaw;
    const cx = p.x - Math.sin(yaw) * dist;
    const cz = p.z - Math.cos(yaw) * dist;
    const cy = height + Math.sin(input.camPitch) * 3;
    const blend = 1 - Math.pow(0.0001, dt);
    camera.position.x = lerp(camera.position.x, cx, blend);
    camera.position.y = lerp(camera.position.y, Math.max(1.2, cy), blend);
    camera.position.z = lerp(camera.position.z, cz, blend);
    camera.lookAt(p.x, 1.4, p.z);
  }

  // Hard-place the camera (used by screenshot scenes and teleports).
  snapCamera(camera, input) {
    const p = this.pos;
    const dist = this.car ? 10.5 : 6.4;
    const height = this.car ? 3.6 : 2.6;
    camera.position.set(
      p.x - Math.sin(input.camYaw) * dist,
      height,
      p.z - Math.cos(input.camYaw) * dist,
    );
    camera.lookAt(p.x, 1.4, p.z);
  }
}
