// combat.js — Kira's pistol: hitscan shots with a tracer flash, muzzle
// light, damage to vehicles and pedestrians, and the heat a gunshot draws.

import * as THREE from 'three';
import { WANTED } from './config.js';
import { distance2d } from './rng.js';

export class Combat {
  constructor(scene, hooks) {
    this.scene = scene;
    this.hooks = hooks; // { onShotFired(x,z), onCrime(kind,x,z), onVehicleHit(v), onPedestrianDown(x,z) }
    this.cooldown = 0;
    this.ammo = Infinity; // a harbour courier's pistol never runs dry in this cut
    this.tracers = [];
    this.muzzle = new THREE.PointLight(0xffc37a, 0, 16);
    scene.add(this.muzzle);
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  }

  // Fire from the player toward their aim heading. Targets: vehicles and
  // pedestrians within range and a narrow cone; otherwise the shot flies
  // to max range and kicks up nothing but noise (and heat).
  tryShoot(dt, shooter) {
    this.cooldown -= dt;
    for (const tracer of [...this.tracers]) {
      tracer.life -= dt;
      tracer.mesh.material.opacity = Math.max(0, tracer.life * 3);
      if (tracer.life <= 0) {
        this.scene.remove(tracer.mesh);
        this.tracers.splice(this.tracers.indexOf(tracer), 1);
      }
    }
    this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 260);
  }

  fire(shooter, targets) {
    if (this.cooldown > 0) return false;
    this.cooldown = 0.24;
    const origin = new THREE.Vector3(shooter.pos.x, 1.35, shooter.pos.z);
    const dirX = Math.cos(shooter.heading);
    const dirZ = Math.sin(shooter.heading);
    this.muzzle.position.copy(origin);
    this.muzzle.intensity = 60;
    this.hooks.onShotFired(shooter.pos.x, shooter.pos.z);
    this.hooks.onCrime('shot', shooter.pos.x, shooter.pos.z);

    let bestDist = 46;
    let bestHit = null;
    for (const target of targets) {
      const dx = target.pos.x - shooter.pos.x;
      const dz = target.pos.z - shooter.pos.z;
      const along = dx * dirX + dz * dirZ;
      if (along < 1 || along > bestDist) continue;
      const side = -dx * dirZ + dz * dirX;
      const cone = target.kind === 'pedestrian' ? 0.8 : 1.7;
      if (Math.abs(side) < cone) { bestDist = along; bestHit = target; }
    }

    const end = new THREE.Vector3(
      shooter.pos.x + dirX * bestDist,
      1.1,
      shooter.pos.z + dirZ * bestDist
    );
    const length = origin.distanceTo(end);
    const tracerMesh = new THREE.Mesh(new THREE.BoxGeometry(length, 0.045, 0.045), this.tracerMat.clone());
    tracerMesh.position.copy(origin).lerp(end, 0.5);
    tracerMesh.rotation.y = -shooter.heading;
    this.scene.add(tracerMesh);
    this.tracers.push({ mesh: tracerMesh, life: 0.3 });

    if (bestHit) {
      if (bestHit.kind === 'pedestrian') this.hooks.onPedestrianDown(bestHit);
      else this.hooks.onVehicleHit(bestHit.vehicle, bestHit.isPolice);
    }
    return true;
  }
}

// How much damage a single pistol round does to a vehicle.
export const SHOT_VEHICLE_DAMAGE = 9;

// Crime heat table shortcut used by the game orchestrator.
export function heatForCrime(kind) {
  return WANTED.crimeHeat[kind] || 4;
}

export { distance2d };
