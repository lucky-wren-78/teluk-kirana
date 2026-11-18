// save.js — the season save in localStorage: money, respect, per-district
// reputation, story progress and the pistol unlock. Nothing else persists;
// the city itself is rebuilt from its seed on every load.

import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return {
    money: 120,
    respect: 0,
    jobIndex: 0,
    seasonDone: false,
    hasPistol: false,
    districtRep: { harbour: 0, oldtown: 0, downtown: 0, palm: 0 },
    racesWon: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.money !== 'number' || typeof parsed.jobIndex !== 'number') return null;
    const base = defaultSave();
    return {
      ...base,
      ...parsed,
      districtRep: { ...base.districtRep, ...(parsed.districtRep || {}) },
    };
  } catch {
    return null;
  }
}

export function storeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Private mode or a full store: the season simply will not persist.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
