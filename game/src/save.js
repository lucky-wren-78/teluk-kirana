// Teluk Kirana — save games in localStorage. The payload is plain,
// versioned JSON; every access is wrapped so a full, blocked or corrupt
// store degrades to "no save found" instead of an exception.
import { CONFIG } from './config.js';

const SAVE_VERSION = 6;

export function saveGame(snapshot) {
  try {
    const payload = { version: SAVE_VERSION, savedAt: new Date().toISOString(), ...snapshot };
    localStorage.setItem(CONFIG.saveKey, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(CONFIG.saveKey);
  } catch {
    // Nothing to clear when storage itself is unavailable.
  }
}
