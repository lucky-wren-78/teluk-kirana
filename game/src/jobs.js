// Teluk Kirana — story: 8 jobs with dialogue, plus taxi fares and street races.
// Each job: talk to the contact, drive to the marker, do the deed, get paid.
import { JOB_REWARDS } from './config.js';

export const JOBS = [
  {
    id: 'j1', title: 'Pagi di Pasar Lama', giver: 'Bu Ratna — pedagang ikan',
    brief: 'Antar keranjang ikan segar Bu Ratna ke warung di Kota Tua sebelum pasar tutup.',
    dialogue: [
      'Bu Ratna: "Nak, ikan-ikan ini harus sampai di warung Pak Dedi sebelum jam sepuluh."',
      'Bu Ratna: "Motor di depan itu bisa kau pakai. Hati-hati di jalan, jangan sampai tumpah."',
      'Kamu: "Beress, Bu. Lima menit sampai."',
    ],
    target: { x: -88, z: -64, label: 'Warung Pak Dedi — Kota Tua' },
    reward: JOB_REWARDS[0], wantedOnComplete: 0,
  },
  {
    id: 'j2', title: 'Paket Tengah Malam', giver: 'Dimas — kurir pelabuhan',
    brief: 'Ambil paket dari gudang pelabuhan dan antar ke dermaga marina tanpa menarik perhatian.',
    dialogue: [
      'Dimas: "Paketnya di gudang 7. Jangan buka, jangan tanya isinya."',
      'Dimas: "Polisi patroli di jalan pelabuhan — lewat jalan belakang saja."',
      'Kamu: "Diam-diam saja. Aku yang urus."',
    ],
    target: { x: -140, z: 150, label: 'Dermaga Marina' },
    reward: JOB_REWARDS[1], wantedOnComplete: 1,
  },
  {
    id: 'j3', title: 'Utang si Bos Salon', giver: 'Sinta — pemilik salon Kirana',
    brief: 'Tagih utang Rp2 juta dari preman salon di Bukit Kirana. Boleh pakai cara keras.',
    dialogue: [
      'Sinta: "Dia janji bayar minggu lalu. Sekarang malah pamer motor baru."',
      'Sinta: "Ambil uangnya. Kalau dia melawan, kau tahu harus apa."',
      'Kamu: "Aku ambil uangnya, dan motornya sekalian kalau perlu."',
    ],
    target: { x: 96, z: -128, label: 'Salon Sinta — Bukit Kirana' },
    reward: JOB_REWARDS[2], wantedOnComplete: 1,
  },
  {
    id: 'j4', title: 'Kabur dari Razia', giver: 'Raka — pembalap liar',
    brief: 'Razia besar di jembatan. Bawa Raka menyeberang ke pelabuhan sebelum jalan ditutup.',
    dialogue: [
      'Raka: "Polisi sudah pasang roadblock di ujung jembatan, bro!"',
      'Raka: "Kau yang nyetir. Aku yang tunjukin jalan tikus lewat dermaga."',
      'Kamu: "Pegang yang kuat. Kita lewat bawah jembatan."',
    ],
    target: { x: 235, z: -30, label: 'Dermaga Timur — Pelabuhan' },
    reward: JOB_REWARDS[3], wantedOnComplete: 2,
  },
  {
    id: 'j5', title: 'Kontainer Hilang', giver: 'Kapten Agus — mandor pelabuhan',
    brief: 'Satu kontainer muatan "hilang" dari manifest. Temukan dan bawa ke gudang 12.',
    dialogue: [
      'Kapten Agus: "Kontainer biru nomor 412. Ada yang mindahin diam-diam semalam."',
      'Kapten Agus: "Cek di antara tumpukan timur. Jangan ribut-ribut."',
      'Kamu: "Kontainer biru 412. Ketemu, langsung kubawa."',
    ],
    target: { x: 210, z: -70, label: 'Gudang 12 — Pelabuhan' },
    reward: JOB_REWARDS[4], wantedOnComplete: 1,
  },
  {
    id: 'j6', title: 'Balapan Jalan Raya', giver: 'Raka — pembalap liar',
    brief: 'Balapan resmi tidak resmi: tiga checkpoint keliling kota, kalahkan mobil Raka.',
    dialogue: [
      'Raka: "Kau menang kemarin cuma beruntung. Sekarang buktikan lagi."',
      'Raka: "Tiga checkpoint: pasar, marina, lalu kembali ke jembatan."',
      'Kamu: "Siap-siap kalah lagi, Raka."',
    ],
    target: { x: 252, z: 0, label: 'Garis finis — Jembatan Kirana' },
    reward: JOB_REWARDS[5], wantedOnComplete: 2,
  },
  {
    id: 'j7', title: 'Orang Dalam', giver: 'Bu Ratna — pedagang ikan',
    brief: 'Seseorang membocorkan jadwal pengiriman ke polisi. Cari tahu siapa di kantor pelabuhan.',
    dialogue: [
      'Bu Ratna: "Tiga kali pengiriman kita kena razia. Pasti ada yang bocor dari dalam."',
      'Bu Ratna: "Kantor pelabuhan, lantai dua. Cari dokumen jadwalnya."',
      'Kamu: "Kalau ketemu pengkhianatnya, dia berurusan denganku."',
    ],
    target: { x: 180, z: 60, label: 'Kantor Pelabuhan' },
    reward: JOB_REWARDS[6], wantedOnComplete: 2,
  },
  {
    id: 'j8', title: 'Heat Season', giver: 'Semua orang di Teluk Kirana',
    brief: 'Finale: bawa muatan terakhir melintasi kota saat polisi di level tertinggi.',
    dialogue: [
      'Dimas: "Ini pengiriman terakhir musim ini. Setelah ini kita bersih."',
      'Sinta: "Seluruh kota bakal panas. Kau yakin bisa?"',
      'Kamu: "Teluk Kirana milik kita malam ini. Gas!"',
    ],
    target: { x: 0, z: 0, label: 'Alun-alun Pasar Lama' },
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

  startJob(index) {
    if (index < 0 || index >= JOBS.length) return null;
    if (this.completed.has(JOBS[index].id)) return null;
    this.activeIndex = index;
    this.stage = 'dialogue';
    this.dialogueLine = 0;
    this.onEvent('job-start', JOBS[index]);
    return JOBS[index];
  }

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

  get currentDialogue() {
    const job = this.activeJob;
    if (!job || this.stage !== 'dialogue') return null;
    return job.dialogue[this.dialogueLine] || null;
  }

  // Returns the finished job when the player reaches the marker, else null.
  update(playerPos) {
    if (this.stage !== 'go' || !this.activeJob) return null;
    const t = this.activeJob.target;
    const dx = playerPos.x - t.x;
    const dz = playerPos.z - t.z;
    if (dx * dx + dz * dz < 12 * 12) {
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
    if (dx * dx + dz * dz < 10 * 10) {
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
    return null;
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
    if (dx * dx + dz * dz < 12 * 12) {
      this.race.index += 1;
      if (this.race.index >= this.race.checkpoints.length) {
        this.race.finished = true;
        this.onEvent('race-done', this.race);
        return 'finished';
      }
      this.onEvent('race-checkpoint', this.race);
      return 'checkpoint';
    }
    return null;
  }
}
