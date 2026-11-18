// save.js — localStorage persistence: cash, respect, story progress,
// and where Kira was standing, so a reload continues the season.

import { SAVE_KEY, PLAYER } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null; // private mode or a corrupt blob: start fresh, never crash
  }
}

export function storeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.round(state.cash),
      respect: Math.round(state.respect),
      storyIndex: state.jobs.storyIndex,
      completedStory: state.jobs.completedStory,
      position: { x: Math.round(state.position.x * 10) / 10, z: Math.round(state.position.z * 10) / 10 },
      hour: state.hour,
    }));
  } catch { /* storage full or blocked: the game simply will not persist */ }
}

export function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to wipe */ }
}

export function freshState() {
  return {
    cash: PLAYER.startCash,
    respect: 0,
    position: { ...PLAYER.startPosition },
    hour: null,
  };
}
