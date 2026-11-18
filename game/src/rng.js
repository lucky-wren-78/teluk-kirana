// Teluk Kirana — deterministic randomness for the procedural city.
// A mulberry32 generator: tiny, fast, and stable across machines, so the
// same seed always grows the same streets, palms and paint jobs.
export function createRng(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function rangeInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick(rng, list) {
  if (!list.length) return undefined;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

export function chance(rng, probability) {
  return rng() < probability;
}

// FNV-1a hash of a short string, used to seed per-shot staging so every
// screenshot scene is laid out identically on every run.
export function seedFromString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}
