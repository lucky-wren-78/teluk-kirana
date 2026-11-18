// Teluk Kirana: Heat Season — v6 tuning table and world constants.
// One home for every shared number: physics, speeds, the clock, spawn data.
// If a balance tweak is needed, it should be a one-line change in this file.
export const CONFIG = {
  worldSize: 440,
  roadSpacing: 44,
  roadWidth: 12,
  fixedStep: 1 / 60,
  interactRange: 4.6,
  playerWalkSpeed: 7.6,
  playerRunSpeed: 12.4,
  carTopSpeed: 35,
  carAccel: 17,
  bikeTopSpeed: 41,
  bikeAccel: 21,
  trafficSpeed: 9.5,
  maxWanted: 5,
  dayLengthSeconds: 260,
  gravity: 30,
  saveKey: 'teluk-kirana-save-v6',
};

// Spawn: the south lip of Pasar Lama square, looking north into the stalls.
export const PLAYER_SPAWN = { x: 5, z: 18, heading: Math.PI };

// Vehicles parked on purpose within arm's reach of the spawn point, so the
// very first thing a new player can do is press E and drive away.
export const PARKED_VEHICLES = [
  { kind: 'bike', model: 'sport', color: 0x2471a3, x: 3.1, z: 15.4, heading: 2.8 },
  { kind: 'car', model: 'sedan', color: 0xc0392b, x: 8.4, z: 16.8, heading: 1.15 },
  { kind: 'car', model: 'taxi', color: 0xf39c12, x: 1.2, z: 22.6, heading: -0.7 },
  { kind: 'car', model: 'pickup', color: 0x1e8449, x: -16, z: 28, heading: 0.35 },
  { kind: 'car', model: 'hatch', color: 0x7d3c98, x: 28, z: -8, heading: 2.4 },
  { kind: 'bike', model: 'cruiser', color: 0xd35400, x: -28, z: -20, heading: -1.05 },
  { kind: 'car', model: 'van', color: 0xaab7b8, x: 50, z: 46, heading: 0.8 },
  { kind: 'car', model: 'sedan', color: 0x148f77, x: -54, z: 50, heading: -2.05 },
];

export const DISTRICTS = [
  { name: 'Pelabuhan', cx: 168, cz: -6, r: 95, hue: 'harbor' },
  { name: 'Pasar Lama', cx: 0, cz: 0, r: 72, hue: 'market' },
  { name: 'Kota Tua', cx: -108, cz: -82, r: 88, hue: 'oldtown' },
  { name: 'Marina', cx: -62, cz: 128, r: 82, hue: 'marina' },
  { name: 'Bukit Kirana', cx: 92, cz: -128, r: 88, hue: 'hills' },
];

export const JOB_REWARDS = [420, 680, 950, 1250, 1600, 2100, 2700, 3600];

export const RADIO_STATIONS = [
  { id: 'kirana-fm', name: 'KIRANA FM 98.2 — pop tropis', bpm: 116, root: 233 },
  { id: 'ombak', name: 'OMBAK 101.5 — reggae pantai', bpm: 74, root: 185 },
  { id: 'jalan-raya', name: 'JALAN RAYA 88.0 — rock kota', bpm: 142, root: 175 },
];

export function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function safeDivide(numerator, denominator, fallback = 0) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return fallback;
  const out = numerator / denominator;
  return Number.isFinite(out) ? out : fallback;
}

export function districtAt(x, z) {
  let best = DISTRICTS[1];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dist = (x - d.cx) * (x - d.cx) + (z - d.cz) * (z - d.cz);
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return best;
}
