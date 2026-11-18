// Teluk Kirana: Heat Season — central tuning and world constants.
// Every number the other modules share lives here so a balance pass touches one file.
export const CONFIG = {
  worldSize: 440,
  roadSpacing: 44,
  roadWidth: 12,
  fixedStep: 1 / 60,
  interactRange: 4.5,
  playerWalkSpeed: 7.5,
  playerRunSpeed: 12,
  carTopSpeed: 34,
  carAccel: 16,
  bikeTopSpeed: 40,
  bikeAccel: 20,
  trafficSpeed: 9,
  maxWanted: 5,
  dayLengthSeconds: 240,
  gravity: 30,
  saveKey: 'teluk-kirana-save-v5',
};

// Player spawn: the south edge of Pasar Lama square, facing the market stalls.
export const PLAYER_SPAWN = { x: 6, z: 16, heading: 0 };

// Parked vehicles placed deliberately inside E-interaction range of PLAYER_SPAWN
// (bug #6 fix): the nearest car is ~2.9 m away, the bike ~2.8 m away.
export const PARKED_VEHICLES = [
  { kind: 'car', model: 'sedan', color: 0xd94f3d, x: 8.6, z: 15.2, heading: 1.35 },
  { kind: 'car', model: 'taxi', color: 0xf2b705, x: 2.4, z: 20.5, heading: -0.4 },
  { kind: 'bike', model: 'sport', color: 0x2e86de, x: 4.2, z: 18.6, heading: 0.6 },
  { kind: 'car', model: 'pickup', color: 0x3d9970, x: -14, z: 30, heading: 0.2 },
  { kind: 'car', model: 'sedan', color: 0x8e44ad, x: 30, z: -6, heading: 2.1 },
  { kind: 'bike', model: 'cruiser', color: 0xe67e22, x: -30, z: -18, heading: -1.2 },
  { kind: 'car', model: 'van', color: 0x95a5a6, x: 52, z: 44, heading: 0.9 },
  { kind: 'car', model: 'sedan', color: 0x1abc9c, x: -52, z: 52, heading: -2.2 },
];

export const DISTRICTS = [
  { name: 'Pelabuhan', cx: 170, cz: 0, r: 90, hue: 'harbor' },
  { name: 'Pasar Lama', cx: 0, cz: 0, r: 70, hue: 'market' },
  { name: 'Kota Tua', cx: -110, cz: -80, r: 85, hue: 'oldtown' },
  { name: 'Marina', cx: -60, cz: 130, r: 80, hue: 'marina' },
  { name: 'Bukit Kirana', cx: 90, cz: -130, r: 85, hue: 'hills' },
];

export const JOB_REWARDS = [400, 650, 900, 1200, 1500, 2000, 2600, 3500];

export const RADIO_STATIONS = [
  { id: 'kirana-fm', name: 'KIRANA FM 98.2 — pop tropis', bpm: 112, root: 220 },
  { id: 'ombak', name: 'OMBAK 101.5 — reggae pantai', bpm: 76, root: 196 },
  { id: 'jalan-raya', name: 'JALAN RAYA 88.0 — rock kota', bpm: 138, root: 165 },
];

export function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

export function safeDivide(numerator, denominator, fallback = 0) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return fallback;
  const out = numerator / denominator;
  return Number.isFinite(out) ? out : fallback;
}
