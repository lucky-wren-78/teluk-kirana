// Teluk Kirana — the city itself: five districts on a 44-unit road grid,
// a harbour with cranes and container stacks, a flat harbour bridge, the
// Pasar Lama market square, a marina basin, palms, lamps and neon.
//
// Performance contract: anything repeated is an InstancedMesh (buildings,
// windows, roof clutter, palms, lamps, stalls, containers, benches), so the
// whole city is a few dozen draw calls and stays smooth on software GL.
// Placement is seeded — the city is identical on every load — and every
// solid prop registers an AABB in `colliders` for physics and the camera.
import * as THREE from 'three';
import { createRng, range, rangeInt, pick, chance } from './rng.js';
import { DISTRICTS } from './config.js';

const PALETTE = {
  harbor: [0x7d7468, 0x5f7183, 0x97835f, 0x6e5f4e, 0x87919c],
  market: [0xd98c4a, 0xc96f4a, 0xe3a85c, 0xb85c38, 0xd4703f],
  oldtown: [0xe9ddc2, 0xdccaa6, 0xcdb488, 0xf2e8cf, 0xd8ba7e],
  marina: [0x85b8d9, 0x5d9cec, 0x8fc7ea, 0xb0d8f2, 0x6fa8cf],
  hills: [0xa3b58f, 0x7d9b6a, 0xbcc9a6, 0x8fa37c, 0x9db08a],
};
const NEON_COLORS = [0xff4d8d, 0x29e6ff, 0xffa726, 0x7cff4d, 0xff5252];

function boxMesh(w, h, d, color, opts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.88,
      metalness: opts.metalness ?? 0.03,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 1,
    }),
  );
  mesh.castShadow = opts.shadow !== false;
  mesh.receiveShadow = true;
  return mesh;
}

const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _col = new THREE.Color();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function placeInstance(mesh, i, x, y, z, sx, sy, sz, rotY = 0, colorHex = null) {
  _quat.setFromAxisAngle(Y_AXIS, rotY);
  _pos.set(x, y, z);
  _scale.set(sx, sy, sz);
  _mat4.compose(_pos, _quat, _scale);
  mesh.setMatrixAt(i, _mat4);
  if (colorHex !== null) mesh.setColorAt(i, _col.setHex(colorHex));
}

function finishInstances(mesh, scene, shadow = true) {
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export function buildCity(scene) {
  const rng = createRng(20261119);
  const colliders = [];
  const buildings = [];
  const lamps = [];

  // ---------- ground: sand apron, asphalt slab, market plaza paving -------
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(980, 980),
    new THREE.MeshStandardMaterial({ color: 0xc9ad7c, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.06;
  sand.receiveShadow = true;
  scene.add(sand);

  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(440, 440),
    new THREE.MeshStandardMaterial({ color: 0x4b5158, roughness: 0.96 }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.receiveShadow = true;
  scene.add(slab);

  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 40),
    new THREE.MeshStandardMaterial({ color: 0x9c8461, roughness: 1 }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.03, -8);
  plaza.receiveShadow = true;
  scene.add(plaza);

  // ---------- water: harbour sea (east) and the marina basin (south-west) --
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x11607f, roughness: 0.18, metalness: 0.45,
    emissive: 0x0a2e40, emissiveIntensity: 0.6,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 460), waterMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(368, 0.02, 0);
  sea.receiveShadow = true;
  scene.add(sea);

  const basin = new THREE.Mesh(new THREE.PlaneGeometry(150, 96), waterMat.clone());
  basin.rotation.x = -Math.PI / 2;
  basin.position.set(-118, 0.02, 168);
  basin.receiveShadow = true;
  scene.add(basin);

  // ---------- harbour bridge: flat deck, red rails, pylons, lamps ---------
  // The deck top sits flush with the road (vehicles have no vertical
  // physics), with twin pylons and lamp posts giving it silhouette.
  const deck = boxMesh(112, 0.3, 16, 0x565b62);
  deck.position.set(254, 0, 0);
  scene.add(deck);
  for (const rz of [-7.9, 7.9]) {
    const rail = boxMesh(112, 1.05, 0.35, 0xc93a2a);
    rail.position.set(254, 0.68, rz);
    scene.add(rail);
  }
  for (const px of [222, 286]) {
    for (const pz of [-9.5, 9.5]) {
      const pylon = boxMesh(1.6, 19, 1.6, 0xd8d3c8);
      pylon.position.set(px, 9.5, pz);
      scene.add(pylon);
    }
    const beam = boxMesh(1.4, 1.4, 20.5, 0xd8d3c8);
    beam.position.set(px, 18.6, 0);
    scene.add(beam);
  }
  for (const ax of [196, 312]) {
    const ramp = boxMesh(14, 0.3, 16, 0x484d54);
    ramp.position.set(ax, 0, 0);
    scene.add(ramp);
  }
  colliders.push({ minX: 196, maxX: 312, minZ: -8, maxZ: 8, top: 0.4, bridge: true });

  const pier = boxMesh(64, 1.1, 13, 0x8a6f4d);
  pier.position.set(240, 0.55, -42);
  scene.add(pier);
  colliders.push({ minX: 208, maxX: 272, minZ: -48.5, maxZ: -35.5, top: 1.1 });

  // ---------- road grid with instanced centre dashes ----------------------
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 1 });
  const dashSpots = [];
  for (let c = -220; c <= 220; c += 44) {
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(12, 440), roadMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(c, 0.055, 0);
    vRoad.receiveShadow = true;
    scene.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(440, 12), roadMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.055, c);
    hRoad.receiveShadow = true;
    scene.add(hRoad);
    for (let d = -204; d <= 204; d += 17) dashSpots.push([c, d]);
  }
  const dashes = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.7, 4.2),
    new THREE.MeshStandardMaterial({ color: 0xd9d2ba, roughness: 1 }),
    dashSpots.length,
  );
  dashSpots.forEach(([cx, dz], i) => {
    _quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    _pos.set(cx, 0.085, dz);
    _scale.set(1, 1, 1);
    _mat4.compose(_pos, _quat, _scale);
    dashes.setMatrixAt(i, _mat4);
  });
  dashes.receiveShadow = true;
  scene.add(dashes);

  // ---------- buildings: instanced bodies, windows, roofs, neon -----------
  const bodySpecs = [];
  const windowSpecs = [];
  const tankSpecs = [];
  const acSpecs = [];
  const antennaSpecs = [];
  const neonSpecs = [];
  let helipadSpot = null;
  let tallest = 0;

  for (let gx = -198; gx <= 198; gx += 44) {
    for (let gz = -198; gz <= 198; gz += 44) {
      if (Math.abs(gx) < 26 && Math.abs(gz) < 26) continue; // market square
      if (gx > 176) continue; // harbour apron stays open
      if (gx <= -44 && gz >= 110) continue; // marina basin stays open water
      const district = DISTRICTS.reduce((best, d) =>
        (gx - d.cx) ** 2 + (gz - d.cz) ** 2 < (gx - best.cx) ** 2 + (gz - best.cz) ** 2 ? d : best);
      const palette = PALETTE[district.hue];
      const perBlock = rangeInt(rng, 2, 3);
      for (let i = 0; i < perBlock; i++) {
        const w = range(rng, 9, 17);
        const d = range(rng, 9, 17);
        let h;
        if (district.hue === 'hills') h = range(rng, 14, 52);
        else if (district.hue === 'oldtown') h = range(rng, 9, 30);
        else if (district.hue === 'marina') h = range(rng, 8, 24);
        else h = range(rng, 10, 40);
        if (chance(rng, 0.1)) h *= 1.45; // the odd tower
        const x = gx + range(rng, -10, 10);
        const z = gz + range(rng, -10, 10);
        if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
        const color = pick(rng, palette);
        bodySpecs.push({ x, z, w, d, h, color });
        const aabb = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: h };
        colliders.push(aabb);
        buildings.push({ aabb, district: district.name });
        if (h > tallest) { tallest = h; helipadSpot = { x, z, h }; }
        // Rooftop clutter on most roofs: tank, AC boxes, an antenna.
        if (chance(rng, 0.55)) tankSpecs.push({ x: x + range(rng, -w / 4, w / 4), z: z + range(rng, -d / 4, d / 4), h });
        if (chance(rng, 0.7)) acSpecs.push({ x: x + range(rng, -w / 3, w / 3), z: z + range(rng, -d / 3, d / 3), h, s: range(rng, 1.4, 2.6) });
        if (h > 30 && chance(rng, 0.6)) antennaSpecs.push({ x, z, h, tall: range(rng, 4, 9) });
        // Lit windows on the street faces.
        const rows = Math.max(1, Math.floor(h / 7.5));
        for (let r = 0; r < rows; r++) {
          const y = 3 + r * 7.5;
          if (chance(rng, 0.85)) windowSpecs.push({ x: x - w / 4, y, z: z + d / 2 + 0.07, rotY: 0 });
          if (chance(rng, 0.7)) windowSpecs.push({ x: x + w / 4, y, z: z + d / 2 + 0.07, rotY: 0 });
          if (chance(rng, 0.45)) windowSpecs.push({ x: x + w / 2 + 0.07, y, z: z - d / 4, rotY: Math.PI / 2 });
        }
        // Neon signage near the market and old town streets.
        if ((district.hue === 'market' || district.hue === 'oldtown') && h > 12 && chance(rng, 0.4)) {
          neonSpecs.push({
            x: x + range(rng, -w / 4, w / 4), y: range(rng, 4, Math.min(9, h - 2)),
            z: z + d / 2 + 0.22, w: range(rng, 2.4, 4.4), color: pick(rng, NEON_COLORS),
          });
        }
      }
    }
  }

  const bodies = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.02 }),
    Math.max(1, bodySpecs.length),
  );
  bodySpecs.forEach((b, i) => placeInstance(bodies, i, b.x, b.h / 2, b.z, b.w, b.h, b.d, 0, b.color));
  finishInstances(bodies, scene);

  const windowMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1.5, 1.9),
    new THREE.MeshStandardMaterial({ color: 0x1c2733, emissive: 0xffd98a, emissiveIntensity: 0.85, roughness: 0.4 }),
    Math.max(1, windowSpecs.length),
  );
  windowSpecs.forEach((win, i) => placeInstance(windowMesh, i, win.x, win.y, win.z, 1, 1, 1, win.rotY));
  finishInstances(windowMesh, scene, false);

  const tanks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1.1, 1.1, 2.4, 10),
    new THREE.MeshStandardMaterial({ color: 0x8d99a6, roughness: 0.6, metalness: 0.4 }),
    Math.max(1, tankSpecs.length),
  );
  tankSpecs.forEach((t, i) => placeInstance(tanks, i, t.x, t.h + 1.2, t.z, 1, 1, 1));
  finishInstances(tanks, scene);

  const acUnits = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.8 }),
    Math.max(1, acSpecs.length),
  );
  acSpecs.forEach((a, i) => placeInstance(acUnits, i, a.x, a.h + 0.6, a.z, a.s, 1.2, a.s * 0.8, range(rng, 0, 3)));
  finishInstances(acUnits, scene);

  const antennas = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.06, 0.1, 1, 5),
    new THREE.MeshStandardMaterial({ color: 0x333a40, roughness: 0.7 }),
    Math.max(1, antennaSpecs.length),
  );
  antennaSpecs.forEach((a, i) => placeInstance(antennas, i, a.x, a.h + a.tall / 2, a.z, 1, a.tall, 1));
  finishInstances(antennas, scene, false);

  const neons = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.9, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 1.6 }),
    Math.max(1, neonSpecs.length),
  );
  neonSpecs.forEach((n, i) => placeInstance(neons, i, n.x, n.y, n.z, n.w, 1, 1, 0, n.color));
  finishInstances(neons, scene, false);

  // Helipad on the tallest tower: a dark disc with a pale ring.
  if (helipadSpot) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 5.2, 0.35, 20),
      new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.9 }),
    );
    pad.position.set(helipadSpot.x, helipadSpot.h + 0.18, helipadSpot.z);
    pad.castShadow = true;
    scene.add(pad);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.6, 0.16, 6, 24),
      new THREE.MeshStandardMaterial({ color: 0xf5f0dc, roughness: 0.8 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(helipadSpot.x, helipadSpot.h + 0.4, helipadSpot.z);
    scene.add(ring);
  }

  // ---------- street lamps (instanced) + a few real night lights ----------
  const lampSpots = [];
  for (let c = -176; c <= 176; c += 44) {
    for (let d = -176; d <= 176; d += 44) lampSpots.push([c + 7.5, d + 7.5]);
  }
  for (let bx = 208; bx <= 300; bx += 23) lampSpots.push([bx, -9.2], [bx, 9.2]);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x272b30, roughness: 0.65, metalness: 0.4 });
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffdf8a, emissiveIntensity: 0.4 });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.13, 0.17, 7, 7), poleMat, lampSpots.length);
  const lampHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 9, 7), lampHeadMat, lampSpots.length);
  const lampArms = new THREE.InstancedMesh(new THREE.BoxGeometry(2.1, 0.15, 0.15), poleMat, lampSpots.length);
  lampSpots.forEach(([lx, lz], i) => {
    placeInstance(poles, i, lx, 3.5, lz, 1, 1, 1);
    placeInstance(lampHeads, i, lx - 0.9, 7.05, lz, 1, 1, 1);
    placeInstance(lampArms, i, lx - 0.5, 6.9, lz, 1, 1, 1);
    lamps.push({ x: lx, z: lz, head: lampHeads, mat: lampHeadMat });
  });
  finishInstances(poles, scene);
  finishInstances(lampHeads, scene, false);
  finishInstances(lampArms, scene, false);

  // Real point lights exist but join the scene only after dark (main.js
  // toggles them): an always-on light taxes every fragment, all day.
  const nightLights = [];
  for (const [lx, lz] of [[-15, -15], [15, -15], [-15, 13], [15, 13], [0, -2], [228, -30], [254, 0]]) {
    const pl = new THREE.PointLight(0xffc46a, 0, 48, 1.8);
    pl.position.set(lx, 8.5, lz);
    nightLights.push(pl);
  }

  // ---------- Pasar Lama market: stalls, awnings, goods, string lights ----
  const stallSpecs = [];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 7; i++) {
      stallSpecs.push({ x: -24 + i * 8, z: -14 + row * 11, color: pick(rng, [0xd94f3d, 0x2e86de, 0x27ae60, 0xf2b705, 0x8e44ad, 0xe67e22]) });
    }
  }
  const stallBodies = new THREE.InstancedMesh(
    new THREE.BoxGeometry(5.2, 2.5, 4.2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    stallSpecs.length,
  );
  const awnings = new THREE.InstancedMesh(
    new THREE.BoxGeometry(5.9, 0.22, 5),
    new THREE.MeshStandardMaterial({ color: 0xf5efe0, roughness: 0.95 }),
    stallSpecs.length,
  );
  const goodsSpecs = [];
  stallSpecs.forEach((s, i) => {
    placeInstance(stallBodies, i, s.x, 1.25, s.z, 1, 1, 1, 0, s.color);
    placeInstance(awnings, i, s.x, 2.85, s.z, 1, 1, 1, 0.05);
    colliders.push({ minX: s.x - 2.6, maxX: s.x + 2.6, minZ: s.z - 2.1, maxZ: s.z + 2.1, top: 3 });
    for (let gI = 0; gI < 3; gI++) {
      goodsSpecs.push({
        x: s.x + range(rng, -1.8, 1.8), z: s.z + range(rng, -1.2, 1.2),
        color: pick(rng, [0xe74c3c, 0xf1c40f, 0x2ecc71, 0xe67e22, 0xecf0f1]),
        s: range(rng, 0.5, 0.9),
      });
    }
  });
  finishInstances(stallBodies, scene);
  finishInstances(awnings, scene);
  const goods = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }),
    Math.max(1, goodsSpecs.length),
  );
  goodsSpecs.forEach((g, i) => placeInstance(goods, i, g.x, 2.5 + g.s / 2, g.z, g.s, g.s, g.s, range(rng, 0, 3), g.color));
  finishInstances(goods, scene);

  // String lights over the square: two catenary-ish rows of warm bulbs.
  const bulbSpecs = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    bulbSpecs.push({ x: -26 + t * 52, y: 5.6 - Math.sin(t * Math.PI) * 0.7, z: -20 });
    bulbSpecs.push({ x: -26 + t * 52, y: 5.6 - Math.sin(t * Math.PI) * 0.7, z: 4 });
  }
  const bulbs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.22, 7, 6),
    new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffc46a, emissiveIntensity: 1.4 }),
    bulbSpecs.length,
  );
  bulbSpecs.forEach((b, i) => placeInstance(bulbs, i, b.x, b.y, b.z, 1, 1, 1));
  finishInstances(bulbs, scene, false);

  // ---------- harbour: container stacks, cranes, boats, buoys -------------
  const contSpecs = [];
  const contColors = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98, 0xca6f1e];
  for (let stack = 0; stack < 6; stack++) {
    const cx = 206 + (stack % 3) * 15;
    const cz = -96 + Math.floor(stack / 3) * 34;
    const levels = rangeInt(rng, 2, 3);
    for (let lvl = 0; lvl < levels; lvl++) {
      contSpecs.push({ x: cx, y: 1.55 + lvl * 3.1, z: cz, color: pick(rng, contColors) });
    }
    colliders.push({ minX: cx - 5.6, maxX: cx + 5.6, minZ: cz - 1.8, maxZ: cz + 1.8, top: levels * 3.1 });
  }
  for (let i = 0; i < 5; i++) { // a loose row along the quay road
    const cx = 208 + i * 13;
    contSpecs.push({ x: cx, y: 1.55, z: 58, color: pick(rng, contColors) });
    colliders.push({ minX: cx - 5.6, maxX: cx + 5.6, minZ: 56.2, maxZ: 59.8, top: 3.1 });
  }
  const containers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(11.2, 3.1, 3.6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.35 }),
    contSpecs.length,
  );
  contSpecs.forEach((c, i) => placeInstance(containers, i, c.x, c.y, c.z, 1, 1, 1, 0, c.color));
  finishInstances(containers, scene);

  for (const cz of [-78, 34]) {
    for (const lz of [cz - 9, cz + 9]) {
      const leg = boxMesh(1.5, 27, 1.5, 0xe67e22);
      leg.position.set(216, 13.5, lz);
      scene.add(leg);
    }
    const beam = boxMesh(1.7, 1.9, 27, 0xe67e22);
    beam.position.set(216, 26.2, cz);
    scene.add(beam);
    const cab = boxMesh(2.6, 2.2, 2.6, 0x2c3e50);
    cab.position.set(216, 23.8, cz + 4);
    scene.add(cab);
    colliders.push({ minX: 214.5, maxX: 217.5, minZ: cz - 10, maxZ: cz + 10, top: 27 });
  }

  const boatColors = [0xffffff, 0x2e86de, 0xd94f3d, 0xf2b705, 0x1abc9c];
  function addBoat(x, z, rotY, withMast) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.ConeGeometry(2.3, 9.5, 4),
      new THREE.MeshStandardMaterial({ color: pick(rng, boatColors), roughness: 0.45 }),
    );
    hull.rotation.x = Math.PI / 2;
    hull.rotation.z = Math.PI / 4;
    hull.position.y = 0.7;
    hull.castShadow = true;
    g.add(hull);
    const cabinB = boxMesh(1.7, 0.9, 2.2, 0xf4f6f7);
    cabinB.position.set(0, 1.25, -0.8);
    g.add(cabinB);
    if (withMast) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.5, 6), poleMat);
      mast.position.set(0, 4.4, 0.9);
      g.add(mast);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
  }
  for (let i = 0; i < 7; i++) addBoat(-172 + i * 17, 152 + (i % 2) * 16, range(rng, -0.4, 0.4), i % 2 === 0);
  addBoat(268, -52, 0.4, true);
  addBoat(292, 26, -0.3, false);
  addBoat(258, 74, 0.9, true);

  const buoyMat = new THREE.MeshStandardMaterial({ color: 0xff4438, emissive: 0x881111, emissiveIntensity: 0.7 });
  for (const [bx, bz] of [[238, -14], [238, 14], [300, -30], [300, 44]]) {
    const buoy = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 8), buoyMat);
    buoy.position.set(bx, 0.7, bz);
    scene.add(buoy);
  }

  // ---------- palms, benches, crates ---------------------------------------
  const palmSpots = [];
  for (let i = 0; i < 90 && palmSpots.length < 64; i++) {
    const px = range(rng, -205, 205);
    const pz = range(rng, -205, 205);
    if (Math.abs(px % 44) < 8.5 || Math.abs(pz % 44) < 8.5) continue; // keep roads clear
    if (Math.abs(px) < 26 && Math.abs(pz) < 24) continue; // market square
    if (px > 160 && pz < -20) continue; // container yard sightlines
    if (px < -60 && pz > 105) continue; // marina basin
    palmSpots.push([px, pz, range(rng, -0.09, 0.09), range(rng, 0.85, 1.25)]);
  }
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.2, 0.33, 6.4, 7),
    new THREE.MeshStandardMaterial({ color: 0x7a5a36, roughness: 1 }),
    Math.max(1, palmSpots.length),
  );
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.7, 3.6, 7),
    new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 1 }),
    Math.max(1, palmSpots.length),
  );
  palmSpots.forEach(([px, pz, tilt, s], i) => {
    _quat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt);
    _pos.set(px, 3.2 * s, pz);
    _scale.set(s, s, s);
    _mat4.compose(_pos, _quat, _scale);
    trunks.setMatrixAt(i, _mat4);
    _pos.set(px, 7.4 * s, pz);
    _mat4.compose(_pos, _quat, _scale);
    crowns.setMatrixAt(i, _mat4);
  });
  finishInstances(trunks, scene);
  finishInstances(crowns, scene);

  const benchSpecs = [];
  for (let i = 0; i < 16; i++) {
    benchSpecs.push({ x: range(rng, -30, 30), z: pick(rng, [-22, 8, 20]), rotY: range(rng, 0, Math.PI) });
  }
  const benches = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2.4, 0.5, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x6e5136, roughness: 1 }),
    benchSpecs.length,
  );
  benchSpecs.forEach((b, i) => placeInstance(benches, i, b.x, 0.45, b.z, 1, 1, 1, b.rotY));
  finishInstances(benches, scene);

  const crateSpecs = [];
  for (let i = 0; i < 22; i++) {
    const nearHarbor = i >= 12;
    crateSpecs.push({
      x: nearHarbor ? range(rng, 198, 230) : range(rng, -30, 30),
      z: nearHarbor ? (i % 2 === 0 ? range(rng, -58, -46) : range(rng, 24, 48)) : range(rng, -24, 16),
      s: range(rng, 0.8, 1.5), rotY: range(rng, 0, 3),
    });
  }
  const crates = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xa9825a, roughness: 1 }),
    crateSpecs.length,
  );
  crateSpecs.forEach((c, i) => placeInstance(crates, i, c.x, c.s / 2, c.z, c.s, c.s, c.s, c.rotY));
  finishInstances(crates, scene);

  return {
    colliders, buildings, lamps, nightLights,
    water: [sea, basin],
    bridge: { x: 254, z: 0 },
    market: { x: 0, z: -6 },
    harbor: { x: 232, z: -20 },
  };
}

export function pointHitsCollider(colliders, x, z, radius) {
  for (const c of colliders) {
    if (c.bridge) continue;
    if (x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius) return c;
  }
  return null;
}

// Push a circle (pos.x, pos.z, radius) out of every solid AABB it overlaps.
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
