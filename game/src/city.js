// city.js - builds the whole procedural city of Teluk Kirana with
// three.js: road grid, sidewalks, glowing buildings, palm trees,
// street lamps, the harbour with water, cranes, containers, boats,
// district signs, dusk sky, clouds and warm fog.

import * as THREE from 'three';
import {
  BLOCK, ROAD, PITCH, GRID, CITY_HALF, WORLD_EDGE, SIDEWALK,
  WATER_Z, PIER_Z, DISTRICTS, gridToWorld, districtAt, SKY,
} from './config.js';
import { clamp } from './rng.js';

// A canvas texture full of lit windows for building walls.
function makeWindowTexture(rng, baseColor, floors, cols) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const base = new THREE.Color(baseColor);
  ctx.fillStyle = '#' + base.getHexString();
  ctx.fillRect(0, 0, 128, 256);
  // Slight vertical shading so walls do not look flat.
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,220,180,0.16)');
  grad.addColorStop(1, 'rgba(40,20,40,0.20)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  const winW = 128 / cols;
  const winH = 256 / floors;
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng.chance(0.55);
      const warm = rng.chance(0.8);
      if (lit) {
        ctx.fillStyle = warm ? 'rgba(255,196,110,0.95)' : 'rgba(190,230,255,0.9)';
      } else {
        ctx.fillStyle = 'rgba(30,32,48,0.85)';
      }
      ctx.fillRect(c * winW + 2, f * winH + 3, winW - 4, winH - 6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

// A canvas texture with a district name, used on floating signs.
function makeSignSprite(text, sub, colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(16,14,28,0.72)';
  ctx.beginPath();
  ctx.roundRect(6, 6, 500, 148, 22);
  ctx.fill();
  ctx.strokeStyle = '#' + new THREE.Color(colorHex).getHexString();
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#ffe9c4';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 74);
  ctx.fillStyle = '#ffd9a0';
  ctx.font = '30px Georgia, serif';
  ctx.fillText(sub, 256, 122);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(26, 8.1, 1);
  return sprite;
}

// A gradient sky dome texture: purple top, orange middle, gold horizon.
function makeSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#' + new THREE.Color(SKY.top).getHexString());
  grad.addColorStop(0.45, '#' + new THREE.Color(0x7a3a6e).getHexString());
  grad.addColorStop(0.68, '#' + new THREE.Color(SKY.mid).getHexString());
  grad.addColorStop(0.85, '#' + new THREE.Color(SKY.low).getHexString());
  grad.addColorStop(1.0, '#' + new THREE.Color(0xffcf8a).getHexString());
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One palm tree: a leaning trunk and a crown of bent leaf planes.
const palmLeafGeo = new THREE.PlaneGeometry(3.4, 0.85, 4, 1);
function bendLeafGeometry() {
  const pos = palmLeafGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = (x + 1.7) / 3.4;
    pos.setZ(i, -Math.sin(t * Math.PI * 0.55) * 0.9);
  }
  palmLeafGeo.computeVertexNormals();
}
bendLeafGeometry();

const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f, side: THREE.DoubleSide });
const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 5.4, 6);

export function makePalm(rng) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 2.7;
  trunk.rotation.z = rng.range(-0.09, 0.09);
  group.add(trunk);
  const leaves = rng.int(6, 8);
  for (let i = 0; i < leaves; i++) {
    const leaf = new THREE.Mesh(palmLeafGeo, leafMat);
    const angle = (i / leaves) * Math.PI * 2 + rng.range(-0.2, 0.2);
    leaf.position.set(Math.sin(angle) * 0.7, 5.5, Math.cos(angle) * 0.7);
    leaf.rotation.y = angle;
    leaf.rotation.x = -0.5;
    group.add(leaf);
  }
  return group;
}

// A street lamp with a warm glowing head.
const lampPoleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.6, 6);
const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x2c3038 });
const lampHeadGeo = new THREE.SphereGeometry(0.32, 8, 6);
const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffc873 });
function makeLamp() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(lampPoleGeo, lampPoleMat);
  pole.position.y = 2.8;
  group.add(pole);
  const head = new THREE.Mesh(lampHeadGeo, lampHeadMat);
  head.position.y = 5.7;
  group.add(head);
  return group;
}

// A shipping container in a bright colour.
const containerGeo = new THREE.BoxGeometry(6.1, 2.6, 2.45);
export function makeContainer(rng, colors) {
  const mat = new THREE.MeshLambertMaterial({ color: rng.pick(colors) });
  const mesh = new THREE.Mesh(containerGeo, mat);
  mesh.castShadow = true;
  return mesh;
}

const CONTAINER_COLORS = [0xc94f30, 0x2e7fb8, 0x3fae6a, 0xd9a03a, 0x8a5fb0, 0xb03a5e];

// A simple harbour crane: two legs, a beam and a hanging hook block.
function makeCrane(rng) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xd98032 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  const legGeo = new THREE.BoxGeometry(1.1, 22, 1.1);
  for (const sx of [-7, 7]) {
    for (const sz of [-3, 3]) {
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(sx, 11, sz);
      group.add(leg);
    }
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 1.6, 2), mat);
  beam.position.set(2, 22.5, 0);
  group.add(beam);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 7.4), dark);
  cross.position.set(0, 21.4, 0);
  group.add(cross);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.4), dark);
  cab.position.set(rng.range(-6, 8), 20.6, 0);
  group.add(cab);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 9, 4), dark);
  cable.position.set(cab.position.x, 16, 0);
  group.add(cable);
  const hookBox = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.6), mat);
  hookBox.position.set(cab.position.x, 11, 0);
  group.add(hookBox);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

// A small fishing boat with a hull, cabin and mast.
function makeBoat(rng) {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ color: rng.pick([0xe8e2d2, 0xc94f30, 0x2e7fb8, 0x3fae6a]) });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.6, 2.6), hullMat);
  hull.position.y = 0.6;
  group.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.4, 4), hullMat);
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(4.8, 0.6, 0);
  bow.scale.set(1, 1, 0.92);
  group.add(bow);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.5, 1.9),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 }),
  );
  cabin.position.set(-0.8, 2.1, 0);
  group.add(cabin);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 5, 5),
    new THREE.MeshLambertMaterial({ color: 0x6a4a2e }),
  );
  mast.position.set(1.6, 3.6, 0);
  group.add(mast);
  return group;
}

// Build the entire city. Returns colliders and an update hook for the
// animated bits (water shimmer, drifting clouds, sign glow).
export function buildCity(scene, rng) {
  const colliders = [];
  const animated = { waterMats: [], clouds: [], time: 0 };

  // Sky, fog and lights.
  const skyTex = makeSkyTexture();
  const skyGeo = new THREE.SphereGeometry(900, 24, 12);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  scene.fog = new THREE.Fog(SKY.fog, 120, 620);

  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x3a4a6e, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(SKY.sun, 1.6);
  sun.position.set(-260, 130, 190);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -240;
  sun.shadow.camera.right = 240;
  sun.shadow.camera.top = 240;
  sun.shadow.camera.bottom = -240;
  sun.shadow.camera.far = 900;
  scene.add(sun);
  const amb = new THREE.AmbientLight(0xff9a66, 0.25);
  scene.add(amb);

  // The low sun itself: a bright disc near the horizon over the water.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(46, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe3a3, fog: false }),
  );
  sunDisc.position.set(-330, 62, 560);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(95, 24),
    new THREE.MeshBasicMaterial({ color: 0xff9a50, transparent: true, opacity: 0.35, fog: false }),
  );
  sunGlow.position.copy(sunDisc.position).z += 2;
  sunGlow.lookAt(0, 40, 0);
  scene.add(sunGlow);

  // Ground base: warm sand-grass under everything.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_EDGE * 2 + 260, WORLD_EDGE * 2 + 260),
    new THREE.MeshLambertMaterial({ color: 0x9a8a68 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  scene.add(ground);

  // Roads: one big dark plane plus painted markings per road.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x33343e });
  const roads = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_EDGE * 2 + ROAD, WORLD_EDGE * 2 + ROAD),
    roadMat,
  );
  roads.rotation.x = -Math.PI / 2;
  roads.position.y = 0.0;
  roads.receiveShadow = true;
  scene.add(roads);

  // Block slabs (sidewalk + inner ground) so roads read as dark bands.
  const slabMat = new THREE.MeshLambertMaterial({ color: 0xb8a888 });
  const slabGeo = new THREE.BoxGeometry(BLOCK + SIDEWALK * 2, 0.24, BLOCK + SIDEWALK * 2);
  for (let gx = 0; gx < GRID - 1; gx++) {
    for (let gz = 0; gz < GRID - 1; gz++) {
      const cx = gridToWorld(gx) + PITCH / 2;
      const cz = gridToWorld(gz) + PITCH / 2;
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set(cx, 0.12, cz);
      slab.receiveShadow = true;
      scene.add(slab);
    }
  }

  // Centre dashes along every road.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf2d98c });
  const dashGeoH = new THREE.PlaneGeometry(3.2, 0.28);
  const dashGeoV = new THREE.PlaneGeometry(0.28, 3.2);
  const dashGroup = new THREE.Group();
  for (let i = 0; i < GRID; i++) {
    const c = gridToWorld(i);
    for (let s = -CITY_HALF - PITCH / 2; s < CITY_HALF + PITCH / 2; s += 8) {
      const dh = new THREE.Mesh(dashGeoH, dashMat);
      dh.rotation.x = -Math.PI / 2;
      dh.position.set(s + 4, 0.03, c);
      dashGroup.add(dh);
      const dv = new THREE.Mesh(dashGeoV, dashMat);
      dv.rotation.x = -Math.PI / 2;
      dv.position.set(c, 0.03, s + 4);
      dashGroup.add(dv);
    }
  }
  scene.add(dashGroup);

  // Buildings: one textured box per lot, two lots per block face.
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a4636 });
  for (let gx = 0; gx < GRID - 1; gx++) {
    for (let gz = 0; gz < GRID - 1; gz++) {
      const cx = gridToWorld(gx) + PITCH / 2;
      const cz = gridToWorld(gz) + PITCH / 2;
      const district = districtAt(cx, cz);
      const lots = rng.chance(0.3) ? 1 : 2;
      for (let lot = 0; lot < lots; lot++) {
        const w = lots === 1 ? BLOCK - 8 : (BLOCK - 10) / 2;
        const d = BLOCK - 8;
        const h = rng.range(district.minH, district.maxH) * (lots === 1 ? 0.8 : 1);
        const ox = lots === 1 ? 0 : (lot === 0 ? -(w / 2 + 1.5) : (w / 2 + 1.5));
        const floors = Math.max(3, Math.round(h / 2.6));
        const cols = Math.max(3, Math.round(w / 2.4));
        const tex = makeWindowTexture(rng, rng.pick(district.wall), floors, cols);
        // The same texture drives the emissive map, so lit windows
        // glow warm against the dusk while dark windows stay dark.
        const wallMat = new THREE.MeshLambertMaterial({
          map: tex, emissive: 0x8a6a44, emissiveMap: tex,
        });
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
        box.position.set(cx + ox, h / 2 + 0.24, cz);
        box.castShadow = true;
        box.receiveShadow = true;
        scene.add(box);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5),
          new THREE.MeshLambertMaterial({ color: district.roof }));
        roof.position.set(cx + ox, h + 0.45, cz);
        scene.add(roof);
        colliders.push({ x: cx + ox, z: cz, hw: w / 2 + 0.3, hd: d / 2 + 0.3 });
      }
    }
  }

  // Palm trees along the main avenues and the beach road.
  const palmSpots = [];
  for (let i = 0; i < GRID; i++) {
    const c = gridToWorld(i);
    for (let s = -CITY_HALF; s <= CITY_HALF; s += 13) {
      palmSpots.push([c + ROAD / 2 + 2.4, s + rng.range(-2, 2)]);
      palmSpots.push([s + rng.range(-2, 2), c - ROAD / 2 - 2.4]);
    }
  }
  for (const [x, z] of palmSpots) {
    if (Math.abs(x) > WORLD_EDGE - 4 || Math.abs(z) > WORLD_EDGE - 4) continue;
    if (!rng.chance(0.72)) continue;
    const palm = makePalm(rng);
    palm.position.set(x, 0.2, z);
    palm.rotation.y = rng.range(0, Math.PI * 2);
    const s = rng.range(0.85, 1.3);
    palm.scale.set(s, s, s);
    scene.add(palm);
  }

  // Street lamps at intersections.
  for (let gx = 0; gx < GRID; gx++) {
    for (let gz = 0; gz < GRID; gz++) {
      const x = gridToWorld(gx);
      const z = gridToWorld(gz);
      for (const [ox, oz] of [[8.4, 8.4], [-8.4, -8.4]]) {
        const lamp = makeLamp();
        lamp.position.set(x + ox, 0, z + oz);
        scene.add(lamp);
      }
    }
  }

  // District signs floating over each district centre.
  for (const d of DISTRICTS) {
    const sign = makeSignSprite(d.name, d.sub, d.accent);
    sign.position.set(gridToWorld(d.gx), 26, gridToWorld(d.gz));
    scene.add(sign);
  }

  // Harbour: pier deck, cranes, container stacks and boats.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a6a58 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(WORLD_EDGE * 2, 1.2, PITCH * 1.1), pierMat);
  pier.position.set(0, 0.4, PIER_Z + 8);
  pier.receiveShadow = true;
  scene.add(pier);
  colliders.push({ x: 0, z: PIER_Z + 8, hw: WORLD_EDGE, hd: 0.4, soft: true });

  for (const cx of [-90, -30, 40, 110]) {
    const crane = makeCrane(rng);
    crane.position.set(cx, 1, PIER_Z + 10);
    crane.rotation.y = Math.PI;
    scene.add(crane);
  }
  for (let i = 0; i < 46; i++) {
    const stack = rng.int(1, 3);
    const bx = rng.range(-WORLD_EDGE + 14, WORLD_EDGE - 14);
    const bz = PIER_Z + rng.range(2, 14);
    for (let s = 0; s < stack; s++) {
      const box = makeContainer(rng, CONTAINER_COLORS);
      box.position.set(bx, 1 + 1.3 + s * 2.6, bz);
      box.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
      scene.add(box);
    }
    if (i % 6 === 0) colliders.push({ x: bx, z: bz, hw: 3.4, hd: 3.4 });
  }
  // Container stacks in the shipyard district too.
  const yardX = gridToWorld(5);
  const yardZ = gridToWorld(5);
  for (let i = 0; i < 16; i++) {
    const box = makeContainer(rng, CONTAINER_COLORS);
    box.position.set(
      yardX + rng.range(-20, 20),
      1.3 + (i % 2) * 2.6,
      yardZ + PITCH / 2 + rng.range(2, 10),
    );
    scene.add(box);
  }

  // Water: a big semi-reflective teal plane south of the pier.
  const waterMat = new THREE.MeshPhongMaterial({
    color: 0x1d6f77, shininess: 160, specular: 0xffb060,
    transparent: true, opacity: 0.94,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 700), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.4, WATER_Z + 320);
  scene.add(water);
  animated.waterMats.push(waterMat);

  // Boats bobbing near the pier.
  const boats = [];
  for (let i = 0; i < 9; i++) {
    const boat = makeBoat(rng);
    boat.position.set(rng.range(-WORLD_EDGE, WORLD_EDGE), 0, WATER_Z + rng.range(16, 90));
    boat.rotation.y = rng.range(0, Math.PI * 2);
    scene.add(boat);
    boats.push({ mesh: boat, phase: rng.range(0, Math.PI * 2) });
  }
  animated.boats = boats;

  // Clouds: soft flat white-orange blobs drifting slowly.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffd9b8, transparent: true, opacity: 0.55, fog: false });
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    const puffs = rng.int(3, 5);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(9, 20), 10, 8), cloudMat);
      puff.position.set(p * rng.range(8, 14) - puffs * 6, rng.range(-2, 2), rng.range(-6, 6));
      puff.scale.y = 0.32;
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-600, 600), rng.range(120, 190), rng.range(-500, 500));
    scene.add(cloud);
    animated.clouds.push({ mesh: cloud, speed: rng.range(1.2, 3.2) });
  }

  // Per-frame cosmetic updates.
  function update(dt, t) {
    animated.time = t;
    waterMat.color.setHSL(0.5, 0.62, 0.28 + Math.sin(t * 0.7) * 0.03);
    for (const c of animated.clouds) {
      c.mesh.position.x += c.speed * dt;
      if (c.mesh.position.x > 700) c.mesh.position.x = -700;
    }
    for (const b of animated.boats) {
      b.mesh.position.y = Math.sin(t * 0.9 + b.phase) * 0.22;
      b.mesh.rotation.z = Math.sin(t * 0.7 + b.phase) * 0.03;
    }
  }

  return { colliders, update, waterZ: WATER_Z };
}

// Circle versus axis-aligned box collision resolution.
// Pushes the circle out and returns true when a hit happened.
export function collideCircle(colliders, x, z, radius) {
  let hit = false;
  let px = x;
  let pz = z;
  for (const c of colliders) {
    const dx = px - c.x;
    const dz = pz - c.z;
    const ox = c.hw + radius - Math.abs(dx);
    const oz = c.hd + radius - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      hit = true;
      if (ox < oz) px = c.x + Math.sign(dx || 1) * (c.hw + radius);
      else pz = c.z + Math.sign(dz || 1) * (c.hd + radius);
    }
  }
  return { x: px, z: pz, hit };
}

// Is a point inside any collider (with padding)?
export function pointBlocked(colliders, x, z, pad) {
  for (const c of colliders) {
    if (Math.abs(x - c.x) < c.hw + pad && Math.abs(z - c.z) < c.hd + pad) return true;
  }
  return false;
}

export function clampToWorld(v) {
  return clamp(v, -WORLD_EDGE - 6, WORLD_EDGE + 6);
}
