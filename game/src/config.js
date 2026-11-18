// config.js — the single source of truth for Teluk Kirana's constants: the
// island grid, the four districts, the golden-hour palette and the tuning of
// every system. Pure data and pure helpers; no DOM, no three.js in here.

export const GAME_TITLE = 'TELUK KIRANA';
export const GAME_SUBTITLE = 'Heat Season';
export const SAVE_KEY = 'teluk-kirana-heat-season-v1';

// The island is a square of land around the origin. Streets run on a grid:
// a street centre line every pitch, asphalt roadWidth wide, the rest of each
// cell a buildable block with sidewalks, palms and buildings.
export const CITY = {
  pitch: 60, // metres between neighbouring street centre lines
  roadWidth: 16, // asphalt width inside a pitch cell
  blockSize: 44, // buildable square inside each pitch cell
  gridLines: 9, // streets per axis, indices -4..4
  halfExtent: 240, // coordinate of the outermost street centre line
  landHalf: 318, // half-size of the island's sand/grass square
  waterLevel: -0.55, // sea surface height
  sidewalkTop: 0.32, // raised pavement height of each block
};

// Districts by quadrant: the harbour fills the east, the old town the west,
// palm-roofed houses the north, downtown towers the centre-south.
export const DISTRICTS = {
  harbour: { id: 'harbour', name: 'Pelabuhan Kirana', short: 'HBR' },
  oldtown: { id: 'oldtown', name: 'Kota Tua', short: 'OLD' },
  downtown: { id: 'downtown', name: 'Pusat Kota', short: 'DWN' },
  palm: { id: 'palm', name: 'Bukit Palem', short: 'PLM' },
};

export function districtAt(x, z) {
  if (x > 95) return DISTRICTS.harbour;
  if (x < -95) return DISTRICTS.oldtown;
  if (z < -95) return DISTRICTS.palm;
  return DISTRICTS.downtown;
}

// Golden-hour art direction: warm sun, peach haze, teal sea.
export const PALETTE = {
  sky: 0xffd9a0,
  fog: 0xf7bd83,
  sun: 0xffb066,
  sunIntensity: 2.6,
  hemiSky: 0xffe3b3,
  hemiGround: 0x7a5c3e,
  hemiIntensity: 0.85,
  sea: 0x12808f,
  sand: 0xeacf9d,
  grass: 0x77a24e,
  asphalt: 0x3c4148,
  sidewalk: 0xb9ac97,
  lanePaint: 0xf5e9c9,
};

export const TUNING = {
  playerWalkSpeed: 7.2,
  playerSprintSpeed: 11.5,
  playerRadius: 0.55,
  playerHealth: 100,
  carRadius: 2.35,
  trafficCount: 15,
  trafficSpeed: 11.5,
  pedestrianCount: 42,
  policeMaxCars: 6,
  heatDecayPerSecond: 1.35,
  heatCalmDelay: 5.0,
  bustedRadius: 4.2,
  bustedSeconds: 2.4,
};

// Wanted stars follow heat: five thresholds, five stars.
export const HEAT_STARS = [1, 22, 45, 72, 105, 145];

export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 1; i < HEAT_STARS.length; i++) {
    if (heat >= HEAT_STARS[i]) stars = i;
  }
  return stars;
}
