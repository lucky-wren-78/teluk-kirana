// audio.js - all sound for Teluk Kirana, synthesized with WebAudio.
// Three radio stations play procedural loops while driving: a chill
// tropical groove, a synthwave arpeggio and a percussive dangdut-ish
// beat. Sound effects cover the engine, horn, gunshots, crashes,
// police sirens and a distant helicopter. Nothing is a file: every
// sound is oscillators and noise buffers, started only after the
// player presses Start (browser autoplay rules).

// Note tables for the three stations (frequencies in Hz).
const CHILL = [261.6, 329.6, 392.0, 523.3, 392.0, 329.6, 293.7, 349.2];
const WAVE = [110.0, 110.0, 164.8, 110.0, 130.8, 110.0, 196.0, 164.8];
const DANG_ROOT = 146.8;

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.station = 0; // 0 chill, 1 synthwave, 2 dangdut, 3 off
    this.stationNames = ['Kirana Chill FM', 'Neon Wave 88', 'Dangdut Pantai', 'Radio Off'];
    this.radioGain = null;
    this.sfxGain = null;
    this.step = 0;
    this.nextNoteAt = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.heliOsc = null;
    this.heliGain = null;
    this.radioOn = false;
  }

  // Create the context. Must be called from a user gesture.
  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.radioGain = this.ctx.createGain();
    this.radioGain.gain.value = 0.16;
    this.radioGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.ctx.destination);
    this.started = true;
    this.nextNoteAt = this.ctx.currentTime + 0.1;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // A short oscillator blip routed to a destination.
  blip(freq, dur, type, gain, dest, when = 0, slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Filtered noise burst for shots, crashes and percussion.
  noise(dur, gain, freq, dest, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t);
  }

  // Radio scheduler: call every frame while driving.
  updateRadio(driving) {
    if (!this.ctx) return;
    this.radioOn = driving && this.station !== 3;
    if (!this.radioOn) return;
    const stepDur = this.station === 1 ? 0.16 : 0.24;
    while (this.nextNoteAt < this.ctx.currentTime + 0.15) {
      const when = Math.max(0, this.nextNoteAt - this.ctx.currentTime);
      this.playStep(this.step, when, stepDur);
      this.step++;
      this.nextNoteAt += stepDur;
    }
  }

  playStep(step, when, stepDur) {
    if (this.station === 0) {
      // Chill: soft triangle melody over a slow bass.
      const note = CHILL[step % CHILL.length];
      this.blip(note, stepDur * 1.8, 'triangle', 0.5, this.radioGain, when);
      if (step % 4 === 0) this.blip(130.8, stepDur * 3, 'sine', 0.6, this.radioGain, when);
      if (step % 8 === 4) this.blip(98.0, stepDur * 3, 'sine', 0.5, this.radioGain, when);
    } else if (this.station === 1) {
      // Synthwave: sawtooth arpeggio with a pulsing bass.
      const note = WAVE[step % WAVE.length] * (step % 16 >= 8 ? 2 : 1);
      this.blip(note * 2, stepDur * 0.9, 'sawtooth', 0.16, this.radioGain, when);
      if (step % 2 === 0) this.blip(WAVE[step % WAVE.length], stepDur, 'square', 0.12, this.radioGain, when);
      if (step % 8 === 0) this.noise(0.1, 0.1, 6000, this.radioGain, when);
    } else if (this.station === 2) {
      // Dangdut-ish: kendang style percussion plus a flute-ish lead.
      if (step % 2 === 0) this.noise(0.07, 0.5, 900, this.radioGain, when);
      if (step % 4 === 2) this.noise(0.05, 0.3, 2400, this.radioGain, when);
      if (step % 8 === 6) this.blip(DANG_ROOT / 2, 0.12, 'sine', 0.7, this.radioGain, when, DANG_ROOT / 3);
      const lead = [0, 3, 5, 7, 5, 3, 2, 3][step % 8];
      if (step % 2 === 1) {
        this.blip(DANG_ROOT * Math.pow(2, lead / 12) * 2, stepDur * 1.4, 'sine', 0.3, this.radioGain, when);
      }
    }
  }

  cycleStation() {
    this.station = (this.station + 1) % this.stationNames.length;
    this.step = 0;
    if (this.ctx) this.nextNoteAt = this.ctx.currentTime + 0.05;
    return this.stationNames[this.station];
  }

  // Continuous engine hum whose pitch follows speed.
  updateEngine(driving, speedKmh) {
    if (!this.ctx) return;
    if (driving && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);
      this.engineOsc.start();
    }
    if (this.engineOsc) {
      const target = driving ? 0.05 + Math.min(0.05, Math.abs(speedKmh) / 900) : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(
        55 + Math.abs(speedKmh) * 1.6, this.ctx.currentTime, 0.06,
      );
    }
  }

  // Police siren: a two-tone oscillator that runs while wanted.
  updateSiren(active) {
    if (!this.ctx) return;
    if (active && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.035;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.sfxGain);
      this.sirenOsc.start();
    }
    if (this.sirenOsc) {
      if (active) {
        const tone = Math.floor(this.ctx.currentTime * 1.6) % 2 === 0 ? 660 : 880;
        this.sirenOsc.frequency.setTargetAtTime(tone, this.ctx.currentTime, 0.03);
      } else {
        this.sirenOsc.stop();
        this.sirenOsc.disconnect();
        this.sirenOsc = null;
      }
    }
  }

  // Distant helicopter thump while the heli is up.
  updateHeli(active) {
    if (!this.ctx) return;
    if (active && !this.heliOsc) {
      this.heliOsc = this.ctx.createOscillator();
      this.heliOsc.type = 'sine';
      this.heliGain = this.ctx.createGain();
      this.heliGain.gain.value = 0.0;
      this.heliOsc.frequency.value = 38;
      this.heliOsc.connect(this.heliGain);
      this.heliGain.connect(this.sfxGain);
      this.heliOsc.start();
    }
    if (this.heliGain) {
      const pulse = active ? 0.05 + 0.04 * Math.abs(Math.sin(this.ctx.currentTime * 9)) : 0;
      this.heliGain.gain.setTargetAtTime(pulse, this.ctx.currentTime, 0.05);
      if (!active && this.heliOsc && pulse === 0) {
        this.heliOsc.stop();
        this.heliOsc = null;
      }
    }
  }

  gunshot(volume = 1) {
    if (!this.ctx) return;
    this.noise(0.14, 0.5 * volume, 3200, this.sfxGain);
    this.blip(150, 0.1, 'square', 0.25 * volume, this.sfxGain, 0, 60);
  }

  horn() {
    if (!this.ctx) return;
    this.blip(370, 0.28, 'square', 0.12, this.sfxGain);
    this.blip(466, 0.28, 'square', 0.1, this.sfxGain);
  }

  crash(strength = 1) {
    if (!this.ctx) return;
    this.noise(0.3, 0.5 * Math.min(1, strength), 700, this.sfxGain);
    this.blip(70, 0.3, 'sine', 0.5, this.sfxGain, 0, 34);
  }

  cashRegister() {
    if (!this.ctx) return;
    this.blip(880, 0.09, 'square', 0.15, this.sfxGain);
    this.blip(1318, 0.16, 'square', 0.15, this.sfxGain, 0.09);
  }

  failTone() {
    if (!this.ctx) return;
    this.blip(220, 0.2, 'sawtooth', 0.15, this.sfxGain);
    this.blip(174, 0.34, 'sawtooth', 0.15, this.sfxGain, 0.18);
  }
}
