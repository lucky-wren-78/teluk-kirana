// Combat: a pistol with raycast hits, muzzle flash, ammo and reload.
// Shooting in public raises the heat; killing a pedestrian raises it more.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { fleeFrom } from './pedestrians.js';

export function createCombat(scene, camera) {
  const flash = new THREE.PointLight(0xffc860, 0, 18, 1.5);
  scene.add(flash);
  return {
    scene, camera, flash,
    flashTimer: 0, lastShotAt: -999,
  };
}

export function tryShoot(world) {
  const { player, combat, police } = world;
  if (player.inVehicle || player.dead) return;
  if (world.time - combat.lastShotAt < CONFIG.combat.fireInterval) return;
  if (player.ammo <= 0) {
    world.hud.toast('Peluru habis — tekan R untuk isi ulang.');
    world.audio.blip();
    return;
  }
  combat.lastShotAt = world.time;
  player.ammo -= 1;
  world.audio.shot();
  combat.flashTimer = 0.07;
  const origin = world.camera.position.clone();
  const dir = new THREE.Vector3();
  world.camera.getWorldDirection(dir);
  combat.flash.position.copy(origin).addScaledVector(dir, 2);
  const ray = new THREE.Raycaster(origin, dir, 0.1, CONFIG.combat.range);

  const targets = [];
  for (const w of world.pedestrians.list) {
    if (w.alive) targets.push({ mesh: w.mesh, ref: w, kind: 'ped' });
  }
  for (const car of world.vehicles.list) {
    if (car.alive && car.driver === 'police') targets.push({ mesh: car.mesh, ref: car, kind: 'police' });
  }
  const hits = ray.intersectObjects(targets.map((t) => t.mesh), true);
  if (hits.length > 0) {
    let obj = hits[0].object;
    while (obj.parent && !targets.some((t) => t.mesh === obj)) obj = obj.parent;
    const t = targets.find((x) => x.mesh === obj);
    if (t) {
      if (t.kind === 'ped') {
        t.ref.alive = false;
        t.ref.mesh.visible = false;
        police.addHeat(world, CONFIG.police.heatPerCrime.kill);
        world.hud.toast('Kamu menembak pejalan kaki!');
      } else {
        t.ref.speed = Math.max(0, t.ref.speed - 12);
        police.addHeat(world, CONFIG.police.heatPerCrime.shoot);
      }
    }
  } else {
    police.addHeat(world, CONFIG.police.heatPerCrime.shoot * 0.4);
  }
  fleeFrom(world, player.pos.x, player.pos.z, 40);
}

export function reload(world) {
  const { player } = world;
  if (player.ammo === CONFIG.player.maxAmmo) return;
  player.ammo = CONFIG.player.maxAmmo;
  world.hud.toast('Peluru diisi ulang.');
  world.audio.blip();
}

export function updateCombat(world, dt) {
  const { combat } = world;
  if (combat.flashTimer > 0) {
    combat.flashTimer -= dt;
    combat.flash.intensity = 60;
    if (combat.flashTimer <= 0) combat.flash.intensity = 0;
  }
}
