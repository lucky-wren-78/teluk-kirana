// Teluk Kirana — WebAudio synth radio (3 stations) and sound effects.
// Everything is synthesized: no audio files, no network. All entry points are
// guarded so a headless browser or a denied AudioContext can never break the game.
import { RADIO_STATIONS } from './config.js';

const SCALES = {
  'kirana-fm': [0, 3, 5, 7, 10],
  'ombak': [0, 2, 4, 7, 9],
  'jalan-raya': [0, 3, 5, 6, 10],
};

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.stationIndex = 0;
    this.radioOn = true;
    this.musicGain = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
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
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  setStation(index) {
    this.stationIndex = ((index % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    this.step = 0;
    return RADIO_STATIONS[this.stationIndex];
  }

  cycleStation() {
    return this.setStation(this.stationIndex + 1);
  }

  toggleRadio() {
    this.radioOn = !this.radioOn;
    return this.radioOn;
  }

  // Called once per fixed step while the game runs; schedules the next synth notes.
  update() {
    if (!this.ctx || !this.radioOn || this.ctx.state !== 'running') return;
    const station = RADIO_STATIONS[this.stationIndex];
    const beat = 60 / station.bpm / 2;
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      if (this.nextNoteTime < this.ctx.currentTime) this.nextNoteTime = this.ctx.currentTime + 0.02;
      this.scheduleNote(station, this.step, this.nextNoteTime);
      this.step += 1;
      this.nextNoteTime += beat;
    }
  }

  scheduleNote(station, step, when) {
    const scale = SCALES[station.id];
    const degree = scale[step % scale.length];
    const octave = Math.floor(step / scale.length) % 2;
    const freq = station.root * Math.pow(2, degree / 12 + octave);
    const type = station.id === 'jalan-raya' ? 'sawtooth' : station.id === 'ombak' ? 'triangle' : 'square';
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(0.5, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.28);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(when);
      osc.stop(when + 0.32);
      if (step % 4 === 0) {
        const bass = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        bass.type = 'sine';
        bass.frequency.value = station.root / 2;
        bg.gain.setValueAtTime(0.0001, when);
        bg.gain.linearRampToValueAtTime(0.7, when + 0.03);
        bg.gain.exponentialRampToValueAtTime(0.001, when + 0.4);
        bass.connect(bg);
        bg.connect(this.musicGain);
        bass.start(when);
        bass.stop(when + 0.45);
      }
    } catch {
      // synth hiccup — ignore, music is decorative
    }
  }

  blip(freq, duration, type = 'sine', volume = 0.4) {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    } catch {
      // ignore
    }
  }

  playShot() {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.12), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.7;
      src.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch {
      // ignore
    }
  }

  playPickup() {
    this.blip(660, 0.12, 'sine', 0.35);
    setTimeout(() => this.blip(990, 0.18, 'sine', 0.35), 90);
  }

  playJobDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.4), i * 110));
  }

  playCrash() {
    if (!this.ensure()) return;
    try {
      const t = this.ctx.currentTime;
      const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.25), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.8;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.8;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch {
      // ignore
    }
  }

  setEngine(running, speedNorm) {
    if (!this.ctx) return;
    try {
      if (running && !this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.03;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      if (this.engineOsc) {
        this.engineOsc.frequency.value = 55 + speedNorm * 140;
        this.engineGain.gain.value = running ? 0.03 + speedNorm * 0.05 : 0;
      }
    } catch {
      // ignore
    }
  }

  setSiren(on) {
    if (!this.ctx) return;
    try {
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.045;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      }
      if (this.sirenOsc) {
        this.sirenOsc.frequency.value = on ? 700 + 250 * Math.sin(performance.now() / 280) : 0;
        this.sirenGain.gain.value = on ? 0.045 : 0;
      }
    } catch {
      // ignore
    }
  }
}
