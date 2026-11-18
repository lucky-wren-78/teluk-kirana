// pedestrians.js — the walking population of Teluk Kirana. Each pedestrian is
// a single merged-colour figure strolling the sidewalk rings of the city blocks;
// they pick a new corner when they arrive, scatter when a car comes too close,
// and fall down when one actually hits them (main.js turns that into a crime).

import { boxPart, coloredMesh, spherePart } from './geometry.js';
import { distance2d } from './random.js';
import { resolveCollisions } from './world.js';

const PED_PALETTES = [
  { shirt: 0xe2483d, pants: 0x2c3550, skin: 0xc98a5e },
  { shirt: 0xf2b13c, pants: 0x51402a, skin: 0x8a5a34 },
  { shirt: 0x2f9e8f, pants: 0xe8e2d4, skin: 0xe8b088 },
  { shirt: 0x7a4a8f, pants: 0x22262c, skin: 0x6e4525 },
  { shirt: 0xf3ead8, pants: 0x31597f, skin: 0xc98a5e },
  { shirt: 0x31597f, pants: 0xb8b0a0, skin: 0x8a5a34 },
  { shirt: 0xff7fa5, pants: 0x2c3550, skin: 0xe8b088 },
  { shirt: 0x3f7a4e, pants: 0x51402a, skin: 0x6e4525 },
];

export function buildPedestrianMesh(palette) {
  return coloredMesh([
    boxPart(0.21, 0.82, 0.24, palette.pants, -0.13, 0.43, 0),
    boxPart(0.21, 0.82, 0.24, palette.pants, 0.13, 0.43, 0),
    boxPart(0.56, 0.62, 0.3, palette.shirt, 0, 1.18, 0),
    boxPart(0.15, 0.66, 0.17, palette.shirt, -0.37, 1.12, 0),
    boxPart(0.15, 0.66, 0.17, palette.shirt, 0.37, 1.12, 0),
    spherePart(0.21, palette.skin, 0, 1.68, 0),
  ]);
}

// A corner of a random block within reach: sidewalks ring every block at ±21.
function randomSidewalkTarget(rng, nearX, nearZ) {
  for (let tries = 0; tries < 8; tries++) {
    const blockX = Math.floor(rng.range(-3.5, 3.5)) * 60 + 30;
    const blockZ = Math.floor(rng.range(-3.5, 3.5)) * 60 + 30;
    const cx = blockX + (rng.chance(0.5) ? -21 : 21);
    const cz = blockZ + (rng.chance(0.5) ? -21 : 21);
    if (distance2d(cx, cz, nearX, nearZ) < 150) return { x: cx, z: cz };
  }
  return { x: nearX + rng.range(-40, 40), z: nearZ + rng.range(-40, 40) };
}

export function spawnPedestrians(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const palette = PED_PALETTES[i % PED_PALETTES.length];
    const mesh = buildPedestrianMesh(palette);
    const start = randomSidewalkTarget(rng, 0, 0);
    mesh.position.set(start.x + rng.range(-3, 3), 0, start.z + rng.range(-3, 3));
    scene.add(mesh);
    peds.push({
      mesh,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.1, 2.1),
      target: randomSidewalkTarget(rng, mesh.position.x, mesh.position.z),
      downTime: 0,
      panicTime: 0,
      bobPhase: rng.range(0, 6),
      get x() { return mesh.position.x; },
      get z() { return mesh.position.z; },
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt, rng, colliders, t, threat) {
  for (const ped of peds) {
    if (ped.downTime > 0) {
      ped.downTime -= dt;
      ped.mesh.rotation.x = Math.min(Math.PI / 2, ped.mesh.rotation.x + dt * 7);
      if (ped.downTime <= 0) ped.mesh.rotation.x = 0;
      continue;
    }
    let speed = ped.speed;
    if (threat && distance2d(ped.x, ped.z, threat.x, threat.z) < 9 && threat.speed > 6) {
      ped.panicTime = 1.2;
    }
    if (ped.panicTime > 0) {
      ped.panicTime -= dt;
      speed = 5.2;
      // Run directly away from the threat.
      ped.heading = Math.atan2(ped.x - threat.x, ped.z - threat.z);
    } else {
      const dx = ped.target.x - ped.x;
      const dz = ped.target.z - ped.z;
      if (Math.hypot(dx, dz) < 1.6) ped.target = randomSidewalkTarget(rng, ped.x, ped.z);
      else ped.heading = Math.atan2(dx, dz);
    }
    ped.mesh.position.x += Math.sin(ped.heading) * speed * dt;
    ped.mesh.position.z += Math.cos(ped.heading) * speed * dt;
    resolveCollisions(ped.mesh.position, 0.5, colliders);
    ped.mesh.rotation.y = ped.heading;
    ped.mesh.position.y = Math.abs(Math.sin(t * 6 + ped.bobPhase)) * 0.05;
  }
}

// Knocks a pedestrian down (a hit or a punch). Returns true if this call did it.
export function knockDownPedestrian(ped, seconds = 6) {
  if (ped.downTime > 0) return false;
  ped.downTime = seconds;
  return true;
}
