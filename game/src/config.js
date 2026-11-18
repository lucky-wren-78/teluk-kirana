// config.js - shared tuning constants for Teluk Kirana: Heat Season.
// Everything the other modules need to agree on lives here: the city
// grid, the five districts, vehicle colours and police tuning.

// City layout: a square grid of blocks. Roads sit on the grid lines,
// blocks sit between them. Units are metres.
export const BLOCK = 46;          // size of one city block
export const ROAD = 12;           // road width
export const PITCH = BLOCK + ROAD; // distance between road centres
export const GRID = 7;            // roads per axis (GRID x GRID crossings)
export const CITY_HALF = (GRID - 1) * PITCH / 2; // road centres span this
export const WORLD_EDGE = CITY_HALF + PITCH;     // playable half size
export const SIDEWALK = 3.2;

// The harbour water lies to the south (positive z beyond the last road).
export const WATER_Z = CITY_HALF + PITCH * 0.9;
export const PIER_Z = CITY_HALF + PITCH * 0.55;

// Five districts. Each has a centre on the grid, a display name in two
// languages, a building palette and a ground accent colour.
export const DISTRICTS = [
  {
    id: 'harbor',
    name: 'Pelabuhan Lama',
    sub: 'Old Harbor',
    gx: 0, gz: 3,
    roof: 0x8a5a3c,
    wall: [0xd9b48c, 0xc9a06f, 0xb98d5f, 0xe3c49a],
    accent: 0x2e8b8b,
    minH: 8, maxH: 20,
  },
  {
    id: 'market',
    name: 'Pasar Raya',
    sub: 'Grand Market',
    gx: 3, gz: 3,
    roof: 0x7a4a52,
    wall: [0xe8c39a, 0xdda26e, 0xcf8f66, 0xf0d0a0],
    accent: 0xd96f32,
    minH: 10, maxH: 30,
  },
  {
    id: 'heights',
    name: 'Bukit Palma',
    sub: 'Palm Heights',
    gx: 5, gz: 0,
    roof: 0x5a5f6e,
    wall: [0xe8e2d4, 0xd8d2c2, 0xcfd6da, 0xf2ead8],
    accent: 0x7fae5a,
    minH: 14, maxH: 44,
  },
  {
    id: 'beach',
    name: 'Pantai Kirana',
    sub: 'Kirana Beach',
    gx: 0, gz: 0,
    roof: 0x9a6a44,
    wall: [0xf2ddba, 0xeccfa4, 0xe2bd8a, 0xf7e6c4],
    accent: 0x3aa6a0,
    minH: 6, maxH: 16,
  },
  {
    id: 'shipyard',
    name: 'Kawasan Galangan',
    sub: 'Shipyard Flats',
    gx: 5, gz: 5,
    roof: 0x4f5a63,
    wall: [0xb9c0c4, 0xa7b2b8, 0x9fb0a0, 0xc4cdd2],
    accent: 0xc7a23a,
    minH: 8, maxH: 24,
  },
];

// Convert a grid index (0..GRID-1) to a world coordinate on a road centre.
export function gridToWorld(i) {
  return -CITY_HALF + i * PITCH;
}

// Find the district whose centre is nearest to a world position.
export function districtAt(x, z) {
  let best = DISTRICTS[0];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const cx = gridToWorld(d.gx);
    const cz = gridToWorld(d.gz);
    const dist = (x - cx) * (x - cx) + (z - cz) * (z - cz);
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return best;
}

// Civilian car paint colours.
export const CAR_COLORS = [
  0xd94f30, 0xe8a13a, 0x3a7bd5, 0x53b06a, 0xe8e4da, 0x8a8f98,
  0x30343c, 0xb03a5e, 0x2ea8a0, 0xf2d13c, 0x7a4fd0, 0xd97fb0,
];

// Pedestrian shirt colours.
export const SHIRT_COLORS = [
  0xe4572e, 0xf2a03c, 0x2e86ab, 0x76b041, 0xf2e6c9, 0xc94f7c,
  0x4f6fd8, 0x38b2a6, 0xe8d44d, 0x9a6fd0,
];

// Wanted and police tuning.
export const WANTED = {
  decayPerSecond: 0.055,     // stars lost per second while unseen
  seenGrace: 2.5,            // seconds unseen before decay starts
  copSpeedBase: 26,          // m/s top speed of a police car at 1 star
  copSpeedPerStar: 2.2,
  copsPerStar: [0, 2, 3, 4, 6, 8],
  heliFromStar: 3,
  arrestSeconds: 2.6,        // surrounded on foot this long = busted
  arrestRadius: 9,
  finePerStar: 120,
};

// Player tuning.
export const PLAYER = {
  walkSpeed: 5.2,
  sprintSpeed: 8.6,
  radius: 0.55,
  maxHealth: 100,
  regenPerSecond: 3.2,
  regenDelay: 6,
};

// Driving tuning (arcade).
export const DRIVE = {
  accel: 16,
  brake: 26,
  reverse: 8,
  drag: 0.55,
  gripTurn: 1.9,       // steering rate scale
  maxSpeed: 34,
  maxReverse: 11,
};

// Points of interest used by jobs and the minimap.
export const POI = {
  hospital: { x: gridToWorld(1), z: gridToWorld(1), label: 'Hospital' },
  home: { x: gridToWorld(1) + 14, z: gridToWorld(2) + 10, label: 'Safehouse' },
  pier: { x: gridToWorld(3), z: PIER_Z, label: 'Pier' },
  garage: { x: gridToWorld(5), z: gridToWorld(5) + 12, label: 'Shipyard Garage' },
};

// Sky and light colours for the golden dusk look.
export const SKY = {
  top: 0x3a2a5e,
  mid: 0xc65a3a,
  low: 0xf2a950,
  fog: 0xe8906a,
  sun: 0xffd9a0,
};
