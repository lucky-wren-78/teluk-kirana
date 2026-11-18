// Teluk Kirana — pistol combat. Shots are raycasts from the camera
// through the crosshair; a tracer line and a muzzle-flash light sell the
// hit, nearby pedestrians scatter, and every hit feeds the wanted system.
import * as THREE from 'three';

export class Combat {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.ammo = 60;
    this.cooldown = 0;
    this.lastShotAt = null;
    this.shotsFired = 0;
    this.hits = 0;
    this.flash = new THREE.PointLight(0xffc46a, 0, 15, 1.6);
    scene.add(this.flash);
    this.tracerMaterial = new THREE.LineBasicMaterial({ color: 0xffdf8a, transparent: true, opacity: 0.9 });
    this.tracer = null;
  }

  canShoot() {
    return this.cooldown <= 0 && this.ammo > 0;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.flash.intensity > 0) this.flash.intensity = Math.max(0, this.flash.intensity - dt * 300);
    if (this.tracer) {
      this.tracerMaterial.opacity -= dt * 4.5;
      if (this.tracerMaterial.opacity <= 0) {
        this.scene.remove(this.tracer);
        this.tracer.geometry.dispose();
        this.tracer = null;
      }
    }
    // The pistol reloads itself slowly once the magazine runs dry, so the
    // player is never soft-locked out of combat.
    if (this.ammo <= 0) {
      this.reloadTimer = (this.reloadTimer || 0) + dt;
      if (this.reloadTimer > 2.5) {
        this.ammo = 60;
        this.reloadTimer = 0;
      }
    }
  }

  shoot(origin, direction, targets, audio) {
    if (!this.canShoot()) return null;
    this.cooldown = 0.21;
    this.ammo -= 1;
    this.shotsFired += 1;
    this.lastShotAt = { x: origin.x, z: origin.z };
    this.raycaster.set(origin, direction);
    this.raycaster.far = 95;
    const hits = this.raycaster.intersectObjects(targets, true);
    const end = hits.length ? hits[0].point.clone() : origin.clone().add(direction.clone().multiplyScalar(85));
    if (this.tracer) {
      this.scene.remove(this.tracer);
      this.tracer.geometry.dispose();
    }
    this.tracer = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([origin.clone(), end]),
      this.tracerMaterial,
    );
    this.tracerMaterial.opacity = 0.9;
    this.scene.add(this.tracer);
    this.flash.position.copy(origin).add(direction.clone().multiplyScalar(1.4));
    this.flash.intensity = 110;
    if (audio) audio.playShot();
    if (hits.length) {
      this.hits += 1;
      return { hit: true, point: hits[0].point, object: hits[0].object };
    }
    return { hit: false, point: end, object: null };
  }

  shootFromCamera(targets, audio) {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    return this.shoot(this.camera.position.clone(), direction, targets, audio);
  }
}
