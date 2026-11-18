// city.js — the procedural build of Teluk Kirana.
// A square road grid, five districts with their own facade palettes, a market
// of striped stalls, palm trees, street lamps that wake up at night, and the
// eastern harbour: a timber pier, moored boats, cranes and the open sea.

import * as THREE from 'three';
import { CITY, ROAD_LINES, DISTRICTS, districtAt } from './config.js';
import { clamp } from './rng.js';

const FACADE_PALETTES = {
  pelabuhan: ['#7d8a96', '#6b7c8c', '#94a3ab', '#5d6d7a'],
  pasar: ['#d98e4a', '#c96f2e', '#e0a458', '#b85c33'],
  bukit: ['#cfd6c2', '#b7c4a5', '#e2e6d4', '#a3b28e'],
  pantai: ['#efd9a0', '#e6c87e', '#f4e3b2', '#dcb96a'],
  kotatua: ['#b06a52', '#9a5643', '#c07a5e', '#8a4a3c'],
};

// Paint one building facade onto a canvas: plaster colour, a grid of windows,
// a darker ground floor. A few windows glow — at night the material's emissive
// map is this same canvas, so lit windows appear to switch on.
function paintFacade(rng, baseColour, floors, bays) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = baseColour;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(0, 226, 128, 30);
  const winW = 128 / bays;
  const winH = 256 / (floors + 1);
  for (let f = 0; f < floors; f++) {
    for (let b = 0; b < bays; b++) {
      const lit = rng.chance(0.34);
      g.fillStyle = lit ? '#ffd98a' : 'rgba(18,32,44,0.85)';
      g.fillRect(b * winW + winW * 0.24, 14 + f * winH, winW * 0.52, winH * 0.52);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePalm(rng) {
  const palm = new THREE.Group();
  const lean = rng.range(-0.14, 0.14);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 5.4, 6), trunkMat);
  trunk.position.y = 2.7;
  trunk.rotation.z = lean;
  palm.add(trunk);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.4, 4), frondMat);
    const angle = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(angle) * 1.1 + lean * -5, 5.6, Math.sin(angle) * 1.1);
    frond.rotation.set(Math.sin(angle) * 1.15, 0, -Math.cos(angle) * 1.15);
    palm.add(frond);
  }
  return palm;
}

function makeBoat(rng, hullColour) {
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(7.5, 1.6, 2.6),
    new THREE.MeshLambertMaterial({ color: hullColour })
  );
  hull.position.y = 0.5;
  boat.add(hull);
  const bow = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.3, 1.6, 3, 1),
    hull.material
  );
  bow.position.set(4.4, 0.5, 0);
  bow.rotation.y = Math.PI / 2;
  boat.add(bow);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.5, 1.9),
    new THREE.MeshLambertMaterial({ color: 0xf2ead8 })
  );
  cabin.position.set(-0.8, 2, 0);
  boat.add(cabin);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 5.4, 5),
    new THREE.MeshLambertMaterial({ color: 0x6b4e2e })
  );
  mast.position.set(1.6, 3.6, 0);
  boat.add(mast);
  boat.userData.bobPhase = rng.range(0, Math.PI * 2);
  return boat;
}

export function buildCity(scene, rng) {
  const colliders = [];       // {x, z, hw, hd} axis-aligned building footprints
  const boats = [];
  const roadMaterials = [];
  const lampHeadMaterial = new THREE.MeshBasicMaterial({ color: 0x554a33 });
  const windowMaterials = [];

  // --- ground, sea and beach ---------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.halfSize * 2 + 60, CITY.halfSize * 2 + 60),
    new THREE.MeshLambertMaterial({ color: 0x77a05c })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  scene.add(ground);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 700),
    new THREE.MeshPhongMaterial({ color: 0x14607a, shininess: 90, specular: 0x99d4e0 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CITY.halfSize + 168, CITY.waterLevel, 0);
  scene.add(sea);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.halfSize * 2 + 40, 34),
    new THREE.MeshLambertMaterial({ color: 0xe8cf96 })
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, -0.03, CITY.halfSize + 12);
  scene.add(beach);
  const southSea = sea.clone();
  southSea.position.set(0, CITY.waterLevel, CITY.halfSize + 190);
  scene.add(southSea);

  // --- roads ---------------------------------------------------------------
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x33343a });
  roadMaterials.push(roadMat);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d4b8 });
  const roadGeoH = new THREE.PlaneGeometry(CITY.halfSize * 2, CITY.roadWidth);
  const roadGeoV = new THREE.PlaneGeometry(CITY.roadWidth, CITY.halfSize * 2);
  const dashGeoH = new THREE.BoxGeometry(3.2, 0.04, 0.28);
  const dashGeoV = new THREE.BoxGeometry(0.28, 0.04, 3.2);
  for (const line of ROAD_LINES) {
    const roadH = new THREE.Mesh(roadGeoH, roadMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.set(0, 0, line);
    scene.add(roadH);
    const roadV = new THREE.Mesh(roadGeoV, roadMat);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.set(line, 0, 0);
    scene.add(roadV);
    for (let d = -CITY.halfSize + 8; d < CITY.halfSize - 6; d += 11) {
      if (ROAD_LINES.some((l) => Math.abs(d - l) < 9)) continue;
      const dashH = new THREE.Mesh(dashGeoH, dashMat);
      dashH.position.set(d, 0.02, line);
      scene.add(dashH);
      const dashV = new THREE.Mesh(dashGeoV, dashMat);
      dashV.position.set(line, 0.02, d);
      scene.add(dashV);
    }
  }

  // --- blocks: sidewalks, buildings, stalls, palms, lamps ------------------
  const slabMat = new THREE.MeshLambertMaterial({ color: 0xb8ab90 });
  const stallMats = [0xd94f3d, 0x2e9e8f, 0xe8a13a, 0x3f6fd9].map(
    (c) => new THREE.MeshLambertMaterial({ color: c })
  );
  const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x2c3136 });
  const lampHeadGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const lampPoleGeo = new THREE.CylinderGeometry(0.09, 0.11, 5.2, 6);

  const facadeCache = new Map();
  const facadeFor = (districtId, colourIdx, floors, bays) => {
    const key = `${districtId}-${colourIdx}-${floors}-${bays}`;
    if (!facadeCache.has(key)) {
      const palette = FACADE_PALETTES[districtId];
      const tex = paintFacade(rng, palette[colourIdx % palette.length], floors, bays);
      const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffca7a, emissiveMap: tex, emissiveIntensity: 0 });
      windowMaterials.push(mat);
      facadeCache.set(key, mat);
    }
    return facadeCache.get(key);
  };

  for (let bi = 0; bi < ROAD_LINES.length - 1; bi++) {
    for (let bj = 0; bj < ROAD_LINES.length - 1; bj++) {
      const cx = (ROAD_LINES[bi] + ROAD_LINES[bi + 1]) / 2;
      const cz = (ROAD_LINES[bj] + ROAD_LINES[bj + 1]) / 2;
      const inner = CITY.blockSize - CITY.roadWidth - CITY.sidewalkWidth * 0.6;
      const district = districtAt(cx, cz);
      if (cx > CITY.harbourX - 26) continue; // harbour apron stays open

      const slab = new THREE.Mesh(new THREE.BoxGeometry(inner + 3, 0.24, inner + 3), slabMat);
      slab.position.set(cx, 0.12, cz);
      scene.add(slab);

      if (district.id === 'pasar' && rng.chance(0.55)) {
        // Market block: a ring of striped stalls instead of towers.
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * Math.PI * 2;
          const sx = cx + Math.cos(a) * inner * 0.3;
          const sz = cz + Math.sin(a) * inner * 0.3;
          const stall = new THREE.Group();
          const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 2), new THREE.MeshLambertMaterial({ color: 0x9a744e }));
          counter.position.y = 0.55;
          stall.add(counter);
          const awning = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.14, 2.6), stallMats[s % stallMats.length]);
          awning.position.y = 2.3;
          awning.rotation.z = 0.1;
          stall.add(awning);
          stall.position.set(sx, 0.24, sz);
          stall.rotation.y = -a + Math.PI / 2;
          scene.add(stall);
          colliders.push({ x: sx, z: sz, hw: 1.8, hd: 1.3 });
        }
      } else {
        const plots = rng.int(2, 4);
        for (let p = 0; p < plots; p++) {
          const bw = rng.range(9, inner * 0.44);
          const bd = rng.range(9, inner * 0.44);
          const bx = cx + rng.range(-1, 1) * (inner / 2 - bw / 2 - 1);
          const bz = cz + rng.range(-1, 1) * (inner / 2 - bd / 2 - 1);
          const tall = district.id === 'kotatua' ? rng.range(10, 26) : district.id === 'bukit' ? rng.range(6, 13) : rng.range(8, 30);
          const floors = Math.max(2, Math.round(tall / 3));
          const mat = facadeFor(district.id, rng.int(0, 3), floors, rng.int(3, 5));
          const roofMat = new THREE.MeshLambertMaterial({ color: district.tint });
          const building = new THREE.Mesh(new THREE.BoxGeometry(bw, tall, bd), [roofMat, roofMat, roofMat, roofMat, mat, mat]);
          building.position.set(bx, 0.24 + tall / 2, bz);
          scene.add(building);
          colliders.push({ x: bx, z: bz, hw: bw / 2, hd: bd / 2 });
        }
      }

      // Palms and lamps dress the block corners.
      for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cornerX = cx + px * (inner / 2 + 1.4);
        const cornerZ = cz + pz * (inner / 2 + 1.4);
        if (rng.chance(0.62)) {
          const palm = makePalm(rng);
          palm.position.set(cornerX, 0.1, cornerZ);
          palm.scale.setScalar(rng.range(0.85, 1.25));
          scene.add(palm);
        } else if (rng.chance(0.8)) {
          const lamp = new THREE.Group();
          const pole = new THREE.Mesh(lampPoleGeo, lampPoleMat);
          pole.position.y = 2.6;
          lamp.add(pole);
          const head = new THREE.Mesh(lampHeadGeo, lampHeadMaterial);
          head.position.y = 5.25;
          lamp.add(head);
          lamp.position.set(cornerX, 0, cornerZ);
          scene.add(lamp);
        }
      }
    }
  }

  // --- harbour: pier, cranes, boats, warehouse -----------------------------
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(120, 1.1, 26), pierMat);
  pier.position.set(CITY.harbourX + 44, 0.1, 22);
  scene.add(pier);
  colliders.push({ x: CITY.harbourX + 44, z: 22 - 16, hw: 60, hd: 1 }); // pier back rail line (soft)

  const warehouse = new THREE.Mesh(
    new THREE.BoxGeometry(30, 11, 20),
    new THREE.MeshLambertMaterial({ color: 0x707880 })
  );
  warehouse.position.set(CITY.harbourX - 8, 5.5, -30);
  scene.add(warehouse);
  colliders.push({ x: CITY.harbourX - 8, z: -30, hw: 15, hd: 10 });

  const craneMat = new THREE.MeshLambertMaterial({ color: 0xd9822e });
  for (const cz of [-6, 52]) {
    const crane = new THREE.Group();
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 17, 1.2), craneMat);
    leg.position.y = 8.5;
    crane.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(17, 1, 1), craneMat);
    arm.position.set(6, 16.6, 0);
    crane.add(arm);
    crane.position.set(CITY.harbourX + 6, 0, cz);
    scene.add(crane);
    colliders.push({ x: CITY.harbourX + 6, z: cz, hw: 1, hd: 1 });
  }

  const hullColours = [0xc94f38, 0x2e7d9e, 0xe0a83a, 0x4a9e57, 0xd9d3c3];
  for (let i = 0; i < 5; i++) {
    const boat = makeBoat(rng, hullColours[i]);
    boat.position.set(CITY.harbourX + 26 + (i % 2) * 26, CITY.waterLevel + 0.4, -38 + i * 26);
    boat.rotation.y = i % 2 ? Math.PI : 0;
    scene.add(boat);
    boats.push(boat);
  }

  // World boundary: keep the player inside the island roads.
  const B = CITY.halfSize + 14;
  colliders.push({ x: 0, z: -B - 10, hw: B + 20, hd: 10 });
  colliders.push({ x: 0, z: B + 26, hw: B + 20, hd: 10 });
  colliders.push({ x: -B - 10, z: 0, hw: 10, hd: B + 20 });

  return {
    colliders,
    boats,
    // Called every frame: bob the boats, and restyle the city for night/rain.
    update(elapsed, nightFactor, wetFactor) {
      for (const boat of boats) {
        boat.position.y = CITY.waterLevel + 0.4 + Math.sin(elapsed * 0.9 + boat.userData.bobPhase) * 0.16;
        boat.rotation.z = Math.sin(elapsed * 0.7 + boat.userData.bobPhase) * 0.03;
      }
      lampHeadMaterial.color.setRGB(
        0.33 + nightFactor * 0.67,
        0.29 + nightFactor * 0.6,
        0.2 + nightFactor * 0.25
      );
      for (const mat of windowMaterials) mat.emissiveIntensity = nightFactor * 0.55;
      const wet = 1 - wetFactor * 0.35;
      roadMat.color.setRGB(0.2 * wet, 0.2 * wet, 0.23 * wet);
    },
  };
}

// Is a point on asphalt? Used by traffic, pedestrians and spawn logic.
export function isOnRoad(x, z) {
  const half = CITY.roadWidth / 2 + 0.4;
  return ROAD_LINES.some((l) => Math.abs(x - l) < half || Math.abs(z - l) < half);
}

// Push a circle (x, z, radius) out of every building footprint it overlaps.
// Mutates and returns the position object {x, z}.
export function resolveCollisions(pos, radius, colliders) {
  for (const c of colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const overlapX = c.hw + radius - Math.abs(dx);
    const overlapZ = c.hd + radius - Math.abs(dz);
    if (overlapX > 0 && overlapZ > 0) {
      if (overlapX < overlapZ) pos.x = c.x + (dx >= 0 ? 1 : -1) * (c.hw + radius);
      else pos.z = c.z + (dz >= 0 ? 1 : -1) * (c.hd + radius);
    }
  }
  pos.x = clamp(pos.x, -CITY.halfSize - 8, CITY.halfSize + 130);
  pos.z = clamp(pos.z, -CITY.halfSize - 8, CITY.halfSize + 30);
  return pos;
}
