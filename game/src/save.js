// Teluk Kirana — localStorage save / load. Plain JSON, versioned key, never throws:
// a corrupt or unavailable store just means "no save", never a crashed game.
import { CONFIG } from './config.js';

export function saveGame(snapshot) {
  try {
    const payload = { version: 5, savedAt: new Date().toISOString(), ...snapshot };
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
    if (!data || data.version !== 5) return null;
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
    // storage unavailable — nothing to clear
  }
}
