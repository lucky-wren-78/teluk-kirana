// Teluk Kirana — every tuning number, colour and story beat in one place.
// The city is a 640x640 unit tropical port, split into five districts. All
// randomness flows from a single seed so a screenshot seed replays exactly.
export const CONFIG = {
  seed: 20261118,
  worldSize: 640,
  blockSize: 64,
  roadWidth: 14,
  groundY: 0,

  // Five districts: name, centre (x, z), half-size, palette accent.
  districts: [
    { id: 'harbor', name: 'Pelabuhan', cx: 0, cz: 256, hx: 300, hz: 64, accent: '#e8a33d', buildingMax: 3 },
    { id: 'market', name: 'Pasar Ikan', cx: -176, cz: -32, hx: 96, hz: 96, accent: '#e4572e', buildingMax: 2 },
    { id: 'downtown', name: 'Pusat Kota', cx: 64, cz: -64, hx: 128, hz: 128, accent: '#4fc3f7', buildingMax: 9 },
    { id: 'residential', name: 'Perumahan', cx: 208, cz: 160, hx: 96, hz: 96, accent: '#7ec850', buildingMax: 3 },
    { id: 'outskirts', name: 'Pinggiran', cx: -208, cz: 176, hx: 96, hz: 96, accent: '#b08968', buildingMax: 2 },
  ],

  palette: {
    skyDay: 0x87bfe8, skyDusk: 0xff9a5c, skyNight: 0x0b1026, skyDawn: 0xffb37a,
    fogDay: 0x9fc6e8, fogNight: 0x0d1428,
    ground: 0x3d3a33, road: 0x2b2b2e, sidewalk: 0x6f6a5e,
    water: 0x14586e, sand: 0xc2a878,
    building: ['#c9b8a3', '#b7c4cc', '#d8c9a3', '#a3b8a3', '#c9a3a3', '#8fa3b8', '#e0d5c1'],
    lampGlow: 0xffd27a,
  },

  // Day length in real seconds for a full 24 h cycle.
  dayLengthSec: 480,
  // Rain: a shower starts on average every ~100 s and lasts ~35 s.
  rainEverySec: 100,
  rainLastSec: 35,

  player: {
    walkSpeed: 9, runSpeed: 15, turnSpeed: 9,
    radius: 0.9, health: 100, startCash: 250, startAmmo: 12, maxAmmo: 12,
    startPos: { x: 8, z: 96 },
  },

  car: {
    accel: 26, brake: 42, reverseAccel: 14, maxSpeed: 46, maxReverse: 12,
    steer: 1.9, grip: 6.5, drag: 0.6, radius: 2.2,
  },
  bike: {
    accel: 30, brake: 46, reverseAccel: 14, maxSpeed: 52, maxReverse: 12,
    steer: 2.4, lean: 0.55, drag: 0.6, radius: 1.1,
  },
  traffic: { count: 12, speed: 13, minGap: 9 },

  pedestrian: { count: 26, speed: 2.4, fleeSpeed: 5.5 },

  police: {
    patrolCount: 3, chaseSpeed: 40, ramDistance: 3.2,
    heliHeight: 46, heliSpeed: 26, spotlightRange: 90,
    roadblockAtStars: 4, spikeSlow: 0.35,
    heatPerCrime: { stealCar: 22, shoot: 12, kill: 30, hitPed: 18 },
    heatDecayPerSec: 1.6, heatDecayDelaySec: 12,
  },

  combat: { range: 90, damage: 34, fireInterval: 0.28, headshotBonus: 0 },

  radio: [
    { id: 'kirana-fm', name: 'KIRANA FM — Dangdut Koplo', bpm: 128, root: 55, scale: [0, 2, 3, 7, 8, 10], wave: 'sawtooth' },
    { id: 'ombak', name: 'OMBAK 92.1 — Surf Rock', bpm: 148, root: 82.4, scale: [0, 2, 5, 7, 10], wave: 'square' },
    { id: 'senja', name: 'SENJA — Lo-fi Tropis', bpm: 76, root: 110, scale: [0, 3, 5, 7, 10], wave: 'sine' },
  ],

  // Eight story jobs. `steps` are { text, at: [x, z], radius }.
  jobs: [
    {
      id: 'job-1', title: 'Pesan dari Pak Darma', giver: 'Pak Darma',
      brief: 'Pak Darma menitip paket di dermaga. Ambil, antar ke Pasar Ikan. Jangan dibuka.',
      reward: 120,
      dialog: ['Darma: "Kamu anak baru itu? Paketnya di ujung dermaga."', 'Darma: "Antar ke kios Bu Lastri. Cepat, sebelum hujan."'],
      steps: [
        { text: 'Ambil paket di ujung dermaga', at: [24, 288], radius: 6 },
        { text: 'Antar paket ke kios Bu Lastri di Pasar Ikan', at: [-176, -32], radius: 8 },
      ],
    },
    {
      id: 'job-2', title: 'Utang si Bono', giver: 'Pak Darma',
      brief: 'Bono ngutang tiga bulan. Tagih di Pusat Kota, bawa uangnya kembali.',
      reward: 180,
      dialog: ['Darma: "Bono pikir aku lupa. Tagih. Kalau melawan, kamu tahu harus apa."'],
      steps: [
        { text: 'Temui Bono di Pusat Kota', at: [96, -96], radius: 8 },
        { text: 'Bawa uang tagihan kembali ke Pak Darma', at: [-16, 224], radius: 8 },
      ],
    },
    {
      id: 'job-3', title: 'Balapan Pelabuhan', giver: 'Raka',
      brief: 'Raka menantang balapan keliling pelabuhan. Menang, namamu dikenal.',
      reward: 260,
      dialog: ['Raka: "Mobilmu lambat, brow. Buktikan di aspal pelabuhan."'],
      steps: [
        { text: 'Ke garis start di pelabuhan', at: [-64, 272], radius: 8 },
        { text: 'Lewati checkpoint gudang timur', at: [192, 256], radius: 10 },
        { text: 'Finis di dermaga barat', at: [-224, 288], radius: 10 },
      ],
    },
    {
      id: 'job-4', title: 'Taksi Kilat', giver: 'Bu Lastri',
      brief: 'Tiga penumpang menunggu di pasar. Antar mereka secepatnya.',
      reward: 150,
      dialog: ['Lastri: "Penumpangku sudah menunggu. Jangan bikin mereka telat!"'],
      steps: [
        { text: 'Jemput penumpang di Pasar Ikan', at: [-176, -32], radius: 8 },
        { text: 'Antar ke Perumahan', at: [208, 160], radius: 10 },
        { text: 'Antar penumpang terakhir ke Pusat Kota', at: [64, -64], radius: 10 },
      ],
    },
    {
      id: 'job-5', title: 'Kargo Tengah Malam', giver: 'Pak Darma',
      brief: 'Kargo datang tengah malam. Ambil di dermaga, antar ke gudang. Polisi sedang patroli.',
      reward: 340,
      dialog: ['Darma: "Malam ini polisi siaga. Ambil kargonya, jangan sampai ketangkap."'],
      steps: [
        { text: 'Ambil kargo di dermaga (tengah malam)', at: [-96, 288], radius: 6 },
        { text: 'Antar kargo ke gudang Pinggiran', at: [-208, 176], radius: 10 },
      ],
    },
    {
      id: 'job-6', title: 'Motor si Raka', giver: 'Raka',
      brief: 'Motor Raka dicuri geng Pinggiran. Rebut kembali dan bawa pulang.',
      reward: 220,
      dialog: ['Raka: "Motorku di Pinggiran. Ambil balik. Pakai motornya sekalian."'],
      steps: [
        { text: 'Temukan motor Raka di Pinggiran', at: [-224, 192], radius: 8 },
        { text: 'Bawa motor ke bengkel Pusat Kota', at: [32, -128], radius: 8 },
      ],
    },
    {
      id: 'job-7', title: 'Pesta di Dermaga', giver: 'Bu Lastri',
      brief: 'Seorang VIP datang dengan kapal. Antar dia ke hotel Pusat Kota, sopan santun.',
      reward: 280,
      dialog: ['Lastri: "VIP itu penting. Jangan ngebut, jangan nabrak. Senyum."'],
      steps: [
        { text: 'Jemput VIP di dermaga', at: [96, 288], radius: 6 },
        { text: 'Antar VIP ke hotel Pusat Kota', at: [128, -32], radius: 8 },
      ],
    },
    {
      id: 'job-8', title: 'Heat Season', giver: 'Pak Darma',
      brief: 'Pengiriman terakhir musim ini. Seluruh kota panas. Lewati tiga titik, jangan tertangkap.',
      reward: 600,
      dialog: ['Darma: "Ini yang terakhir. Seluruh kota mengawasimu. Selesai ini, kamu legenda."'],
      steps: [
        { text: 'Ambil muatan di gudang pelabuhan', at: [-160, 272], radius: 8 },
        { text: 'Lewati titik temu di Pasar Ikan', at: [-176, -32], radius: 10 },
        { text: 'Serahkan muatan di Perumahan', at: [224, 176], radius: 10 },
      ],
    },
  ],

  // Screenshot scenes: name, time of day, weather, wanted level, staging.
  shots: {
    nightchase: { timeOfDay: 22.2, weather: 'rain', wanted: 4, vehicle: 'car', at: [-40, 256], heading: 1.5708, cam: 'chase' },
    market: { timeOfDay: 8.1, weather: 'clear', wanted: 0, vehicle: 'foot', at: [-176, -8], heading: 3.1416, cam: 'market' },
    rainharbor: { timeOfDay: 16.4, weather: 'rain', wanted: 1, vehicle: 'bike', at: [120, 256], heading: -1.5708, cam: 'side' },
    dawn: { timeOfDay: 6.05, weather: 'clear', wanted: 0, vehicle: 'foot', at: [64, 0], heading: 0, cam: 'street' },
  },

  saveKey: 'teluk-kirana-v4.save',
  bestKey: 'teluk-kirana-v4.best',
};

export const KEYS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  run: 'ShiftLeft', interact: 'KeyE', reload: 'KeyR', radio: 'KeyQ',
  horn: 'KeyH', handbrake: 'Space', pause: 'KeyP', mute: 'KeyM',
};
