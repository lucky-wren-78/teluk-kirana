// Teluk Kirana — all sound is synthesized with WebAudio: three radio
// stations, engine and siren loops, and one-shot effects. There are no
// audio files and nothing is fetched. Every public method is defensive:
// if the browser refuses an AudioContext, the game simply plays silent.
import { RADIO_STATIONS } from './config.js';

// Pentatonic-ish scales per station, as semitone offsets from the root.
const STATION_SCALES = {
  'kirana-fm': [0, 2, 4, 7, 9],
  'ombak': [0, 3, 5, 7, 10],
  'jalan-raya': [0, 3, 5, 6, 11],
};
const STATION_WAVES = { 'kirana-fm': 'square', 'ombak': 'triangle', 'jalan-raya': 'sawtooth' };

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.stationIndex = 0;
    this.radioOn = true;
    this.muted = false;
    this.volume = 0.55;
    this.nextNoteAt = 0;
    this.stepCount = 0;
    this.engine = null;
    this.siren = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.15;
      this.musicBus.connect(this.master);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
    return this.volume;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  setStation(index) {
    const n = RADIO_STATIONS.length;
    this.stationIndex = ((index % n) + n) % n;
    this.stepCount = 0;
    return RADIO_STATIONS[this.stationIndex];
  }

  cycleStation() {
    return this.setStation(this.stationIndex + 1);
  }

  toggleRadio() {
    this.radioOn = !this.radioOn;
    return this.radioOn;
  }

  // Driven from the fixed-step loop; keeps a small lookahead of notes queued.
  update() {
    if (!this.ctx || !this.radioOn || this.ctx.state !== 'running') return;
    const station = RADIO_STATIONS[this.stationIndex];
    const eighth = 60 / station.bpm / 2;
    while (this.nextNoteAt < this.ctx.currentTime + 0.22) {
      if (this.nextNoteAt < this.ctx.currentTime) this.nextNoteAt = this.ctx.currentTime + 0.03;
      this.scheduleStep(station, this.stepCount, this.nextNoteAt);
      this.stepCount += 1;
      this.nextNoteAt += eighth;
    }
  }

  scheduleStep(station, step, when) {
    const scale = STATION_SCALES[station.id] || STATION_SCALES['kirana-fm'];
    const degree = scale[step % scale.length];
    const octave = Math.floor(step / scale.length) % 2;
    const freq = station.root * Math.pow(2, (degree + octave * 12) / 12);
    try {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = STATION_WAVES[station.id] || 'square';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0.0001, when);
      env.gain.linearRampToValueAtTime(0.42, when + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, when + 0.26);
      osc.connect(env);
      env.connect(this.musicBus);
      osc.start(when);
      osc.stop(when + 0.3);
      if (step % 8 === 0) this.scheduleTone(station.root / 2, when, 0.42, 'sine', 0.65, this.musicBus);
      if (step % 8 === 4) this.scheduleTone(station.root * 0.75, when, 0.3, 'sine', 0.4, this.musicBus);
    } catch { /* a dropped note never breaks the game */ }
  }

  scheduleTone(freq, when, duration, type, peak, bus) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(peak, when + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(env);
    env.connect(bus || this.master);
    osc.start(when);
    osc.stop(when + duration + 0.03);
  }

  blip(freq, duration = 0.15, type = 'sine', volume = 0.35) {
    if (!this.ensure()) return;
    try {
      this.scheduleTone(freq, this.ctx.currentTime, duration, type, volume, this.master);
    } catch { /* ignore */ }
  }

  noiseBurst(duration, volume, cutoff) {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch { /* ignore */ }
  }

  playShot() { this.noiseBurst(0.13, 0.65, 5200); }
  playCrash() { this.noiseBurst(0.28, 0.8, 850); }

  playPickup() {
    this.blip(587, 0.12, 'sine', 0.32);
    setTimeout(() => this.blip(880, 0.2, 'sine', 0.32), 85);
  }

  playJobDone() {
    [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.blip(f, 0.24, 'triangle', 0.38), i * 105));
  }

  setEngine(running, speedNorm) {
    if (!this.ctx) return;
    try {
      if (running && !this.engine) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.0;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        osc.start();
        this.engine = { osc, gain };
      }
      if (this.engine) {
        this.engine.osc.frequency.value = 52 + speedNorm * 150;
        this.engine.gain.gain.value = running ? 0.028 + speedNorm * 0.05 : 0;
      }
    } catch { /* ignore */ }
  }

  setSiren(on) {
    if (!this.ctx) return;
    try {
      if (on && !this.siren) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
        this.siren = { osc, gain };
      }
      if (this.siren) {
        this.siren.osc.frequency.value = on ? 690 + 260 * Math.sin(performance.now() / 260) : 0;
        this.siren.gain.gain.value = on ? 0.04 : 0;
      }
    } catch { /* ignore */ }
  }
}
