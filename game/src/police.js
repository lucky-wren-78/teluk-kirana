// police.js - the wanted system and police response of Teluk Kirana.
// Crimes raise the wanted level from 1 to 5 stars. Police cars chase
// and ram the player; at 3 stars a helicopter joins with a spotlight.
// Staying unseen lets the heat cool down. On foot, being surrounded
// for a few seconds means arrest: a fine and a trip to the hospital.

import * as THREE from 'three';
import { WANTED, POI } from './config.js';
import { clamp, turnToward, distance2d } from './rng.js';
import { buildCarMesh, placeCarMesh } from './vehicles.js';
import { collideCircle } from './city.js';

// Build the police helicopter: body, tail, skids, spinning rotors
// and a spotlight cone that tracks the player.
export function buildHelicopter() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0x2c4a7c, shininess: 60 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 4.6), bodyMat);
  body.castShadow = true;
  group.add(body);
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 10, 8),
    new THREE.MeshPhongMaterial({ color: 0x9fd4e8, shininess: 90 }),
  );
  nose.position.set(0, -0.1, 2.2);
  nose.scale.set(1, 0.8, 1);
  group.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 4.4), bodyMat);
  tail.position.set(0, 0.25, -4.2);
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.3, 0.8), bodyMat);
  fin.position.set(0, 0.7, -6.3);
  group.add(fin);
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x22242a });
  for (const sx of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6), skidMat);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(sx, -1.35, 0);
    group.add(skid);
  }
  const rotorMat = new THREE.MeshBasicMaterial({ color: 0x1c1e24 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.06, 0.5), rotorMat);
  rotor.position.y = 1.25;
  group.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.3), rotorMat);
  tailRotor.position.set(0.3, 0.7, -6.3);
  group.add(tailRotor);

  // Visible spotlight cone plus a real spotlight.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.16,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7.5, 30, 18, 1, true), coneMat);
  cone.position.y = -15.8;
  group.add(cone);
  const spot = new THREE.SpotLight(0xfff2b0, 900, 90, 0.32, 0.5, 1.2);
  spot.position.set(0, -1, 0);
  group.add(spot);
  group.add(spot.target);
  spot.target.position.set(0, -30, 0);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(6.8, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  group.add(pool);

  group.userData = { rotor, tailRotor, pool, spot };
  group.visible = false;
  return group;
}

export class PoliceSystem {
  constructor(scene) {
    this.scene = scene;
    this.stars = 0;            // whole stars shown on the HUD
    this.heat = 0;             // fractional heat, stars = floor
    this.unseenFor = 0;
    this.cars = [];
    this.arrestTimer = 0;
    this.busted = false;
    this.heli = buildHelicopter();
    scene.add(this.heli);
    this.heliActive = false;
    this.time = 0;
  }

  // Register a crime. amount is in heat points (1.0 = one star).
  commitCrime(amount, seen = true) {
    this.heat = clamp(this.heat + amount, 0, 5.6);
    if (seen) this.unseenFor = 0;
    this.syncStars();
  }

  setStars(n) {
    this.heat = clamp(n, 0, 5.6);
    this.syncStars();
  }

  clear() {
    this.heat = 0;
    this.syncStars();
  }

  syncStars() {
    this.stars = clamp(Math.floor(this.heat + 0.001), 0, 5);
  }

  get copCountWanted() {
    return WANTED.copsPerStar[this.stars] || 0;
  }

  spawnCop(playerPos) {
    const mesh = buildCarMesh(0xf2f4f6, { police: true });
    this.scene.add(mesh);
    // Spawn on a road ring around the player, out of direct sight.
    const angle = Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 25;
    const car = {
      mesh,
      x: clamp(playerPos.x + Math.sin(angle) * dist, -260, 260),
      z: clamp(playerPos.z + Math.cos(angle) * dist, -260, 300),
      heading: Math.atan2(playerPos.x, playerPos.z),
      speed: 0, health: 100, police: true, parked: false,
      route: [], routeIdx: 0, driverFleeing: 0, stuck: 0, cruise: 20,
    };
    placeCarMesh(car);
    this.cars.push(car);
    return car;
  }

  despawnCop(car) {
    this.scene.remove(car.mesh);
    const idx = this.cars.indexOf(car);
    if (idx >= 0) this.cars.splice(idx, 1);
  }

  // Is any police unit close enough to see the player?
  canSee(playerPos, hidden) {
    if (hidden) return false;
    for (const car of this.cars) {
      if (distance2d(car.x, car.z, playerPos.x, playerPos.z) < 42) return true;
    }
    if (this.heliActive) return true;
    return false;
  }

  update(dt, player, colliders, now) {
    this.time = now;
    const p = player.pos;
    const seen = this.stars > 0 && this.canSee(p, player.car === null && false);

    // Heat decay while unseen.
    if (this.stars > 0) {
      if (seen) this.unseenFor = 0;
      else {
        this.unseenFor += dt;
        if (this.unseenFor > WANTED.seenGrace) {
          this.heat = Math.max(0, this.heat - WANTED.decayPerSecond * dt);
          this.syncStars();
        }
      }
    }

    // Keep the fleet at the wanted size.
    const wanted = this.copCountWanted;
    if (this.cars.length < wanted) this.spawnCop(p);
    while (this.cars.length > wanted) {
      // Remove the farthest cop when heat drops.
      let far = null;
      let farD = -1;
      for (const car of this.cars) {
        const d = distance2d(car.x, car.z, p.x, p.z);
        if (d > farD) { farD = d; far = car; }
      }
      if (far) this.despawnCop(far); else break;
    }
    // Respawn cops that fell too far behind.
    for (const car of [...this.cars]) {
      if (distance2d(car.x, car.z, p.x, p.z) > 190) {
        this.despawnCop(car);
        if (this.cars.length < wanted) this.spawnCop(p);
      }
    }

    // Drive the chase.
    const topSpeed = WANTED.copSpeedBase + WANTED.copSpeedPerStar * this.stars;
    for (const car of this.cars) {
      const dx = p.x - car.x;
      const dz = p.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const wantHeading = Math.atan2(dx, dz);
      car.heading = turnToward(car.heading, wantHeading, 2.1 * dt);
      let want = topSpeed;
      if (dist < 7) want = topSpeed * 0.35; // ease in for the ram block
      car.speed += clamp(want - car.speed, -30 * dt, 13 * dt);
      let nx = car.x + Math.sin(car.heading) * car.speed * dt;
      let nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const res = collideCircle(colliders, nx, nz, 1.7);
      nx = res.x;
      nz = res.z;
      car.x = nx;
      car.z = nz;
      placeCarMesh(car);
      const wheels = car.mesh.userData.wheels;
      if (wheels) for (const w of wheels) w.rotation.x += car.speed * dt * 1.4;
      // Flash the light bar.
      const bar = car.mesh.userData.lightbar;
      if (bar) {
        const phase = Math.floor(now * 6 + car.x) % 2 === 0;
        bar.redMat.color.setHex(phase ? 0xff2222 : 0x661111);
        bar.blueMat.color.setHex(phase ? 0x112266 : 0x3388ff);
      }
      // Ramming contact with the player.
      if (player.car && distance2d(car.x, car.z, p.x, p.z) < 3.4) {
        player.carSpeed *= 0.82;
        player.hurt(2.2, now);
      }
    }

    // Helicopter at 3 stars and up.
    this.heliActive = this.stars >= WANTED.heliFromStar;
    this.heli.visible = this.heliActive;
    if (this.heliActive) {
      const orbit = now * 0.35;
      const hx = p.x + Math.sin(orbit) * 16;
      const hz = p.z + Math.cos(orbit) * 16;
      this.heli.position.set(hx, 30, hz);
      this.heli.rotation.y = orbit + Math.PI / 2;
      const u = this.heli.userData;
      u.rotor.rotation.y += dt * 28;
      u.tailRotor.rotation.x += dt * 30;
      // The light pool sits on the ground under the player.
      u.pool.position.set(p.x - hx, -29.4, p.z - hz);
    }

    // Arrest check: on foot and surrounded.
    if (!player.car && this.stars > 0 && !player.dead) {
      let near = 0;
      for (const car of this.cars) {
        if (distance2d(car.x, car.z, p.x, p.z) < WANTED.arrestRadius) near++;
      }
      if (near >= 2 || (near >= 1 && this.stars >= 3)) {
        this.arrestTimer += dt;
        if (this.arrestTimer >= WANTED.arrestSeconds) {
          this.busted = true;
          this.arrestTimer = 0;
        }
      } else {
        this.arrestTimer = Math.max(0, this.arrestTimer - dt * 1.5);
      }
    } else {
      this.arrestTimer = 0;
    }
  }

  // Handle a bust: fine the player and reset the heat.
  applyBust(state) {
    const fine = WANTED.finePerStar * Math.max(1, this.stars);
    state.cash = Math.max(0, state.cash - fine);
    this.clear();
    this.busted = false;
    return fine;
  }

  hospitalPos() {
    return POI.hospital;
  }
}
