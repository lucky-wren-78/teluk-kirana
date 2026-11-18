// Teluk Kirana's city: five districts on a road grid, a harbour with water,
// cranes and docks, a market of stalls, lamps that glow after dark. Built
// once from the seeded RNG; every building also registers an AABB collider.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const HALF = CONFIG.worldSize / 2;
const ROADS = [-256, -192, -128, -64, 0, 64, 128, 192, 256];

function makeWindowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8d8578'; g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 8; x < 56; x += 14) {
      const lit = rng.chance(0.42);
      g.fillStyle = lit ? '#ffd27a' : '#20242e';
      g.fillRect(x, y, 9, 11);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, ...(opts.mat || {}) }),
  );
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  return m;
}

export function buildCity(scene, rng) {
  const city = {
    colliders: [], lamps: [], lampMats: [],
    roadLines: ROADS.slice(),
    spawn: {
      player: new THREE.Vector3(CONFIG.player.startPos.x, 0, CONFIG.player.startPos.z),
      car: new THREE.Vector3(14, 0, 96),
      bike: new THREE.Vector3(-8, 0, 104),
    },
    districtCenters: {},
    water: null, rainPoints: null,
  };
  for (const d of CONFIG.districts) city.districtCenters[d.id] = new THREE.Vector3(d.cx, 0, d.cz);

  const tex = makeWindowTexture(rng);
  const buildingMats = CONFIG.palette.building.map(
    (color) => new THREE.MeshLambertMaterial({ color, map: tex }),
  );

  // Ground, roads, sidewalks.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.worldSize, CONFIG.worldSize),
    new THREE.MeshLambertMaterial({ color: CONFIG.palette.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: CONFIG.palette.road });
  for (const r of ROADS) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.roadWidth, CONFIG.worldSize), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(r, 0.02, 0);
    scene.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.worldSize, CONFIG.roadWidth), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.02, r);
    scene.add(h);
  }
  // Centre dashes.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
  for (const r of ROADS) {
    for (let t = -HALF + 16; t < HALF; t += 32) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.6), dashMat);
      d.rotation.x = -Math.PI / 2; d.position.set(t, 0.04, r);
      scene.add(d);
    }
  }

  // Water south of the harbour + sand strip.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.worldSize + 400, 160),
    new THREE.MeshLambertMaterial({ color: CONFIG.palette.water, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, HALF + 80);
  scene.add(water);
  city.water = water;
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.worldSize, 10),
    new THREE.MeshLambertMaterial({ color: CONFIG.palette.sand }),
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.03, HALF - 2);
  scene.add(sand);

  // Buildings: one per block cell that is not a road and not inside water.
  const isRoad = (v) => ROADS.some((r) => Math.abs(v - r) < CONFIG.roadWidth / 2 + 6);
  const districtAt = (x, z) => CONFIG.districts.find(
    (d) => Math.abs(x - d.cx) <= d.hx && Math.abs(z - d.cz) <= d.hz,
  ) || CONFIG.districts[4];
  for (let gx = -HALF + 32; gx < HALF; gx += CONFIG.blockSize) {
    for (let gz = -HALF + 32; gz < HALF; gz += CONFIG.blockSize) {
      if (isRoad(gx) || isRoad(gz)) continue;
      if (gz > 224) continue; // harbour strip: docks, not blocks
      const d = districtAt(gx, gz);
      const n = d.id === 'downtown' ? rng.int(2, 4) : rng.int(1, 2);
      for (let i = 0; i < n; i += 1) {
        const w = rng.range(14, 26), dep = rng.range(14, 26);
        const h = rng.range(6, 8 + d.buildingMax * 7);
        const x = gx + rng.range(-12, 12), z = gz + rng.range(-12, 12);
        const mat = rng.pick(buildingMats);
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), mat);
        b.position.set(x, h / 2, z);
        scene.add(b);
        city.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dep / 2, maxZ: z + dep / 2, h });
        // Roof box for silhouette variety.
        if (rng.chance(0.5)) {
          const roof = box(w * 0.4, 2.5, dep * 0.4, '#5c564a', x + rng.range(-4, 4), h + 1.2, z);
          scene.add(roof);
        }
      }
      // A tree or two per block.
      if (rng.chance(0.7)) {
        const tx = gx + rng.range(-18, 18), tz = gz + rng.range(-18, 18);
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.7, 4, 6),
          new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
        );
        trunk.position.set(tx, 2, tz); scene.add(trunk);
        const top = new THREE.Mesh(
          new THREE.ConeGeometry(rng.range(2.5, 4), rng.range(5, 8), 7),
          new THREE.MeshLambertMaterial({ color: 0x2e7d4f }),
        );
        top.position.set(tx, 6.5, tz); scene.add(top);
      }
    }
  }

  // Harbour: docks, cranes, containers, boats.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x7a6a55 });
  for (const dx of [-180, -60, 60, 180]) {
    const dock = box(70, 1.2, 18, 0x7a6a55, dx, 0.6, 300);
    scene.add(dock);
    city.colliders.push({ minX: dx - 35, maxX: dx + 35, minZ: 291, maxZ: 309 });
  }
  for (const cx of [-220, -40, 140]) {
    // Crane: two legs, a beam, a hanging hook block.
    const craneMat = new THREE.MeshLambertMaterial({ color: 0xd86a2e });
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(3, 42, 3), craneMat);
    leg1.position.set(cx, 21, 268); scene.add(leg1);
    const leg2 = leg1.clone(); leg2.position.set(cx + 16, 21, 268); scene.add(leg2);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(44, 3, 3), craneMat);
    beam.position.set(cx + 8, 42, 268); scene.add(beam);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    hook.position.set(cx + 24, 30, 268); scene.add(hook);
  }
  const containerColors = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98];
  for (let i = 0; i < 26; i += 1) {
    // Keep the roads drivable: re-roll until the container is off every road line.
    let x = 0, z = 0;
    for (let tries = 0; tries < 8; tries += 1) {
      x = rng.range(-280, 280); z = rng.range(232, 288);
      if (!isRoad(x) && !isRoad(z)) break;
    }
    const c = box(12, 5, 5, rng.pick(containerColors), x, 2.5, z, { ry: rng.chance(0.5) ? Math.PI / 2 : 0 });
    scene.add(c);
    city.colliders.push({ minX: x - 6, maxX: x + 6, minZ: z - 3, maxZ: z + 3, h: 5 });
  }
  for (const bx of [-260, 40, 260]) {
    const hull = box(26, 4, 9, 0xdddddd, bx, 1.2, 356);
    scene.add(hull);
    const cabin = box(8, 5, 7, 0x2471a3, bx - 6, 5.5, 356);
    scene.add(cabin);
  }

  // Market stalls around the market square.
  const stallColors = [0xe4572e, 0xf2c94c, 0x2e86ab, 0xe07a5f];
  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2;
    const x = -176 + Math.cos(angle) * rng.range(28, 52);
    const z = -32 + Math.sin(angle) * rng.range(28, 52);
    const stall = box(6, 3, 5, rng.pick(stallColors), x, 1.5, z, { ry: angle });
    scene.add(stall);
    const awning = new THREE.Mesh(
      new THREE.ConeGeometry(5, 2.2, 4),
      new THREE.MeshLambertMaterial({ color: 0xf5f0e1 }),
    );
    awning.position.set(x, 4.2, z); awning.rotation.y = Math.PI / 4;
    scene.add(awning);
    city.colliders.push({ minX: x - 3, maxX: x + 3, minZ: z - 2.5, maxZ: z + 2.5, h: 5 });
  }

  // Street lamps along every road, every 64 units.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2f3338 });
  const glowMat = new THREE.MeshBasicMaterial({ color: CONFIG.palette.lampGlow });
  for (const r of ROADS) {
    for (let t = -HALF + 32; t < HALF; t += 64) {
      for (const [x, z] of [[r + 8, t], [r - 8, t + 32]]) {
        if (Math.abs(z) > HALF - 8 || Math.abs(x) > HALF - 8) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 7, 6), poleMat);
        pole.position.set(x, 3.5, z); scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), glowMat);
        bulb.position.set(x, 7.2, z); scene.add(bulb);
        city.lamps.push(bulb);
      }
    }
  }
  city.lampMats.push(glowMat);

  // Rain: 900 points in a 120-unit box above the camera, recycled in main.js.
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i += 1) {
    rainPos[i * 3] = rng.range(-60, 60);
    rainPos[i * 3 + 1] = rng.range(0, 40);
    rainPos[i * 3 + 2] = rng.range(-60, 60);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0xaaccee, size: 0.35, transparent: true, opacity: 0.55,
  }));
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);
  city.rainPoints = rain;

  return city;
}

// Circle (x, z, radius) vs building AABBs: push the circle out, return true on hit.
export function collideCircle(city, x, z, radius) {
  let hit = false;
  for (const c of city.colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        x += dx * push; z += dz * push;
      } else {
        z += radius;
      }
    }
  }
  const lim = HALF - 6;
  x = Math.max(-lim, Math.min(lim, x));
  z = Math.max(-lim, Math.min(lim, z));
  return { x, z, hit };
}

// Nearest road coordinate for a point (snaps to the grid roads).
export function nearestRoadPoint(x, z) {
  const snap = (v) => ROADS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  return { x: snap(x), z: snap(z) };
}
