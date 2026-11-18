// world.js — grows the island city of Teluk Kirana from a seed: the street
// grid, four districts of procedural buildings, the harbour with its cranes and
// container yards, the plaza, the beaches and the south pier. It also owns the
// collision boxes and the named landmarks the missions point at.

import * as THREE from '../vendor/three.module.min.js';
import { CITY, PALETTE, districtAt } from './config.js';
import {
  boxPart, coloredMesh, coloredPart, cylinderPart,
  makeCanvasTexture, mergeColoredParts, planePart, spherePart,
} from './geometry.js';

// Named, reachable places on streets, yards and the pier. Missions and the
// minimap read these; every coordinate sits on open ground a car can reach.
export const LANDMARKS = {
  cafeSari: { x: -180, z: 72, label: 'Kafe Sari' },
  dockGate: { x: 252, z: 60, label: 'Dock Gate' },
  dockYard: { x: 268, z: -60, label: 'Container Yard' },
  garageBimo: { x: 120, z: -48, label: 'Bimo Garage' },
  bankKirana: { x: 0, z: -84, label: 'Bank Kirana' },
  hotelPalem: { x: -72, z: -180, label: 'Hotel Palem' },
  safehouse: { x: -228, z: -120, label: 'Safehouse' },
  pierEnd: { x: 0, z: 344, label: 'Kirana Pier' },
  raceStart: { x: 180, z: 252, label: 'Beach Road' },
  passengerSpot: { x: 60, z: 120, label: 'Downtown Corner' },
  plaza: { x: -30, z: -30, label: 'Plaza Kirana' },
};

const FACADE_COLORS = [
  ['#f3e2bb', '#c7512f'], ['#ffe9c9', '#2f7f8f'], ['#f7d9a0', '#7a4a8f'],
  ['#d9ecff', '#31597f'], ['#ffe3d3', '#3f7a4e'], ['#f9f1dc', '#a03d5c'],
];

function facadeTexture(rng, base, trim) {
  return makeCanvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = trim;
    ctx.fillRect(0, 0, w, 10);
    ctx.fillRect(0, h - 12, w, 12);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = rng.chance(0.42) ? '#ffd98c' : '#33505e';
        ctx.fillRect(10 + c * 29, 18 + r * 25, 19, 15);
      }
    }
  });
}

function glassTexture(rng) {
  return makeCanvasTexture(128, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#7fd4e8');
    grad.addColorStop(0.55, '#3d8fa8');
    grad.addColorStop(1, '#2c6a86');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 5; c++) {
        if (rng.chance(0.3)) ctx.fillRect(8 + c * 24, 10 + r * 20, 15, 11);
      }
    }
    ctx.fillStyle = 'rgba(255,217,140,0.5)';
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 5; c++) {
        if (rng.chance(0.22)) ctx.fillRect(8 + c * 24, 10 + r * 20, 15, 11);
      }
    }
  });
}

function spawnContainer(group, x, z, rng, addCollider) {
  const colors = [0xc7512f, 0x2f7f8f, 0xf2b13c, 0x3f7a4e, 0x7a4a8f, 0xb8b0a0];
  const levels = rng.chance(0.35) ? 2 : 1;
  const ry = rng.chance(0.5) ? 0 : Math.PI / 2;
  const w = 6.1;
  const d = 2.44;
  for (let l = 0; l < levels; l++) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w, 2.6, d),
      new THREE.MeshLambertMaterial({ color: rng.pick(colors) }),
    );
    box.position.set(x, 1.3 + l * 2.62, z);
    box.rotation.y = ry;
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
  }
  addCollider(x, z, ry === 0 ? w : d, ry === 0 ? d : w);
}

export function buildWorld(scene, rng) {
  const colliders = [];
  const addCollider = (cx, cz, w, d) => {
    colliders.push({
      minX: cx - w / 2, maxX: cx + w / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2,
    });
  };
  const group = new THREE.Group();
  scene.add(group);
  const boats = [];

  // ---- Sea, island base, city ground -------------------------------------
  const seaTex = makeCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#12808f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    for (let i = 0; i < 46; i++) {
      ctx.fillRect(rng.range(0, w), rng.range(0, h), rng.range(6, 22), 2);
    }
    ctx.fillStyle = 'rgba(6,60,80,0.25)';
    for (let i = 0; i < 30; i++) {
      ctx.fillRect(rng.range(0, w), rng.range(0, h), rng.range(8, 26), 3);
    }
  }, 60, 60);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 2600),
    new THREE.MeshLambertMaterial({ map: seaTex, color: 0x9fd8de }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = CITY.waterLevel;
  group.add(sea);

  const island = new THREE.Mesh(
    new THREE.BoxGeometry(CITY.landHalf * 2, 1.2, CITY.landHalf * 2),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  island.position.y = -0.62;
  island.receiveShadow = true;
  group.add(island);

  const roadTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3c4148';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 500; i++) ctx.fillRect(rng.range(0, w), rng.range(0, h), 2, 2);
    ctx.fillStyle = '#2f3339';
    ctx.fillRect(w / 2 - 26, 0, 9, h);
    ctx.fillRect(w / 2 + 17, 0, 9, h);
    ctx.fillRect(0, h / 2 - 26, w, 9);
    ctx.fillRect(0, h / 2 + 17, w, 9);
    ctx.fillStyle = '#f5e9c9';
    for (let y = 6; y < h; y += 34) ctx.fillRect(w / 2 - 2, y, 4, 18);
    for (let x = 6; x < w; x += 34) ctx.fillRect(x, h / 2 - 2, 18, 4);
  }, 9, 9);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(540, 540),
    new THREE.MeshLambertMaterial({ map: roadTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.02;
  ground.receiveShadow = true;
  group.add(ground);

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 636),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(-294, 0.015, 0);
  group.add(grass);

  // ---- Sidewalk blocks + buildings ---------------------------------------
  const sidewalkTex = makeCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b9ac97';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(90,80,60,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 160; i++) ctx.fillRect(rng.range(0, w), rng.range(0, h), 2, 2);
  });
  const sidewalkMat = new THREE.MeshLambertMaterial({ map: sidewalkTex });
  const facades = FACADE_COLORS.map(
    ([b, t]) => new THREE.MeshLambertMaterial({ map: facadeTexture(rng, b, t) }),
  );
  const glassMats = [0, 1].map(() => new THREE.MeshLambertMaterial({ map: glassTexture(rng) }));
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xa34a30 });
  const warehouseMat = new THREE.MeshLambertMaterial({ color: 0x8f9aa2 });
  const warehouseTrim = new THREE.MeshLambertMaterial({ color: 0xc7512f });

  const addBuilding = (cx, cz, w, hgt, d, mat, roof = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat);
    mesh.position.set(cx, CITY.sidewalkTop + hgt / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (roof) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.5, d + 0.7), roofMat);
      cap.position.set(cx, CITY.sidewalkTop + hgt + 0.25, cz);
      cap.castShadow = true;
      group.add(cap);
    }
    addCollider(cx, cz, w + 0.4, d + 0.4);
    return mesh;
  };

  const palmSpots = [];
  const blockCenters = [];
  for (let gx = -210; gx <= 210; gx += 60) {
    for (let gz = -210; gz <= 210; gz += 60) blockCenters.push({ bx: gx, bz: gz });
  }

  for (const { bx, bz } of blockCenters) {
    const isPlaza = bx === -30 && bz === -30;
    const walkMat = isPlaza
      ? new THREE.MeshLambertMaterial({ color: 0x86b364 })
      : sidewalkMat;
    const walk = new THREE.Mesh(new THREE.BoxGeometry(46, CITY.sidewalkTop * 2, 46), walkMat);
    walk.position.set(bx, CITY.sidewalkTop / 2 - 0.02, bz);
    walk.receiveShadow = true;
    group.add(walk);
    if (isPlaza) {
      const fountain = coloredMesh([
        cylinderPart(3.4, 3.8, 0.9, 14, 0xd8cfc0, 0, 0.45, 0),
        cylinderPart(0.5, 0.7, 2.2, 8, 0xb9ac97, 0, 1.4, 0),
        spherePart(0.55, 0x7fd4e8, 0, 2.6, 0),
      ]);
      fountain.position.set(bx, CITY.sidewalkTop, bz);
      group.add(fountain);
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(3.1, 20),
        new THREE.MeshLambertMaterial({ color: 0x3fa8bc }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(bx, CITY.sidewalkTop + 0.82, bz);
      group.add(pool);
      addCollider(bx, bz, 7.6, 7.6);
      for (let k = 0; k < 5; k++) {
        palmSpots.push({ x: bx + rng.range(-19, 19), z: bz + rng.range(-19, 19) });
      }
      continue;
    }
    const district = districtAt(bx, bz).id;
    if (district === 'downtown') {
      const tall = rng.chance(0.72);
      const w = rng.range(19, 27);
      addBuilding(
        bx + rng.range(-4, 4), bz + rng.range(-4, 4), w,
        tall ? rng.range(28, 56) : rng.range(13, 22), w, rng.pick(glassMats),
      );
      if (rng.chance(0.5)) {
        addBuilding(
          bx + rng.range(-14, 14), bz + rng.range(-14, 14),
          10, rng.range(6, 10), 10, rng.pick(facades),
        );
      }
    } else if (district === 'oldtown') {
      for (const [ox, oz] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
        if (rng.chance(0.82)) {
          addBuilding(bx + ox, bz + oz, rng.range(10, 14), rng.range(7, 13), rng.range(10, 14), rng.pick(facades));
        }
      }
    } else if (district === 'palm') {
      for (const [ox, oz] of [[-11, 0], [11, -8], [2, 12]]) {
        if (!rng.chance(0.85)) continue;
        const hx = bx + ox;
        const hz = bz + oz;
        addBuilding(hx, hz, 11, rng.range(5, 7.5), 10, rng.pick(facades), false);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(9.4, 3.4, 4), roofMat);
        roof.position.set(hx, CITY.sidewalkTop + 7.6, hz);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);
        palmSpots.push({ x: hx + rng.range(-9, 9), z: hz + rng.range(-9, 9) });
      }
    } else {
      // Harbour: warehouse + a few containers per block.
      if (rng.chance(0.8)) {
        const wh = addBuilding(bx, bz, rng.range(26, 34), rng.range(8, 11), rng.range(16, 22), warehouseMat, false);
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(wh.geometry.parameters.width + 0.2, 1.1, wh.geometry.parameters.depth + 0.2),
          warehouseTrim,
        );
        stripe.position.set(bx, CITY.sidewalkTop + 2.2, bz);
        group.add(stripe);
      }
      for (let k = 0; k < 3; k++) {
        spawnContainer(group, bx + rng.range(-17, 17), bz + rng.range(-17, 17), rng, addCollider);
      }
    }
    if (rng.chance(0.75)) palmSpots.push({ x: bx + rng.range(-21, 21), z: bz > 0 ? bz + 21 : bz - 21 });
    if (rng.chance(0.5)) palmSpots.push({ x: bx > 0 ? bx + 21 : bx - 21, z: bz + rng.range(-21, 21) });
  }

  // ---- Harbour cranes, dock deck, container yard --------------------------
  for (const cz of [-120, 0, 120]) {
    const crane = coloredMesh([
      boxPart(1.6, 17, 1.6, 0xe8762c, -7, 8.5, 0),
      boxPart(1.6, 17, 1.6, 0xe8762c, 7, 8.5, 0),
      boxPart(24, 1.8, 2.2, 0xe8762c, 0, 17.4, 0),
      boxPart(1.1, 6.5, 1.1, 0x5a4632, 4.5, 13.6, 0),
      boxPart(3.2, 2.2, 3.2, 0x31597f, 4.5, 10.2, 0),
      boxPart(3.4, 3, 0.9, 0x2c3540, -9.5, 15.4, 0),
    ]);
    crane.position.set(292, 0, cz);
    group.add(crane);
    addCollider(285, cz, 2.4, 2.4);
    addCollider(299, cz, 2.4, 2.4);
  }
  const dock = new THREE.Mesh(
    new THREE.BoxGeometry(52, 0.8, 560),
    new THREE.MeshLambertMaterial({ color: 0x9a8d76 }),
  );
  dock.position.set(292, 0.0, 0);
  dock.receiveShadow = true;
  group.add(dock);
  for (let k = 0; k < 14; k++) {
    spawnContainer(group, rng.range(272, 312), rng.range(-250, 250), rng, addCollider);
  }

  // ---- South pier + boats --------------------------------------------------
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(20, 0.9, 74),
    new THREE.MeshLambertMaterial({ color: 0x8a6844 }),
  );
  pier.position.set(0, 0.05, 318 + 30);
  pier.receiveShadow = true;
  group.add(pier);
  const postMat = new THREE.MeshLambertMaterial({ color: 0x6b4e2e });
  for (let pz = 300; pz <= 378; pz += 13) {
    for (const px of [-9.4, 9.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.6, 6), postMat);
      post.position.set(px, -0.6, pz);
      group.add(post);
    }
  }
  const boatAt = (x, z, ry, hullColor) => {
    const boat = coloredMesh([
      boxPart(4.4, 1.3, 11, hullColor, 0, 0.4, 0),
      boxPart(3.4, 0.7, 7.5, 0xf3ead8, 0, 1.25, -0.6),
      boxPart(2.4, 1.5, 3, 0xe8f2f4, 0, 2.2, -1.4),
      cylinderPart(0.09, 0.09, 6.4, 6, 0x8a6844, 0, 4.6, 1.8),
      planePart(3.4, 4.4, 0xfff6e0, 0.1, 4.4, 1.9, 0, Math.PI / 2, 0),
    ], { doubleSide: true });
    boat.position.set(x, CITY.waterLevel + 0.35, z);
    boat.rotation.y = ry;
    group.add(boat);
    boats.push({ mesh: boat, baseY: CITY.waterLevel + 0.35, phase: rng.range(0, 6) });
    return boat;
  };
  boatAt(4, 372, 0.2, 0xc7512f);
  boatAt(-70, 352, -0.5, 0x2f7f8f);
  boatAt(120, 366, 0.9, 0xf2b13c);
  boatAt(330, -190, 0.4, 0x7a4a8f);

  // ---- Beach dressing: umbrellas + extra palms ----------------------------
  for (let bx = -280; bx <= 280; bx += 40) {
    if (Math.abs(bx) < 26) continue;
    const um = coloredMesh([
      cylinderPart(0.09, 0.09, 2.6, 6, 0xf3ead8, 0, 1.3, 0),
      coloredPart(new THREE.ConeGeometry(2.3, 0.9, 8), rng.pick([0xe2483d, 0xf2b13c, 0x2f9e8f]), 0, 2.7, 0),
    ]);
    um.position.set(bx + rng.range(-6, 6), 0, 292 + rng.range(-4, 10));
    group.add(um);
  }
  for (let k = 0; k < 70; k++) {
    const side = rng.int(0, 3);
    const along = rng.range(-300, 300);
    if (side === 0) palmSpots.push({ x: along, z: rng.range(282, 306) });
    else if (side === 1) palmSpots.push({ x: along, z: rng.range(-306, -282) });
    else if (side === 2) palmSpots.push({ x: rng.range(-306, -282), z: along });
    else palmSpots.push({ x: rng.range(282, 306), z: along });
  }

  // ---- Palms (instanced trunks + frond stars) ------------------------------
  const trunkGeom = new THREE.CylinderGeometry(0.14, 0.3, 5.2, 6);
  trunkGeom.translate(0, 2.6, 0);
  const trunkMesh = new THREE.InstancedMesh(
    trunkGeom, new THREE.MeshLambertMaterial({ color: 0x8a6844 }), palmSpots.length,
  );
  const frondParts = [];
  for (let f = 0; f < 7; f++) {
    const a = (f / 7) * Math.PI * 2;
    frondParts.push(coloredPart(
      new THREE.PlaneGeometry(3.6, 1.05),
      f % 2 ? 0x3f9e4d : 0x358f43,
      Math.cos(a) * 1.55, 0.1 - Math.abs(Math.sin(a)) * 0.1, Math.sin(a) * 1.55,
      -0.5, -a, 0,
    ));
  }
  const frondGeom = mergeColoredParts(frondParts);
  const frondMesh = new THREE.InstancedMesh(
    frondGeom,
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    palmSpots.length,
  );
  const dummy = new THREE.Object3D();
  palmSpots.forEach((spot, i) => {
    const lean = rng.range(0.04, 0.2);
    const leanDir = rng.range(0, Math.PI * 2);
    dummy.position.set(spot.x, 0, spot.z);
    dummy.rotation.set(Math.cos(leanDir) * lean, rng.range(0, 6.28), Math.sin(leanDir) * lean);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 5.05;
    dummy.position.x += Math.sin(leanDir) * lean * 4.4;
    dummy.position.z += Math.cos(leanDir) * lean * 4.4;
    dummy.rotation.set(0, rng.range(0, 6.28), 0);
    dummy.updateMatrix();
    frondMesh.setMatrixAt(i, dummy.matrix);
    colliders.push({
      minX: spot.x - 0.45, maxX: spot.x + 0.45,
      minZ: spot.z - 0.45, maxZ: spot.z + 0.45,
    });
  });
  trunkMesh.castShadow = true;
  group.add(trunkMesh);
  group.add(frondMesh);

  // ---- Streetlights at intersections ---------------------------------------
  const poleGeom = mergeColoredParts([
    cylinderPart(0.09, 0.13, 5.6, 6, 0x3a4149, 0, 2.8, 0),
    boxPart(1.9, 0.16, 0.16, 0x3a4149, 0.85, 5.55, 0),
  ]);
  const lightPositions = [];
  for (let gx = -240; gx <= 240; gx += 120) {
    for (let gz = -240; gz <= 240; gz += 120) {
      lightPositions.push({ x: gx + 9.5, z: gz + 9.5, ry: Math.PI });
      lightPositions.push({ x: gx - 9.5, z: gz - 9.5, ry: 0 });
    }
  }
  const poleMesh = new THREE.InstancedMesh(
    poleGeom, new THREE.MeshLambertMaterial({ vertexColors: true }), lightPositions.length,
  );
  const headMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.7, 0.18, 0.34),
    new THREE.MeshBasicMaterial({ color: 0xffd98c }), lightPositions.length,
  );
  lightPositions.forEach((lp, i) => {
    dummy.position.set(lp.x, 0, lp.z);
    dummy.rotation.set(0, lp.ry, 0);
    dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.x += Math.cos(lp.ry) * -1.7;
    dummy.position.y = 5.5;
    dummy.updateMatrix();
    headMesh.setMatrixAt(i, dummy.matrix);
  });
  group.add(poleMesh);
  group.add(headMesh);

  // ---- Billboards over downtown --------------------------------------------
  const billboardTex = makeCanvasTexture(512, 128, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#c7512f');
    grad.addColorStop(0.55, '#e8762c');
    grad.addColorStop(1, '#f2b13c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff6df';
    ctx.font = '900 54px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TELUK KIRANA', w / 2, 58);
    ctx.font = '700 25px Arial, sans-serif';
    ctx.fillStyle = '#ffe9c4';
    ctx.fillText('· HEAT SEASON ·', w / 2, 98);
  });
  for (const [bx, bz, ry] of [[-60, 8, Math.PI / 2], [68, -60, -Math.PI / 2]]) {
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 4.3),
      new THREE.MeshBasicMaterial({ map: billboardTex, side: THREE.DoubleSide }),
    );
    board.position.set(bx, 15.5, bz);
    board.rotation.y = ry;
    group.add(board);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 15.5, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a4149 }),
    );
    post.position.set(bx, 7.7, bz);
    group.add(post);
    addCollider(bx, bz, 1, 1);
  }

  // Cosmetic animation: drifting sea sparkle, bobbing boats.
  const updateCosmetic = (t) => {
    seaTex.offset.set((t * 0.008) % 1, (t * 0.005) % 1);
    for (const b of boats) {
      b.mesh.position.y = b.baseY + Math.sin(t * 0.9 + b.phase) * 0.14;
      b.mesh.rotation.z = Math.sin(t * 0.7 + b.phase) * 0.02;
    }
  };

  return { colliders, updateCosmetic, group };
}

// True when a point sits on asphalt (a street, the dock or the pier deck).
export function isOnRoad(x, z) {
  if (Math.abs(x) < 11 && z > 292 && z < 388) return true; // pier
  if (x > 262 && x < 322 && Math.abs(z) < 285) return true; // dock apron
  if (Math.abs(x) > 272 || Math.abs(z) > 272) return false;
  const lineDist = (v) => {
    const m = ((v % 60) + 60) % 60;
    return Math.min(m, 60 - m);
  };
  return lineDist(x) <= 8.6 || lineDist(z) <= 8.6;
}

// Resolve a circle at (x, z) with radius r out of every building box.
export function resolveCollisions(pos, radius, colliders) {
  for (const c of colliders) {
    const nearestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nearestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nearestX;
    const dz = pos.z - nearestZ;
    const d2 = dx * dx + dz * dz;
    if (d2 > radius * radius) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x = nearestX + (dx / d) * radius;
      pos.z = nearestZ + (dz / d) * radius;
    } else {
      // Centre inside the box: push out along the smallest penetration axis.
      const pushLeft = pos.x - c.minX;
      const pushRight = c.maxX - pos.x;
      const pushBack = pos.z - c.minZ;
      const pushFront = c.maxZ - pos.z;
      const min = Math.min(pushLeft, pushRight, pushBack, pushFront);
      if (min === pushLeft) pos.x = c.minX - radius;
      else if (min === pushRight) pos.x = c.maxX + radius;
      else if (min === pushBack) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
  const lim = CITY.landHalf - 2;
  if (pos.z > 292 && Math.abs(pos.x) < 10.5) {
    pos.x = Math.max(-9.8, Math.min(9.8, pos.x));
    pos.z = Math.min(384, pos.z);
  } else {
    pos.x = Math.max(-lim, Math.min(lim, pos.x));
    pos.z = Math.max(-lim, Math.min(lim, pos.z));
  }
}
