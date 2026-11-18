// Sound, all synthesized with WebAudio: engine hum, gunshots, two-tone
// sirens, rain noise, and three radio stations sequenced from oscillators.
// Nothing is fetched; the context is created on the first user gesture.
import { CONFIG } from './config.js';

export function createAudio() {
  const a = {
    ctx: null, master: null, engineOsc: null, engineGain: null,
    rainNode: null, rainGain: null, sirenOsc: null, sirenGain: null,
    sirenTimer: null, radioOn: true, station: 0, radioTimer: null,
    radioGain: null, muted: false, step: 0,
  };
  return a;
}

export function ensureAudio(a) {
  if (a.ctx) {
    if (a.ctx.state === 'suspended') a.ctx.resume().catch(() => {});
    return;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    a.ctx = new Ctx();
    a.master = a.ctx.createGain();
    a.master.gain.value = 0.5;
    a.master.connect(a.ctx.destination);
    // Engine: a low sawtooth whose pitch follows speed.
    a.engineOsc = a.ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 55;
    a.engineGain = a.ctx.createGain();
    a.engineGain.gain.value = 0;
    const engineFilter = a.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 500;
    a.engineOsc.connect(engineFilter);
    engineFilter.connect(a.engineGain);
    a.engineGain.connect(a.master);
    a.engineOsc.start();
    // Rain: looped filtered noise.
    const len = a.ctx.sampleRate * 2;
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    a.rainNode = a.ctx.createBufferSource();
    a.rainNode.buffer = buf; a.rainNode.loop = true;
    const rainFilter = a.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass'; rainFilter.frequency.value = 1200; rainFilter.Q.value = 0.4;
    a.rainGain = a.ctx.createGain(); a.rainGain.gain.value = 0;
    a.rainNode.connect(rainFilter);
    rainFilter.connect(a.rainGain);
    a.rainGain.connect(a.master);
    a.rainNode.start();
    // Siren: two alternating tones.
    a.sirenOsc = a.ctx.createOscillator();
    a.sirenOsc.type = 'sine';
    a.sirenOsc.frequency.value = 700;
    a.sirenGain = a.ctx.createGain(); a.sirenGain.gain.value = 0;
    a.sirenOsc.connect(a.sirenGain);
    a.sirenGain.connect(a.master);
    a.sirenOsc.start();
    // Radio: a quiet gain the sequencer plays through.
    a.radioGain = a.ctx.createGain();
    a.radioGain.gain.value = 0.14;
    a.radioGain.connect(a.master);
    startRadio(a);
  } catch {
    a.ctx = null;
  }
}

function radioNote(a, freq, dur, type) {
  if (!a.ctx) return;
  const o = a.ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.9, a.ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.ctx.currentTime + dur);
  o.connect(g); g.connect(a.radioGain);
  o.start(); o.stop(a.ctx.currentTime + dur);
}

function startRadio(a) {
  const stepMs = 60000 / 128 / 2;
  a.radioTimer = setInterval(() => {
    if (!a.ctx || a.muted || !a.radioOn) return;
    const st = CONFIG.radio[a.station];
    const beat = 60000 / st.bpm / 2;
    const scale = st.scale;
    const degree = scale[a.step % scale.length];
    const octave = Math.floor(a.step / scale.length) % 2;
    const freq = st.root * Math.pow(2, degree / 12 + octave);
    radioNote(a, freq, beat * 0.9, st.wave);
    if (a.step % 4 === 0) radioNote(a, st.root / 2, beat * 1.8, 'sine');
    a.step += 1;
  }, stepMs);
}

export function setEngine(a, speedKmh, inVehicle) {
  if (!a.ctx || !a.engineOsc) return;
  const target = inVehicle ? 0.05 + Math.min(0.16, speedKmh / 400) : 0;
  a.engineGain.gain.setTargetAtTime(target, a.ctx.currentTime, 0.1);
  a.engineOsc.frequency.setTargetAtTime(50 + speedKmh * 1.6, a.ctx.currentTime, 0.1);
}

export function setRain(a, on) {
  if (!a.ctx || !a.rainGain) return;
  a.rainGain.gain.setTargetAtTime(on ? 0.12 : 0, a.ctx.currentTime, 0.5);
}

export function setSiren(a, on) {
  if (!a.ctx || !a.sirenOsc) return;
  if (on && !a.sirenTimer) {
    let high = false;
    a.sirenTimer = setInterval(() => {
      if (!a.ctx) return;
      high = !high;
      a.sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, a.ctx.currentTime, 0.05);
    }, 450);
    a.sirenGain.gain.setTargetAtTime(0.05, a.ctx.currentTime, 0.2);
  } else if (!on && a.sirenTimer) {
    clearInterval(a.sirenTimer);
    a.sirenTimer = null;
    a.sirenGain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.2);
  }
}

export function playShot(a) {
  if (!a.ctx) return;
  const dur = 0.16;
  const buf = a.ctx.createBuffer(1, a.ctx.sampleRate * dur, a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const g = a.ctx.createGain(); g.gain.value = 0.7;
  src.connect(g); g.connect(a.master);
  src.start();
}

export function playBlip(a) {
  if (!a.ctx) return;
  radioNote(a, 660, 0.12, 'sine');
  setTimeout(() => radioNote(a, 880, 0.12, 'sine'), 90);
}

export function playHorn(a) {
  if (!a.ctx) return;
  radioNote(a, 370, 0.35, 'square');
  radioNote(a, 466, 0.35, 'square');
}

export function cycleRadio(a) {
  a.station = (a.station + 1) % CONFIG.radio.length;
  a.step = 0;
  return CONFIG.radio[a.station].name;
}

export function toggleMute(a) {
  a.muted = !a.muted;
  if (a.master) a.master.gain.value = a.muted ? 0 : 0.5;
  return a.muted;
}
