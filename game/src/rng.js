// rng.js — deterministic randomness.
// Everything procedural in Teluk Kirana (building heights, traffic colours,
// pedestrian shirts) draws from a seeded mulberry32 stream so a given seed
// always grows the same city — that is what makes the ?shot= scenes and the
// screenshot set reproducible.

// FNV-1a style string hash: turns a word seed ("harbor", "7") into a uint32.
export function hashSeedText(text) {
  let hash = 0x811c9dc5;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32: tiny, fast, good enough distribution for game dressing.
export function makeRng(seedInput) {
  let state = (typeof seedInput === 'string' ? hashSeedText(seedInput) : seedInput >>> 0) || 1;
  const nextFloat = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    float: nextFloat,
    range: (min, max) => min + nextFloat() * (max - min),
    int: (min, max) => Math.floor(min + nextFloat() * (max - min + 1)),
    pick: (list) => list[Math.floor(nextFloat() * list.length) % list.length],
    chance: (probability) => nextFloat() < probability,
    sign: () => (nextFloat() < 0.5 ? -1 : 1),
  };
}

// Linear interpolation and clamping helpers shared across modules.
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;

// Shortest-path angle blending, for steering and camera work.
export function lerpAngle(a, b, t) {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

export function distance2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
