// config.js — every tuning number for Teluk Kirana in one place.
// The city is a square grid: roads run along the lines listed in ROAD_LINES,
// city blocks fill the gaps, and each block belongs to one of five districts.

export const CITY = {
  halfSize: 220,          // world extends from -220 to +220 on x and z
  blockSize: 44,          // distance between neighbouring road centrelines
  roadWidth: 11,          // asphalt width
  sidewalkWidth: 3.2,     // pavement ring around each block
  waterLevel: -0.55,      // sea plane height (harbour edge sits on +x side)
  harbourX: 176,          // east of this x, the ground gives way to the pier
};

// Road centrelines on both axes; traffic and pedestrians navigate by these.
export const ROAD_LINES = [-198, -154, -110, -66, -22, 22, 66, 110, 154, 198];

export const DISTRICTS = [
  { id: 'pelabuhan', name: 'Pelabuhan', tint: 0x8a6f4d, note: 'harbour and pier' },
  { id: 'pasar',     name: 'Pasar',     tint: 0xc96f2e, note: 'market stalls' },
  { id: 'bukit',     name: 'Bukit',     tint: 0x5d8a4a, note: 'hill residences' },
  { id: 'pantai',    name: 'Pantai',    tint: 0xd9b36a, note: 'beachfront' },
  { id: 'kotatua',   name: 'Kota Tua',  tint: 0x9a4a3a, note: 'old town' },
];

// Which district a world position falls into, by quadrant-ish bands.
export function districtAt(x, z) {
  if (x > 132) return DISTRICTS[0];            // Pelabuhan, the east strip
  if (z > 88) return DISTRICTS[3];             // Pantai, the south shore
  if (x < -88 && z < -66) return DISTRICTS[2]; // Bukit, north-west heights
  if (x < 0 && z >= -66 && z <= 88) return DISTRICTS[1]; // Pasar, west centre
  return DISTRICTS[4];                          // Kota Tua fills the rest
}

export const PLAYER = {
  walkSpeed: 6.2,
  sprintSpeed: 10.5,
  radius: 0.55,
  maxHealth: 100,
  startPosition: { x: 150, z: 30 },  // on the harbour road, near job one
  startCash: 120,
};

export const WANTED = {
  maxStars: 5,
  // heat points needed to hold each star level (index = stars)
  thresholds: [0, 1, 14, 32, 58, 92],
  decayPerSecond: 1.1,        // heat bleeds off while no crime is witnessed
  crimeHeat: { shot: 7, jack: 12, hitPedestrian: 16, hitPolice: 20, jobCrime: 10 },
  policeCarsByStars: [0, 1, 2, 3, 4, 6],
  helicopterFromStars: 3,
  roadblockFromStars: 4,
  bustDistance: 2.4,          // a cop this close on foot starts the bust meter
  bustSeconds: 2.2,
};

export const ECONOMY = {
  taxiFareBase: 18,
  taxiFarePerMeter: 0.09,
  racePrize: 220,
  raceEntryFee: 40,
  hospitalFee: 60,
  bustFineFraction: 0.25,
};

export const DAY = {
  startHour: 16.8,        // late afternoon when the story opens
  hoursPerRealSecond: 0.011, // a full day lasts roughly 36 minutes
  nightFrom: 18.6,        // street lamps on after this hour
  nightUntil: 5.8,
};

export const WEATHER = {
  rainChancePerMinute: 0.16,
  showerMinutes: [0.7, 1.9],  // a shower lasts somewhere in this range
};

export const SAVE_KEY = 'teluk-kirana-heat-season-v3';
