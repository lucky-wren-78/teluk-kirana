// rng.js - small seeded random number helpers for Teluk Kirana.
// The whole city is built from one seed so a given seed always
// produces the same streets, buildings and parked cars.

// mulberry32 is a tiny fast PRNG with a 32 bit state.
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A friendly wrapper around a raw generator function.
export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed);
  }
  // Float in [0, 1).
  float() {
    return this.next();
  }
  // Float in [min, max).
  range(min, max) {
    return min + (max - min) * this.next();
  }
  // Integer in [min, max] inclusive.
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  // True with the given probability.
  chance(p) {
    return this.next() < p;
  }
  // One random element of an array.
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  // Sign helper, returns -1 or 1.
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }
}

// Read the seed from the page query string, falling back to a default.
export function seedFromQuery(fallback) {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('seed');
    if (raw === null) return fallback;
    const value = parseInt(raw, 10);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

// Read the requested screenshot scene name from the query string.
export function shotFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('shot');
  } catch {
    return null;
  }
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed angle difference from a to b, in radians.
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Turn current heading toward target heading at a limited rate.
export function turnToward(current, target, maxStep) {
  const d = angleDelta(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function distance2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
