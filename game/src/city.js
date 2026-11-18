// Teluk Kirana — procedural tropical port city: 5 districts, road grid, harbour,
// bridge, market square, marina and hill town. All placement is seeded, so the
// city is identical on every load. Exports the building AABBs the camera and
// the physics both use for collision.
// Performance: repeated props (buildings, windows, road dashes, palms, lamps)
// are InstancedMesh — a few draw calls instead of ~1,200 — so the game also
// runs on software GL in a headless browser.
import * as THREE from 'three';
import { createRng, range, rangeInt, pick, chance } from './rng.js';
import { DISTRICTS } from './config.js';

const PALETTE = {
  harbor: [0x8a7f72, 0x6b7c8c, 0x9c8a6a, 0x7a6a5a],
  market: [0xd98c4a, 0xc96f4a, 0xe0a458, 0xb85c38],
  oldtown: [0xe8dcc0, 0xd9c9a3, 0xc9b083, 0xf0e6cc],
  marina: [0x7fb3d5, 0x5d9cec, 0x85c1e9, 0xaed6f1],
  hills: [0x9db08a, 0x7d9b6a, 0xb5c4a1, 0x8a9a7b],
};

function box(w, h, d, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.9,
    metalness: 0.02,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = opts.shadow !== false;
  mesh.receiveShadow = true;
  return mesh;
}

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

function setInstance(instanced, index, x, y, z, sx, sy, sz, rotY = 0, color = null) {
  _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  _v.set(x, y, z);
  _s.set(sx, sy, sz);
  _m4.compose(_v, _q, _s);
  instanced.setMatrixAt(index, _m4);
  if (color !== null) instanced.setColorAt(index, _c.setHex(color));
}

export function buildCity(scene) {
  const rng = createRng(20261118);
  const colliders = [];
  const buildings = [];
  const lamps = [];
  const windows = [];

  // --- ground: sand base, then a big asphalt city slab ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0xc2a878, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(440, 440),
    new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.95 }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.y = 0;
  slab.receiveShadow = true;
  scene.add(slab);

  // --- harbour water, east edge, with a pier and a bridge over the channel ---
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 440),
    new THREE.MeshStandardMaterial({ color: 0x146b8a, roughness: 0.25, metalness: 0.35 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(350, 0.02, 0);
  water.receiveShadow = true;
  scene.add(water);

  const pier = box(60, 1.2, 14, 0x8a6f4d);
  pier.position.set(238, 0.6, -40);
  scene.add(pier);

  // Bridge: a FLAT deck at ground level across the harbour channel (x 200–300,
  // z = 0). Vehicles have no vertical physics — they drive at y = 0 — so a
  // raised deck would put them underneath it; this deck's top is y = 0.15,
  // flush with the road, with side rails instead of arches.
  const bridgeDeck = box(110, 0.3, 16, 0x5a5f66);
  bridgeDeck.position.set(252, 0, 0);
  scene.add(bridgeDeck);
  for (const rz of [-7.8, 7.8]) {
    const rail = box(110, 1.0, 0.4, 0xd94f3d);
    rail.position.set(252, 0.65, rz);
    scene.add(rail);
  }
  for (const ax of [194, 310]) {
    const approach = box(14, 0.3, 16, 0x4a4f55);
    approach.position.set(ax, 0, 0);
    scene.add(approach);
  }
  colliders.push({ minX: 195, maxX: 310, minZ: -8, maxZ: 8, top: 0.4, bridge: true });

  // --- road grid: avenues every 44 units, with pale centre dashes (instanced) ---
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 1 });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xd8d3c0, roughness: 1 });
  const dashSpots = [];
  for (let c = -220; c <= 220; c += 44) {
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(12, 440), roadMat);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.set(c, 0.06, 0);
    roadV.receiveShadow = true;
    scene.add(roadV);
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(440, 12), roadMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.set(0, 0.06, c);
    roadH.receiveShadow = true;
    scene.add(roadH);
    for (let d = -200; d <= 200; d += 16) {
      dashSpots.push([c, d]);
    }
  }
  const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.7, 4), dashMat, dashSpots.length);
  dashes.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  dashSpots.forEach(([cx, dz], i) => {
    _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    _v.set(cx, 0.09, dz);
    _s.set(1, 1, 1);
    _m4.compose(_v, _q, _s);
    dashes.setMatrixAt(i, _m4);
  });
  dashes.receiveShadow = true;
  scene.add(dashes);

  // --- buildings: one InstancedMesh, per-instance colour, plus instanced windows ---
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x222222, emissive: 0xffd98a, emissiveIntensity: 0.9,
  });
  const buildingSpecs = [];
  const windowSpecs = [];
  const roofSpecs = [];
  for (let gx = -198; gx <= 198; gx += 44) {
    for (let gz = -198; gz <= 198; gz += 44) {
      if (Math.abs(gx) < 24 && Math.abs(gz) < 24) continue;
      if (gx > 176) continue;
      if (gx < -130 && gz > 110) continue;
      const district = DISTRICTS.reduce((best, d) =>
        (gx - d.cx) ** 2 + (gz - d.cz) ** 2 < (gx - best.cx) ** 2 + (gz - best.cz) ** 2 ? d : best);
      const palette = PALETTE[district.hue];
      const count = rangeInt(rng, 1, 3);
      for (let i = 0; i < count; i++) {
        const w = range(rng, 10, 18);
        const d = range(rng, 10, 18);
        const h = district.hue === 'hills' ? range(rng, 8, 26) : range(rng, 10, 42);
        const x = gx + range(rng, -9, 9);
        const z = gz + range(rng, -9, 9);
        if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
        const color = pick(rng, palette);
        buildingSpecs.push({ x, z, w, d, h, color });
        const aabb = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: h };
        colliders.push(aabb);
        buildings.push({ aabb, district: district.name });
        if (chance(rng, 0.5)) roofSpecs.push({ x, z, w: w * 0.3, d: d * 0.3, h });
        const rows = Math.max(1, Math.floor(h / 8));
        for (let r = 0; r < rows; r++) {
          for (const k of [-1, 1]) {
            if (!chance(rng, 0.8)) continue;
            windowSpecs.push({ x: x + k * (w / 3.2), y: 3 + r * 8, z: z + d / 2 + 0.06 });
          }
        }
      }
    }
  }
  const buildingMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.02 }),
    Math.max(1, buildingSpecs.length),
  );
  buildingSpecs.forEach((b, i) => setInstance(buildingMesh, i, b.x, b.h / 2, b.z, b.w, b.h, b.d, 0, b.color));
  buildingMesh.castShadow = true;
  buildingMesh.receiveShadow = true;
  buildingMesh.instanceMatrix.needsUpdate = true;
  if (buildingMesh.instanceColor) buildingMesh.instanceColor.needsUpdate = true;
  scene.add(buildingMesh);

  const roofMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 }),
    Math.max(1, roofSpecs.length),
  );
  roofSpecs.forEach((r, i) => setInstance(roofMesh, i, r.x, r.h + 1.1, r.z, r.w, 2.2, r.d));
  roofMesh.castShadow = true;
  roofMesh.instanceMatrix.needsUpdate = true;
  scene.add(roofMesh);

  const windowMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1.4, 1.8), windowMat, Math.max(1, windowSpecs.length),
  );
  windowSpecs.forEach((win, i) => setInstance(windowMesh, i, win.x, win.y, win.z, 1, 1, 1));
  windowMesh.instanceMatrix.needsUpdate = true;
  scene.add(windowMesh);
  windows.push(windowMesh);

  // --- street lamps along the avenues (instanced poles, arms, heads) ---
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.7 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf8a, emissiveIntensity: 2.2 });
  const lampSpots = [];
  for (let c = -176; c <= 176; c += 44) {
    for (let d = -176; d <= 176; d += 44) {
      lampSpots.push([c + 7, d + 7]);
    }
  }
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 8), poleMat, lampSpots.length);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8), lampMat, lampSpots.length);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.16, 0.16), poleMat, lampSpots.length);
  lampSpots.forEach(([lx, lz], i) => {
    setInstance(poles, i, lx, 3.5, lz, 1, 1, 1);
    setInstance(heads, i, lx, 7.1, lz, 1, 1, 1);
    setInstance(arms, i, lx - 1, 6.9, lz, 1, 1, 1);
    lamps.push({ x: lx, z: lz, head: heads, mat: lampMat });
  });
  poles.castShadow = true;
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  arms.instanceMatrix.needsUpdate = true;
  scene.add(poles);
  scene.add(heads);
  scene.add(arms);
  // a handful of real point lights for the market square at night — created
  // here but only ADDED to the scene after dark (see main.js): every light in
  // the scene is evaluated per fragment, so five idle point lights would tax
  // every daylight frame for nothing.
  const nightLights = [];
  for (const [lx, lz] of [[-14, -14], [14, -14], [-14, 14], [14, 14], [0, 0]]) {
    const pl = new THREE.PointLight(0xffc46a, 0, 46, 1.8);
    pl.position.set(lx, 8, lz);
    nightLights.push(pl);
  }

  // --- Pasar Lama: market stalls with striped awnings ---
  const stallColors = [0xd94f3d, 0x2e86de, 0x27ae60, 0xf2b705, 0x8e44ad];
  for (let i = 0; i < 10; i++) {
    const sx = -16 + (i % 5) * 8;
    const sz = -12 + Math.floor(i / 5) * 10;
    const stall = box(5, 2.6, 4, pick(rng, stallColors));
    stall.position.set(sx, 1.3, sz);
    scene.add(stall);
    const awning = box(5.6, 0.25, 4.6, 0xffffff);
    awning.position.set(sx, 2.9, sz);
    awning.rotation.z = 0.08;
    scene.add(awning);
    colliders.push({ minX: sx - 2.5, maxX: sx + 2.5, minZ: sz - 2, maxZ: sz + 2, top: 3 });
  }

  // --- harbour containers and cranes ---
  const containerColors = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98];
  for (let i = 0; i < 12; i++) {
    const cx = 205 + (i % 4) * 14;
    const cz = -90 + Math.floor(i / 4) * 16;
    const cont = box(11, 3, 3.4, pick(rng, containerColors));
    cont.position.set(cx, 1.5 + (i % 2) * 3.1, cz);
    scene.add(cont);
    colliders.push({ minX: cx - 5.5, maxX: cx + 5.5, minZ: cz - 1.7, maxZ: cz + 1.7, top: 3 + (i % 2) * 3.1 });
  }
  for (const cz of [-70, 40]) {
    const legA = box(1.4, 26, 1.4, 0xe67e22);
    legA.position.set(215, 13, cz - 8);
    scene.add(legA);
    const legB = box(1.4, 26, 1.4, 0xe67e22);
    legB.position.set(215, 13, cz + 8);
    scene.add(legB);
    const beam = box(1.6, 1.8, 26, 0xe67e22);
    beam.position.set(215, 25, cz);
    scene.add(beam);
    colliders.push({ minX: 214, maxX: 216, minZ: cz - 9, maxZ: cz + 9, top: 26 });
  }

  // --- marina: moored boats ---
  for (let i = 0; i < 6; i++) {
    const bx = -150 + i * 12;
    const bz = 150 + (i % 2) * 10;
    const hull = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 9, 4),
      new THREE.MeshStandardMaterial({ color: pick(rng, [0xffffff, 0x2e86de, 0xd94f3d]), roughness: 0.5 }),
    );
    hull.rotation.x = Math.PI / 2;
    hull.rotation.z = Math.PI / 4;
    hull.position.set(bx, 0.8, bz);
    scene.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 6), poleMat);
    mast.position.set(bx, 4, bz);
    scene.add(mast);
  }

  // --- palms along the beach road and the square (instanced trunks + crowns) ---
  const palmSpots = [];
  for (let i = 0; i < 46; i++) {
    const px = range(rng, -200, 200);
    const pz = Math.abs(px) < 24 ? range(rng, 30, 200) * (chance(rng, 0.5) ? 1 : -1) : range(rng, -200, 200);
    if (Math.abs(px % 44) < 8 || Math.abs(pz % 44) < 8) continue;
    // Keep the harbour container yard clear: a palm on the camera line would
    // block the harbour sunrise shot.
    if (px > 165 && pz < -25) continue;
    palmSpots.push([px, pz, range(rng, -0.08, 0.08)]);
  }
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.34, 6, 7),
    new THREE.MeshStandardMaterial({ color: 0x7a5a36, roughness: 1 }),
    Math.max(1, palmSpots.length),
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.6, 3.4, 7),
    new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 1 }),
    Math.max(1, palmSpots.length),
  );
  palmSpots.forEach(([px, pz, tilt], i) => {
    _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt);
    _v.set(px, 3, pz);
    _s.set(1, 1, 1);
    _m4.compose(_v, _q, _s);
    trunks.setMatrixAt(i, _m4);
    _v.set(px, 7.2, pz);
    _m4.compose(_v, _q, _s);
    crowns.setMatrixAt(i, _m4);
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  scene.add(trunks);
  scene.add(crowns);

  // (No sea wall here: an earlier draft put a 3 m wall across x = 222, which
  // cut straight through the bridge's driving line and blocked the view east.)

  return { colliders, buildings, lamps, windows, nightLights, bridge: { x: 252, z: 0 }, market: { x: 0, z: -6 }, harbor: { x: 235, z: 0 } };
}

export function pointHitsCollider(colliders, x, z, radius) {
  for (const c of colliders) {
    if (c.bridge) continue;
    if (x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius) return c;
  }
  return null;
}

// Push a circle (x, z, radius) out of every building AABB it overlaps.
export function resolveCircleCollision(colliders, pos, radius) {
  for (const c of colliders) {
    if (c.bridge) continue;
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 < 1e-6) {
        pos.x = c.maxX + radius;
      } else {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      }
    }
  }
}
