// audio.js — every sound in Teluk Kirana is synthesised with WebAudio; there
// are no audio files. A three-station procedural radio (island groove, harbour
// jazz, night-drive synth), an engine hum that follows the car's speed, a police
// siren that swells as a unit closes in, and one-shot effects for the game's events.

export const RADIO_STATIONS = [
  'KIRANA FM · ISLAND GROOVE',
  'PELABUHAN JAZZ 88.1',
  'NIGHT DRIVE SYNTH',
  'RADIO OFF',
];

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 16-step loop patterns per station: bass line (midi notes, 0 = rest) + chords.
const PATTERNS = [
  { bpm: 104, bass: [45, 0, 45, 0, 48, 0, 45, 0, 43, 0, 43, 0, 50, 0, 48, 0], chord: [57, 60, 64], wave: 'triangle' },
  { bpm: 82, bass: [41, 0, 0, 48, 0, 0, 45, 0, 43, 0, 0, 50, 0, 48, 0, 0], chord: [53, 57, 60], wave: 'sine' },
  { bpm: 118, bass: [38, 38, 0, 38, 38, 0, 41, 0, 36, 36, 0, 36, 43, 0, 41, 0], chord: [50, 53, 57], wave: 'sawtooth' },
];

export function createAudioEngine() {
  let ctx = null;
  let master = null;
  let radioGain = null;
  let radioTimer = null;
  let step = 0;
  let station = 3; // off until the player turns it on
  let engineNodes = null;
  let sirenNodes = null;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    radioGain = ctx.createGain();
    radioGain.gain.value = 0.0;
    radioGain.connect(master);
  }

  function tone({ freq, type = 'sine', at = 0, dur = 0.15, gain = 0.2, dest = null, slide = 0 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(dest || master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ at = 0, dur = 0.1, gain = 0.2, freq = 1200, q = 0.8, dest = null }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(dest || master);
    src.start(t0);
  }

  function scheduleStep() {
    if (!ctx || station > 2) return;
    const pattern = PATTERNS[station];
    const s = step % 16;
    const note = pattern.bass[s];
    if (note) tone({ freq: midiToHz(note), type: pattern.wave, dur: 0.21, gain: 0.3, dest: radioGain });
    if (s % 8 === 0) {
      const bar = Math.floor(step / 16) % 2;
      for (const cn of pattern.chord) {
        tone({ freq: midiToHz(cn + bar), type: 'triangle', dur: 0.9, gain: 0.07, dest: radioGain });
      }
    }
    if (s % 2 === 0) noise({ dur: 0.03, gain: 0.05, freq: 6000, dest: radioGain });
    if (s % 4 === 2) noise({ dur: 0.06, gain: 0.1, freq: 1800, dest: radioGain });
    step++;
  }

  function setStation(next) {
    station = ((next % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    if (radioTimer) {
      clearInterval(radioTimer);
      radioTimer = null;
    }
    if (!ctx) return RADIO_STATIONS[station];
    if (station <= 2) {
      radioGain.gain.setTargetAtTime(0.5, ctx.currentTime, 0.2);
      const intervalMs = (60 / PATTERNS[station].bpm) * 250;
      step = 0;
      radioTimer = setInterval(scheduleStep, intervalMs);
    } else {
      radioGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.15);
    }
    return RADIO_STATIONS[station];
  }

  function setEngine(on, speedNorm) {
    if (!ctx) return;
    if (on && !engineNodes) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      const g = ctx.createGain();
      g.gain.value = 0.0;
      osc.connect(filter);
      filter.connect(g);
      g.connect(master);
      osc.start();
      engineNodes = { osc, g };
    }
    if (engineNodes) {
      const target = on ? 0.045 + speedNorm * 0.05 : 0;
      engineNodes.g.gain.setTargetAtTime(target, ctx.currentTime, 0.09);
      engineNodes.osc.frequency.setTargetAtTime(52 + speedNorm * 175, ctx.currentTime, 0.06);
    }
  }

  function setSiren(level) {
    if (!ctx) return;
    if (level > 0.02 && !sirenNodes) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(g);
      g.connect(master);
      osc.start();
      const lfo = setInterval(() => {
        if (!sirenNodes) {
          clearInterval(lfo);
          return;
        }
        const high = (sirenNodes.flip = !sirenNodes.flip);
        osc.frequency.setTargetAtTime(high ? 880 : 660, ctx.currentTime, 0.05);
      }, 360);
      sirenNodes = { osc, g, flip: false, lfo };
    }
    if (sirenNodes) {
      sirenNodes.g.gain.setTargetAtTime(level * 0.075, ctx.currentTime, 0.15);
      if (level <= 0.02) {
        const nodes = sirenNodes;
        sirenNodes = null;
        setTimeout(() => {
          try {
            nodes.osc.stop();
          } catch {
            // Already stopped.
          }
          clearInterval(nodes.lfo);
        }, 350);
      }
    }
  }

  const sfx = {
    blip() { tone({ freq: 880, type: 'square', dur: 0.07, gain: 0.12 }); },
    pickup() {
      tone({ freq: 660, type: 'square', dur: 0.08, gain: 0.14 });
      tone({ freq: 990, at: 0.07, type: 'square', dur: 0.12, gain: 0.14 });
    },
    cash() {
      tone({ freq: 1240, type: 'square', dur: 0.06, gain: 0.12 });
      tone({ freq: 1560, at: 0.05, type: 'square', dur: 0.1, gain: 0.12 });
    },
    punch() {
      noise({ dur: 0.09, gain: 0.3, freq: 500, q: 0.6 });
      tone({ freq: 120, dur: 0.09, gain: 0.25, slide: -60 });
    },
    shot() {
      noise({ dur: 0.13, gain: 0.4, freq: 2600, q: 0.4 });
      tone({ freq: 220, dur: 0.08, gain: 0.2, slide: -140 });
    },
    crash(intensity = 1) {
      noise({ dur: 0.22, gain: 0.32 * intensity, freq: 700, q: 0.5 });
      tone({ freq: 82, dur: 0.2, gain: 0.26 * intensity, slide: -30 });
    },
    door() {
      tone({ freq: 190, type: 'square', dur: 0.06, gain: 0.1 });
      tone({ freq: 130, at: 0.07, type: 'square', dur: 0.07, gain: 0.12 });
    },
    jobDone() { [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, at: i * 0.09, type: 'triangle', dur: 0.22, gain: 0.16 })); },
    busted() { [392, 370, 349, 311].forEach((f, i) => tone({ freq: f, at: i * 0.16, type: 'sawtooth', dur: 0.2, gain: 0.1 })); },
    checkpoint() {
      tone({ freq: 1046, type: 'square', dur: 0.07, gain: 0.12 });
      tone({ freq: 1318, at: 0.06, type: 'square', dur: 0.1, gain: 0.12 });
    },
  };

  return {
    unlock,
    setStation,
    getStation: () => station,
    stationName: () => RADIO_STATIONS[station],
    setEngine,
    setSiren,
    sfx,
    get ready() { return !!ctx; },
  };
}
