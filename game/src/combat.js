// combat.js — the simple end of Teluk Kirana's crime: a punch that drops
// whoever stands in front of the player, and — once Bimo hands over the pistol
// in job 2 — a hitscan shot. Both are crimes: main.js reads the returned event
// and adds heat.

import { distance2d } from './random.js';
import { knockDownPedestrian } from './pedestrians.js';

function inFrontArc(player, x, z, range, arcCos) {
  const dx = x - player.x;
  const dz = z - player.z;
  const d = Math.hypot(dx, dz);
  if (d > range || d < 0.001) return false;
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  return (dx * fx + dz * fz) / d > arcCos;
}

// A swing of the fists. Returns 'ped' when someone went down, else null.
export function tryMeleeAttack(player, peds) {
  player.attackTimer = 0.32;
  for (const ped of peds) {
    if (ped.downTime <= 0 && inFrontArc(player, ped.x, ped.z, 2.7, 0.25)) {
      knockDownPedestrian(ped, 7);
      return 'ped';
    }
  }
  return null;
}

// A pistol shot down the player's facing. Returns what was hit:
// 'ped', 'car', or null (a shot fired into the air is still a crime).
export function tryPistolShot(player, peds, vehicles) {
  player.attackTimer = 0.22;
  let best = null;
  let bestDist = 34;
  let bestTarget = null;
  for (const ped of peds) {
    if (ped.downTime > 0) continue;
    const d = distance2d(player.x, player.z, ped.x, ped.z);
    if (d < bestDist && inFrontArc(player, ped.x, ped.z, 34, 0.965)) {
      best = 'ped';
      bestDist = d;
      bestTarget = ped;
    }
  }
  for (const car of vehicles) {
    const d = distance2d(player.x, player.z, car.x, car.z);
    if (d < bestDist && inFrontArc(player, car.x, car.z, 34, 0.9)) {
      best = 'car';
      bestDist = d;
      bestTarget = car;
    }
  }
  if (best === 'ped' && bestTarget) knockDownPedestrian(bestTarget, 9);
  if (best === 'car' && bestTarget) bestTarget.health -= 16;
  return best;
}
