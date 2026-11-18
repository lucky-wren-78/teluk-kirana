// Teluk Kirana — the law: a 1–5 star wanted system, patrol cars that
// hunt the player, a helicopter with a real searchlight from 3 stars,
// and striped roadblocks with spike strips at 4–5 stars.
//
// The helicopter light is three things at once, deliberately: a physical
// SpotLight (intensity in the thousands — r160 uses candela-style units),
// a translucent beam cone, and a bright pool disc that tracks the player
// on the ground. Any one of them alone can vanish in a render; together
// the beam always reads on screen.
import * as THREE from 'three';
import { CONFIG, clampNumber } from './config.js';
import { makeCarMesh } from './vehicles.js';

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.wanted = 0;
    this.heat = 0;
    this.cars = [];
    this.roadblocks = [];
    this.spikes = [];
    this.spawnTimer = 0;
    this.heli = null;
    this.heliAngle = 0;
    this.heliAltitude = 40;
    this.heliFrozen = false;
    this.cruiseCap = 0; // screenshot staging: cap chase speed so staged cars trail the subject
    this.sirenOn = false;
    this.bustedTimer = 0;
  }

  addHeat(amount) {
    this.heat = clampNumber(this.heat + amount, 0, 100);
    this.wanted = Math.min(CONFIG.maxWanted, Math.ceil(this.heat / 20));
  }

  setWanted(level) {
    this.wanted = clampNumber(Math.round(level), 0, CONFIG.maxWanted);
    this.heat = this.wanted * 20;
  }

  buildHeli() {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: 0x16283f, roughness: 0.35, metalness: 0.45 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.5, 4.8), paint);
    body.castShadow = true;
    g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.3, 4.84),
      new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.4 }));
    stripe.position.y = -0.25;
    g.add(stripe);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.85, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.08, metalness: 0.6 }));
    glass.position.set(0, 0.22, 1.85);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), paint);
    tail.position.set(0, 0.32, -4.4);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.7), paint);
    fin.position.set(0, 0.7, -6.4);
    g.add(fin);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.07, 0.72),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 }));
    rotor.position.y = 1.05;
    g.add(rotor);
    for (const s of [-0.9, 0.9]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6),
        new THREE.MeshStandardMaterial({ color: 0x39424c, roughness: 0.5, metalness: 0.6 }));
      skid.rotation.x = Math.PI / 2;
      skid.position.set(s, -1.05, 0);
      g.add(skid);
    }
    const spot = new THREE.SpotLight(0xfff6d8, 3200, 170, 0.42, 0.45, 1.1);
    spot.position.set(0, -0.85, 0.5);
    const target = new THREE.Object3D();
    target.position.set(0, -40, 0);
    g.add(target);
    spot.target = target;
    g.add(spot);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(6.8, 42, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.085, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.rotation.x = Math.PI;
    cone.position.set(0, -21.5, 0.5);
    g.add(cone);
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(6.8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.34, depthWrite: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, -39.5, 0.5);
    g.add(pool);
    g.visible = false;
    this.scene.add(g);
    this.heli = { group: g, rotor, spot, cone, pool };
    return this.heli;
  }

  spawnPoliceCar(x, z) {
    const mesh = makeCarMesh(0x16283f, 'sedan');
    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.34, 1.7),
      new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.4 }));
    doorPanel.position.set(0, 0.66, -0.2);
    mesh.add(doorPanel);
    const barMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2.2 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.17, 0.42), barMat);
    bar.position.set(0, 1.56, -0.25);
    mesh.add(bar);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const car = { mesh, x, z, heading: 0, speed: 0, barMat };
    this.cars.push(car);
    return car;
  }

  makeRoadblock(x, z, heading) {
    const g = new THREE.Group();
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff6a2a, roughness: 0.65, emissive: 0xa63e00, emissiveIntensity: 0.95 });
    for (const off of [-4.2, 0, 4.2]) {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.15, 0.55), stripeMat);
      barrier.position.set(off, 0.58, 0);
      barrier.castShadow = true;
      g.add(barrier);
      const lampDot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0xffaa00, emissiveIntensity: 2.4 }));
      lampDot.position.set(off, 1.3, 0);
      g.add(lampDot);
    }
    const spike = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x3c4148, metalness: 0.85, roughness: 0.3 }));
    spike.position.set(0, 0.09, 3.4);
    g.add(spike);
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    this.scene.add(g);
    const block = { group: g, x, z, heading };
    this.roadblocks.push(block);
    // Spike strip world position (the strip sits 3.4 ahead of the group).
    this.spikes.push({
      x: x + Math.sin(heading) * 3.4,
      z: z + Math.cos(heading) * 3.4,
    });
    return block;
  }

  clearRoadblocks() {
    for (const b of this.roadblocks) this.scene.remove(b.group);
    this.roadblocks = [];
    this.spikes = [];
  }

  update(dt, playerPos, playerVehicle, onSpiked) {
    if (this.wanted > 0) {
      this.heat = Math.max(0, this.heat - dt * 0.5);
      const cooled = Math.ceil(this.heat / 20);
      if (cooled < this.wanted) {
        this.wanted = cooled;
        if (this.wanted < 3 && this.heli) this.heli.group.visible = false;
        if (this.wanted < 4) this.clearRoadblocks();
      }
    }
    this.sirenOn = this.wanted > 0;

    this.spawnTimer -= dt;
    if (this.wanted > 0 && this.cars.length < this.wanted + 1 && this.spawnTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      this.spawnPoliceCar(playerPos.x + Math.sin(a) * 58, playerPos.z + Math.cos(a) * 58);
      this.spawnTimer = 2.1;
    }
    for (const car of this.cars) {
      const dx = playerPos.x - car.x;
      const dz = playerPos.z - car.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += clampNumber(diff, -2.5 * dt, 2.5 * dt);
      let chaseSpeed = this.wanted >= 3 ? 31 : 23;
      if (this.cruiseCap > 0) chaseSpeed = Math.min(chaseSpeed, this.cruiseCap);
      car.speed += (chaseSpeed - car.speed) * Math.min(1, dt * 1.25);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      car.barMat.emissive.setHex(Math.sin(performance.now() / 110) > 0 ? 0xff2222 : 0x2255ff);
      if (playerVehicle && dist < 3.3) {
        playerVehicle.speed *= 0.93;
        this.addHeat(dt * 2);
      }
      if (!playerVehicle && dist < 1.7) this.bustedTimer += dt;
      else this.bustedTimer = Math.max(0, this.bustedTimer - dt * 1.5);
    }
    if (this.wanted === 0 && this.cars.length) {
      for (const car of this.cars) this.scene.remove(car.mesh);
      this.cars = [];
    }

    if (this.wanted >= 3) {
      if (!this.heli) this.buildHeli();
      const h = this.heli;
      const alt = this.heliAltitude;
      h.group.visible = true;
      if (!this.heliFrozen) this.heliAngle += dt * 0.5;
      const hx = playerPos.x + Math.sin(this.heliAngle) * 25;
      const hz = playerPos.z + Math.cos(this.heliAngle) * 25;
      h.group.position.set(hx, alt, hz);
      h.group.rotation.y = Math.atan2(playerPos.x - hx, playerPos.z - hz);
      h.rotor.rotation.y += dt * 24;
      h.spot.target.position.set(playerPos.x - hx, -alt, playerPos.z - hz);
      h.spot.target.updateMatrixWorld();
      h.spot.intensity = 3200;
      h.cone.scale.y = alt / 42;
      h.cone.position.set(0, -alt / 2, 0.5);
      h.pool.position.set(playerPos.x - hx, -(alt - 0.6), playerPos.z - hz);
    } else if (this.heli) {
      this.heli.group.visible = false;
      this.heli.spot.intensity = 0;
    }

    if (this.wanted >= 4 && this.roadblocks.length === 0 && !this.suppressBlocks) {
      const ahead = playerVehicle ? playerVehicle.heading : 0;
      for (let i = 0; i < 2; i++) {
        const bx = playerPos.x + Math.sin(ahead + i * 0.9) * 44;
        const bz = playerPos.z + Math.cos(ahead + i * 0.9) * 44;
        this.makeRoadblock(bx, bz, ahead);
      }
    }
    if (playerVehicle && !playerVehicle.spiked) {
      for (const s of this.spikes) {
        const dx = playerVehicle.x - s.x;
        const dz = playerVehicle.z - s.z;
        if (dx * dx + dz * dz < 10) {
          playerVehicle.spiked = true;
          if (onSpiked) onSpiked();
        }
      }
    }
  }
}
