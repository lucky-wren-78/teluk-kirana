// Teluk Kirana — the story: eight jobs with dialogue, plus open-ended
// taxi fares and street races. A job is always the same shape — meet the
// contact, hear them out, drive to the glowing errand, get paid — and the
// finale turns the whole city's heat up at once.
import { JOB_REWARDS } from './config.js';

export const JOBS = [
  {
    id: 'pasar-pagi', title: 'Keranjang Ikan Bu Ratna', giver: 'Bu Ratna — penjual ikan Pasar Lama',
    brief: 'Antar dua keranjang ikan ke warung makan di Kota Tua sebelum dagangan pasar habis.',
    dialogue: [
      'Bu Ratna: "Ikan pagi ini bagus-bagus, Nak. Warung Pak Dedi sudah menunggu dari subuh."',
      'Bu Ratna: "Pakai motor biru di depan los itu. Jangan ngebut di gang pasar, ya."',
      'Kamu: "Tenang, Bu. Ikannya sampai masih segar, saya yang jamin."',
    ],
    target: { x: -90, z: -62, label: 'Warung Pak Dedi — Kota Tua' },
    reward: JOB_REWARDS[0], wantedOnComplete: 0,
  },
  {
    id: 'paket-diam', title: 'Paket Tanpa Nama', giver: 'Dimas — kurir dermaga',
    brief: 'Jemput paket tak bernama di gudang pelabuhan, antar ke dermaga marina tanpa membuka segelnya.',
    dialogue: [
      'Dimas: "Gudang tujuh, paket cokelat tanpa nama. Jangan dibuka, jangan ditimbang."',
      'Dimas: "Patroli pelabuhan lagi rajin. Lewat jalan marina saja, lebih sepi."',
      'Kamu: "Sudah biasa. Paket sampai, mulut saya terkunci."',
    ],
    target: { x: -138, z: 148, label: 'Dermaga Marina' },
    reward: JOB_REWARDS[1], wantedOnComplete: 1,
  },
  {
    id: 'utang-salon', title: 'Utang Salon Melati', giver: 'Sinta — pemilik Salon Melati',
    brief: 'Tagih utang dua juta dari pelanggan yang kabur ke Bukit Kirana. Ambil uangnya, atau motornya.',
    dialogue: [
      'Sinta: "Janji bayar tiga kali, kabur tiga kali. Rambut sudah bagus, utang belum lunas."',
      'Sinta: "Dia nongkrong di Bukit Kirana. Ambil uangnya — atau motornya sekalian."',
      'Kamu: "Hari ini dia lunas. Dengan satu cara atau cara lain."',
    ],
    target: { x: 94, z: -126, label: 'Bukit Kirana' },
    reward: JOB_REWARDS[2], wantedOnComplete: 1,
  },
  {
    id: 'razia-jembatan', title: 'Razia di Jembatan', giver: 'Raka — pembalap jalanan',
    brief: 'Razia gabungan menutup ujung jembatan. Bawa Raka menyeberang ke pelabuhan sebelum barikade rapat.',
    dialogue: [
      'Raka: "Bro, polisi nutup jembatan dari dua arah. Kita harus lewat sekarang!"',
      'Raka: "Kau yang pegang setir, aku yang baca jalan tikusnya. Deal?"',
      'Kamu: "Pegangan. Malam ini jembatan milik kita."',
    ],
    target: { x: 232, z: -32, label: 'Dermaga Timur — Pelabuhan' },
    reward: JOB_REWARDS[3], wantedOnComplete: 2,
  },
  {
    id: 'kontainer-412', title: 'Kontainer 412', giver: 'Kapten Agus — mandor pelabuhan',
    brief: 'Kontainer biru 412 hilang dari manifest malam tadi. Temukan di tumpukan timur, bawa ke gudang 12.',
    dialogue: [
      'Kapten Agus: "Di atas kertas, kontainer 412 tidak pernah ada. Lucu, ya?"',
      'Kapten Agus: "Cek tumpukan timur. Kalau ketemu, langsung geser ke gudang dua belas."',
      'Kamu: "Kontainer hantu. Biar saya yang bikin dia nyata lagi."',
    ],
    target: { x: 208, z: -72, label: 'Gudang 12 — Pelabuhan' },
    reward: JOB_REWARDS[4], wantedOnComplete: 1,
  },
  {
    id: 'balapan-raya', title: 'Raja Jalan Raya', giver: 'Raka — pembalap jalanan',
    brief: 'Balapan tiga checkpoint keliling kota melawan Raka: pasar, marina, finis di jembatan.',
    dialogue: [
      'Raka: "Kemarin kau menang karena aku ngantuk. Malam ini aku serius."',
      'Raka: "Pasar, marina, jembatan. Yang sampai terakhir traktir sate."',
      'Kamu: "Siapkan uang satenya dari sekarang, Raka."',
    ],
    target: { x: 250, z: 2, label: 'Finis — Jembatan Kirana' },
    reward: JOB_REWARDS[5], wantedOnComplete: 2,
  },
  {
    id: 'orang-dalam', title: 'Pengkhianat Pelabuhan', giver: 'Bu Ratna — penjual ikan Pasar Lama',
    brief: 'Tiga pengiriman kena razia berturut-turut. Ada orang dalam di kantor pelabuhan — cari buktinya.',
    dialogue: [
      'Bu Ratna: "Tiga kali kirim, tiga kali kena razia. Ini bukan nasib buruk, Nak."',
      'Bu Ratna: "Kantor pelabuhan menyimpan jadwal asli. Ambil, jangan sampai ketahuan."',
      'Kamu: "Kalau ada pengkhianat, malam ini dia berhenti bekerja."',
    ],
    target: { x: 178, z: 58, label: 'Kantor Pelabuhan' },
    reward: JOB_REWARDS[6], wantedOnComplete: 2,
  },
  {
    id: 'heat-season', title: 'Heat Season — Pengiriman Terakhir', giver: 'Seluruh Teluk Kirana',
    brief: 'Finale musim panas: satu muatan terakhir melintasi kota saat wanted level di titik tertinggi.',
    dialogue: [
      'Dimas: "Satu pengiriman lagi, terus kita semua berhenti. Selamanya."',
      'Sinta: "Polisi satu kota sudah di jalan. Kau yakin sanggup?"',
      'Kamu: "Teluk Kirana, musim panas, dan saya. Gas terakhir!"',
    ],
    target: { x: 2, z: -4, label: 'Alun-alun Pasar Lama' },
    reward: JOB_REWARDS[7], wantedOnComplete: 3,
  },
];

export class JobManager {
  constructor(onEvent) {
    this.onEvent = onEvent || (() => {});
    this.activeIndex = -1;
    this.stage = 'idle'; // idle | dialogue | go | done
    this.dialogueLine = 0;
    this.completed = new Set();
    this.taxi = null;
    this.race = null;
  }

  get activeJob() {
    return this.activeIndex >= 0 ? JOBS[this.activeIndex] : null;
  }

  get currentDialogue() {
    const job = this.activeJob;
    if (!job || this.stage !== 'dialogue') return null;
    return job.dialogue[this.dialogueLine] || null;
  }

  startJob(index) {
    if (index < 0 || index >= JOBS.length) return null;
    if (this.activeIndex >= 0 && this.stage !== 'done') return null;
    if (this.completed.has(JOBS[index].id)) return null;
    this.activeIndex = index;
    this.stage = 'dialogue';
    this.dialogueLine = 0;
    this.onEvent('job-start', JOBS[index]);
    return JOBS[index];
  }

  // True once the last line has been read and the errand is live.
  advanceDialogue() {
    const job = this.activeJob;
    if (!job || this.stage !== 'dialogue') return false;
    this.dialogueLine += 1;
    if (this.dialogueLine >= job.dialogue.length) {
      this.stage = 'go';
      this.onEvent('job-go', job);
      return true;
    }
    return false;
  }

  update(playerPos) {
    if (this.stage !== 'go' || !this.activeJob) return null;
    const t = this.activeJob.target;
    const dx = playerPos.x - t.x;
    const dz = playerPos.z - t.z;
    if (dx * dx + dz * dz < 13 * 13) {
      const job = this.activeJob;
      this.completed.add(job.id);
      this.stage = 'done';
      this.activeIndex = -1;
      this.onEvent('job-done', job);
      return job;
    }
    return null;
  }

  nextJobIndex() {
    for (let i = 0; i < JOBS.length; i++) {
      if (!this.completed.has(JOBS[i].id)) return i;
    }
    return -1;
  }

  startTaxi(pickup, dropoff, fare) {
    this.taxi = { pickup, dropoff, fare, stage: 'pickup' };
    this.onEvent('taxi-start', this.taxi);
    return this.taxi;
  }

  updateTaxi(playerPos) {
    if (!this.taxi) return null;
    const target = this.taxi.stage === 'pickup' ? this.taxi.pickup : this.taxi.dropoff;
    const dx = playerPos.x - target.x;
    const dz = playerPos.z - target.z;
    if (dx * dx + dz * dz >= 11 * 11) return null;
    if (this.taxi.stage === 'pickup') {
      this.taxi.stage = 'dropoff';
      this.onEvent('taxi-pickup', this.taxi);
      return 'picked-up';
    }
    const done = this.taxi;
    this.taxi = null;
    this.onEvent('taxi-done', done);
    return 'delivered';
  }

  startRace(checkpoints) {
    this.race = { checkpoints, index: 0, time: 0, finished: false };
    this.onEvent('race-start', this.race);
    return this.race;
  }

  updateRace(dt, playerPos) {
    if (!this.race || this.race.finished) return null;
    this.race.time += dt;
    const cp = this.race.checkpoints[this.race.index];
    if (!cp) return null;
    const dx = playerPos.x - cp.x;
    const dz = playerPos.z - cp.z;
    if (dx * dx + dz * dz >= 13 * 13) return null;
    this.race.index += 1;
    if (this.race.index >= this.race.checkpoints.length) {
      this.race.finished = true;
      this.onEvent('race-done', this.race);
      return 'finished';
    }
    this.onEvent('race-checkpoint', this.race);
    return 'checkpoint';
  }
}
