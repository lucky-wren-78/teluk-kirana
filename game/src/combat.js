// Teluk Kirana — pistol combat: raycast shots from the camera, muzzle flash,
// tracer, hit feedback on pedestrians and police cars, and the wanted cost.
import * as THREE from 'three';

export class Combat {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.ammo = 48;
    this.cooldown = 0;
    this.lastShotAt = null;
    this.flash = new THREE.PointLight(0xffc46a, 0, 14, 1.5);
    scene.add(this.flash);
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });
    this.tracer = null;
    this.shotsFired = 0;
    this.hits = 0;
  }

  canShoot() {
    return this.cooldown <= 0 && this.ammo > 0;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 260);
    if (this.tracer) {
      this.tracerMat.opacity -= dt * 5;
      if (this.tracerMat.opacity <= 0) {
        this.scene.remove(this.tracer);
        this.tracer.geometry.dispose();
        this.tracer = null;
      }
    }
  }

  // Fire from the camera through the screen centre. Returns a hit report.
  shoot(origin, direction, targets, audio) {
    if (!this.canShoot()) return null;
    this.cooldown = 0.22;
    this.ammo -= 1;
    this.shotsFired += 1;
    this.lastShotAt = { x: origin.x, z: origin.z };
    this.raycaster.set(origin, direction);
    this.raycaster.far = 90;
    const hits = this.raycaster.intersectObjects(targets, true);
    const end = hits.length > 0 ? hits[0].point : origin.clone().add(direction.clone().multiplyScalar(80));
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    if (this.tracer) this.scene.remove(this.tracer);
    this.tracer = new THREE.Line(geo, this.tracerMat);
    this.tracerMat.opacity = 0.9;
    this.scene.add(this.tracer);
    this.flash.position.copy(origin).add(direction.clone().multiplyScalar(1.2));
    this.flash.intensity = 90;
    if (audio) audio.playShot();
    if (hits.length > 0) {
      this.hits += 1;
      return { hit: true, point: hits[0].point, object: hits[0].object };
    }
    return { hit: false, point: end, object: null };
  }

  // Ray from the centre of the screen — used by the click-to-shoot input.
  shootFromCamera(targets, audio) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const origin = this.camera.position.clone();
    return this.shoot(origin, dir, targets, audio);
  }
}
