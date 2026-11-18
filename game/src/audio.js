// audio.js — a fully synthesized soundscape: three radio stations and
// spot effects, all WebAudio oscillators and noise. No audio files exist
// in this game; everything is generated in the browser at play time.

const STATIONS = [
  { name: 'GELOMBANG FM — harbour pop', root: 220, scale: [0, 3, 5, 7, 10], tempo: 0.42, wave: 'triangle' },
  { name: 'RADIO PASAR — dangdut synth', root: 196, scale: [0, 2, 4, 7, 9], tempo: 0.31, wave: 'square' },
  { name: 'KIRANA NIGHT — lo-fi keys', root: 174.6, scale: [0, 3, 7, 10, 12], tempo: 0.62, wave: 'sine' },
];

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.stationIndex = -1; // -1 = radio off
    this.noteTimer = null;
    this.step = 0;
    this.rainGain = null;
  }

  // Must be called from a user gesture (the Start button click).
  unlock() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // Rain bed: looped filtered noise whose gain the weather system drives.
    const noise = this.ctx.createBufferSource();
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    noise.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;
    noise.connect(filter).connect(this.rainGain).connect(this.master);
    noise.start();
  }

  get stationName() {
    return this.stationIndex < 0 ? null : STATIONS[this.stationIndex].name;
  }

  setStation(index) {
    this.stationIndex = index;
    if (this.noteTimer) { clearInterval(this.noteTimer); this.noteTimer = null; }
    if (index < 0 || !this.ctx) return;
    const station = STATIONS[index];
    this.step = 0;
    this.noteTimer = setInterval(() => this.playNote(station), station.tempo * 1000);
  }

  cycleStation() {
    this.setStation(this.stationIndex >= STATIONS.length - 1 ? -1 : this.stationIndex + 1);
    return this.stationName;
  }

  playNote(station) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const degree = station.scale[this.step % station.scale.length];
    const octave = this.step % (station.scale.length * 2) >= station.scale.length ? 2 : 1;
    const freq = station.root * Math.pow(2, degree / 12) * octave;
    const osc = this.ctx.createOscillator();
    osc.type = station.wave;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.11, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + station.tempo * 0.95);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + station.tempo);
    if (this.step % 4 === 0) { // soft bass pulse on the bar
      const bass = this.ctx.createOscillator();
      bass.type = 'sine';
      bass.frequency.value = station.root / 2;
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.14, t);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      bass.connect(bg).connect(this.master);
      bass.start(t);
      bass.stop(t + 0.45);
    }
    this.step += 1;
  }

  setRainLevel(level) {
    if (this.rainGain && this.ctx) {
      this.rainGain.gain.setTargetAtTime(level * 0.12, this.ctx.currentTime, 0.4);
    }
  }

  blip(freq, duration, type = 'square', volume = 0.16) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration);
  }

  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.12, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(gain).connect(this.master);
    src.start(t);
    this.blip(140, 0.09, 'sawtooth', 0.2);
  }

  cashRegister() { this.blip(880, 0.09, 'square', 0.12); setTimeout(() => this.blip(1320, 0.14, 'square', 0.12), 70); }
  sirenWail() { this.blip(660, 0.3, 'triangle', 0.07); }
  pickup() { this.blip(520, 0.1, 'triangle', 0.14); }
  crash() { this.blip(70, 0.25, 'sawtooth', 0.3); }
}
