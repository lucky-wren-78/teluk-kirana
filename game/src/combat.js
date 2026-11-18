// combat.js - pistol shooting for Teluk Kirana.
// A hitscan pistol fired with the mouse or the F key: a ray from the
// player toward the aim direction, a muzzle flash, a tracer line,
// damage to pedestrians, police and cars, and return fire pressure
// through the wanted system.

import * as THREE from 'three';
import { distance2d } from './rng.js';
import { damageCar } from './vehicles.js';

export class Combat {
  constructor(scene, audio, police, peds) {
    this.scene = scene;
    this.audio = audio;
    this.police = police;
    this.peds = peds;
    this.cooldown = 0;
    this.flashTime = 0;
    // Muzzle flash: a small bright plane shown for a few frames.
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.55),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.95 }),
    );
    this.flash.visible = false;
    scene.add(this.flash);
    // Tracer: a thin stretched box from muzzle to hit point.
    this.tracer = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, 1),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.8 }),
    );
    this.tracer.visible = false;
    scene.add(this.tracer);
    this.raycaster = new THREE.Raycaster();
    this.shotsFired = 0;
  }

  // Try to fire. aimYaw is the camera yaw; the shot goes forward from
  // the player in that direction at chest height.
  fire(player, aimYaw, now, targetMeshes) {
    if (this.cooldown > 0 || player.dead) return false;
    this.cooldown = 0.24;
    this.shotsFired++;
    const p = player.pos;
    const origin = new THREE.Vector3(p.x, 1.45, p.z);
    const dir = new THREE.Vector3(Math.sin(aimYaw), -0.02, Math.cos(aimYaw)).normalize();
    this.audio.gunshot();

    // Muzzle flash at the gun position.
    this.flash.position.copy(origin).addScaledVector(dir, 0.7);
    this.flash.lookAt(origin.clone().addScaledVector(dir, 2));
    this.flash.visible = true;
    this.flashTime = 0.05;

    // Raycast against the world meshes the caller gathered.
    this.raycaster.set(origin, dir);
    this.raycaster.far = 90;
    const hits = this.raycaster.intersectObjects(targetMeshes, true);
    let end = origin.clone().addScaledVector(dir, 60);
    if (hits.length > 0) end = hits[0].point;

    // Tracer from muzzle to the hit point.
    const mid = origin.clone().add(end).multiplyScalar(0.5);
    this.tracer.position.copy(mid);
    this.tracer.lookAt(end);
    this.tracer.scale.set(1, 1, origin.distanceTo(end));
    this.tracer.visible = true;
    this.flashTime = Math.max(this.flashTime, 0.05);
    this.tracerTime = 0.045;

    // Apply damage by distance to known actors (robust and simple).
    this.applyDamage(p, dir, end);
    // A gunshot is a loud crime: heat rises and people panic.
    this.police.commitCrime(0.55);
    return true;
  }

  applyDamage(fromPos, dir, endPoint) {
    // Pedestrians near the line of fire.
    for (const ped of this.peds) {
      if (ped.dead) continue;
      if (distance2d(ped.x, ped.z, endPoint.x, endPoint.z) < 1.1) {
        ped.kill();
        this.police.commitCrime(1.2);
      }
    }
    // Police cars and civilian cars near the hit point.
    const allCars = this.extraCars || [];
    for (const car of allCars) {
      if (distance2d(car.x, car.z, endPoint.x, endPoint.z) < 2.4) {
        const destroyed = damageCar(car, 34);
        if (car.police) this.police.commitCrime(0.9);
        if (destroyed && car.police) this.police.commitCrime(0.8);
      }
    }
  }

  // Police shoot back when the player is on foot at high heat.
  policeReturnFire(dt, player, now) {
    if (!player.car && this.police.stars >= 2 && !player.dead) {
      this.returnTimer = (this.returnTimer || 0) + dt;
      if (this.returnTimer > 1.4) {
        this.returnTimer = 0;
        const p = player.pos;
        let nearest = Infinity;
        for (const car of this.police.cars) {
          nearest = Math.min(nearest, distance2d(car.x, car.z, p.x, p.z));
        }
        if (nearest < 30) {
          player.hurt(4 + this.police.stars * 1.5, now);
          this.audio.gunshot(0.4);
        }
      }
    }
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) {
        this.flash.visible = false;
        this.tracer.visible = false;
      }
    }
  }
}
