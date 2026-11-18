// Save / load through localStorage: cash, job progress, health, position
// and the best (highest) cash reached. Loading never throws.
import { CONFIG } from './config.js';

export function saveGame(world) {
  try {
    const data = {
      version: 4,
      cash: world.player.cash,
      health: world.player.health,
      ammo: world.player.ammo,
      jobIndex: world.jobs.index,
      completedJobs: world.jobs.completedCount,
      pos: [world.player.pos.x, world.player.pos.z],
      timeOfDay: world.timeOfDay,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(CONFIG.saveKey, JSON.stringify(data));
    const best = Number(window.localStorage.getItem(CONFIG.bestKey) || 0);
    if (world.player.cash > best) window.localStorage.setItem(CONFIG.bestKey, String(world.player.cash));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(CONFIG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 4) return null;
    return data;
  } catch {
    return null;
  }
}

export function readBest() {
  try {
    return Number(window.localStorage.getItem(CONFIG.bestKey) || 0);
  } catch {
    return 0;
  }
}

export function applySave(world, data) {
  world.player.cash = data.cash;
  world.player.health = data.health;
  world.player.ammo = data.ammo;
  world.jobs.index = data.jobIndex;
  world.jobs.completedCount = data.completedJobs;
  world.player.pos.set(data.pos[0], 0, data.pos[1]);
  world.timeOfDay = data.timeOfDay;
}
