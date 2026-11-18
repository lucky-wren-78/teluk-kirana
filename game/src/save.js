// save.js - localStorage save game for Teluk Kirana.
// Stores cash, respect, finished story jobs, the player's last
// position and a clean wanted state. Autosaves on a timer, on job
// completion and on page hide. A reset button lives on the start
// screen.

const SAVE_KEY = 'teluk-kirana-save-v1';

export const DEFAULT_SAVE = {
  cash: 250,
  respect: 0,
  jobsDone: [],
  sideDone: 0,
  x: 0,
  z: 0,
  station: 0,
};

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed = JSON.parse(raw);
    return {
      cash: Number.isFinite(parsed.cash) ? parsed.cash : DEFAULT_SAVE.cash,
      respect: Number.isFinite(parsed.respect) ? parsed.respect : 0,
      jobsDone: Array.isArray(parsed.jobsDone) ? parsed.jobsDone : [],
      sideDone: Number.isFinite(parsed.sideDone) ? parsed.sideDone : 0,
      x: Number.isFinite(parsed.x) ? parsed.x : 0,
      z: Number.isFinite(parsed.z) ? parsed.z : 0,
      station: Number.isFinite(parsed.station) ? parsed.station : 0,
    };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.round(state.cash),
      respect: Math.round(state.respect),
      jobsDone: state.jobsDone,
      sideDone: state.sideDone || 0,
      x: Math.round(state.x * 10) / 10,
      z: Math.round(state.z * 10) / 10,
      station: state.station || 0,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage may be unavailable; nothing else to do.
  }
}

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}
