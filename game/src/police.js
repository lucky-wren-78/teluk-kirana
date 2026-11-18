// Teluk Kirana — wanted system and police response: patrol cars, a helicopter
// with a real spotlight, roadblocks and spike strips at 4–5 stars.
// Bug #5 fix: the helicopter spotlight is a THREE.SpotLight with intensity
// far above zero, a target that is added to the scene and re-aimed at the
// player every frame, plus a visible translucent cone and a light pool on
// the ground — the beam is unmissable in a night screenshot.
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
    this.heliSpot = null;
    this.heliCone = null;
    this.heliPool = null;
    this.heliAngle = 0;
    this.heliAltitude = 42;
    this.heliFrozen = false;
    this.sirenOn = false;
    this.bustedTimer = 0;
  }

  addHeat(amount) {
    this.heat = clampNumber(this.heat + amount, 0, 100);
    this.wanted = Math.min(CONFIG.maxWanted, Math.ceil(this.heat / 20));
  }

  setWanted(level) {
    this.wanted = clampNumber(level, 0, CONFIG.maxWanted);
    this.heat = this.wanted * 20;
  }

  makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.4 }));
    body.castShadow = true;
    g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.6 }));
    glass.position.set(0, 0.2, 1.8);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.4, metalness: 0.4 }));
    tail.position.set(0, 0.3, -4.2);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
    rotor.position.y = 1.0;
    g.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222222 }));
    tailRotor.position.set(0.4, 0.4, -6.2);
    g.add(tailRotor);
    // Spotlight: intensity 3000 (candela-scale, r160 physical lights), angle
    // 0.42 rad, penumbra 0.45 — MUST stay > 0 while the helicopter is up.
    const spot = new THREE.SpotLight(0xfff6d8, 3000, 160, 0.42, 0.45, 1.1);
    spot.position.set(0, -0.8, 0.5);
    const target = new THREE.Object3D();
    target.position.set(0, -40, 0);
    g.add(target);
    spot.target = target;
    g.add(spot);
    // Visible beam cone + ground pool so the light reads on screen.
    const coneGeo = new THREE.ConeGeometry(6.5, 42, 20, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.x = Math.PI;
    cone.position.set(0, -21.8, 0.5);
    g.add(cone);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(6.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.35, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, -41.5, 0.5);
    g.add(pool);
    g.visible = false;
    this.scene.add(g);
    this.heli = { group: g, rotor, spot, cone, pool };
    return this.heli;
  }

  spawnPoliceCar(x, z) {
    const mesh = makeCarMesh(0x1a2a4a, 'sedan');
    // police light bar
    const barMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff2222, emissiveIntensity: 2 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), barMat);
    bar.position.set(0, 1.55, -0.2);
    mesh.add(bar);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const car = { mesh, x, z, heading: 0, speed: 0, bar, barMat };
    this.cars.push(car);
    return car;
  }

  makeRoadblock(x, z, heading) {
    const g = new THREE.Group();
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff5522, roughness: 0.7 });
    for (const off of [-4, 0, 4]) {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 0.5), stripeMat);
      barrier.position.set(off, 0.55, 0);
      barrier.castShadow = true;
      g.add(barrier);
    }
    const spike = new THREE.Mesh(new THREE.BoxGeometry(6, 0.18, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.3 }));
    spike.position.set(0, 0.1, 3.2);
    g.add(spike);
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    this.scene.add(g);
    const block = { group: g, x, z, heading };
    this.roadblocks.push(block);
    this.spikes.push({ x, z: z + Math.cos(heading) * 3.2, z2: z, heading });
    return block;
  }

  clearRoadblocks() {
    for (const b of this.roadblocks) this.scene.remove(b.group);
    this.roadblocks = [];
    this.spikes = [];
  }

  update(dt, playerPos, playerVehicle, onSpiked) {
    // Wanted decays slowly when the player stays clean.
    if (this.wanted > 0) {
      this.heat = Math.max(0, this.heat - dt * 0.55);
      const next = Math.ceil(this.heat / 20);
      if (next < this.wanted) {
        this.wanted = next;
        if (this.wanted < 3 && this.heli) this.heli.group.visible = false;
        if (this.wanted < 4) this.clearRoadblocks();
      }
    }
    this.sirenOn = this.wanted > 0;

    // Patrol cars: spawn up to wanted count, chase the player.
    this.spawnTimer -= dt;
    if (this.wanted > 0 && this.cars.length < this.wanted && this.spawnTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      this.spawnPoliceCar(playerPos.x + Math.sin(a) * 55, playerPos.z + Math.cos(a) * 55);
      this.spawnTimer = 4;
    }
    for (const car of this.cars) {
      const dx = playerPos.x - car.x;
      const dz = playerPos.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const target = Math.atan2(dx, dz);
      let diff = target - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += clampNumber(diff, -2.4 * dt, 2.4 * dt);
      const wantSpeed = this.wanted >= 3 ? 30 : 22;
      car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.2);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      const blink = Math.sin(performance.now() / 120) > 0 ? 0xff2222 : 0x2244ff;
      car.barMat.emissive.setHex(blink);
      // Ram: if a police car touches the player vehicle, slow it and add heat.
      if (playerVehicle && dist < 3.2) {
        playerVehicle.speed *= 0.92;
        this.addHeat(dt * 2);
      }
      if (!playerVehicle && dist < 1.6) {
        this.bustedTimer += dt;
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt);
      }
    }
    // Prune police cars that fell far behind when wanted drops to 0.
    if (this.wanted === 0 && this.cars.length > 0) {
      for (const car of this.cars) this.scene.remove(car.mesh);
      this.cars = [];
    }

    // Helicopter from 3 stars up.
    if (this.wanted >= 3) {
      if (!this.heli) this.makeHeli();
      const h = this.heli;
      const alt = this.heliAltitude;
      h.group.visible = true;
      if (!this.heliFrozen) this.heliAngle += dt * 0.55;
      const hx = playerPos.x + Math.sin(this.heliAngle) * 26;
      const hz = playerPos.z + Math.cos(this.heliAngle) * 26;
      h.group.position.set(hx, alt, hz);
      h.group.rotation.y = Math.atan2(playerPos.x - hx, playerPos.z - hz);
      h.rotor.rotation.y += dt * 22;
      // Spotlight target tracks the player every frame; intensity stays 3000.
      h.spot.target.position.set(playerPos.x - hx, -alt, playerPos.z - hz);
      h.spot.target.updateMatrixWorld();
      h.spot.intensity = 3000;
      // Beam cone hangs straight down from the helicopter, scaled to altitude;
      // the ground pool tracks the player, where the light actually lands.
      h.cone.scale.y = alt / 42;
      h.cone.position.set(0, -alt / 2, 0.5);
      h.pool.position.set(playerPos.x - hx, -(alt - 0.5), playerPos.z - hz);
    } else if (this.heli) {
      this.heli.group.visible = false;
      this.heli.spot.intensity = 0;
    }

    // Roadblocks + spike strips at 4–5 stars, ahead of the player.
    if (this.wanted >= 4 && this.roadblocks.length === 0) {
      const a = Math.atan2(playerPos.x, playerPos.z);
      for (let i = 0; i < 2; i++) {
        const bx = playerPos.x + Math.sin(a + i * 1.1) * 42;
        const bz = playerPos.z + Math.cos(a + i * 1.1) * 42;
        this.makeRoadblock(bx, bz, a + Math.PI / 2);
      }
    }
    // Spike strips flatten the player's tyres.
    if (playerVehicle && !playerVehicle.spiked) {
      for (const s of this.spikes) {
        const dx = playerVehicle.x - s.x;
        const dz = playerVehicle.z - s.z2;
        if (dx * dx + dz * dz < 9) {
          playerVehicle.spiked = true;
          if (onSpiked) onSpiked();
        }
      }
    }
  }
}
