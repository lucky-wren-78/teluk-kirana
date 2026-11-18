// Teluk Kirana — HUD: cash, wanted stars, speed, health, clock, job objective,
// dialogue box, message toasts, and the realtime minimap (2D canvas).
import { RADIO_STATIONS } from './config.js';

export class Hud {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.minimap = this.el('minimap');
    this.mapCtx = this.minimap ? this.minimap.getContext('2d') : null;
    this.toastTimer = null;
    this.dialogueVisible = false;
  }

  setCash(amount) {
    const el = this.el('hud-cash');
    if (el) el.textContent = `$${Math.floor(amount).toLocaleString('en-US')}`;
  }

  setWanted(level) {
    const el = this.el('hud-wanted');
    if (!el) return;
    el.textContent = '★'.repeat(level) + '☆'.repeat(5 - level);
    el.classList.toggle('hot', level >= 3);
  }

  setSpeed(kmh, inVehicle) {
    const el = this.el('hud-speed');
    if (el) el.textContent = inVehicle ? `${Math.round(Math.abs(kmh))} km/h` : 'JALAN KAKI';
  }

  setHealth(hp) {
    const el = this.el('hud-health');
    if (el) {
      el.style.width = `${Math.max(0, Math.min(100, hp))}%`;
      el.classList.toggle('low', hp < 30);
    }
  }

  setAmmo(ammo) {
    const el = this.el('hud-ammo');
    if (el) el.textContent = `▸ ${ammo}`;
  }

  setClock(hour, minute, raining) {
    const el = this.el('hud-clock');
    if (!el) return;
    const h = String(Math.floor(hour)).padStart(2, '0');
    const m = String(Math.floor(minute)).padStart(2, '0');
    el.textContent = `${h}:${m}${raining ? ' ☂ hujan' : ''}`;
  }

  setStation(index, on) {
    const el = this.el('hud-radio');
    if (el) el.textContent = on ? `♪ ${RADIO_STATIONS[index].name}` : '♪ radio mati';
  }

  setObjective(text) {
    const el = this.el('hud-objective');
    if (el) el.textContent = text;
  }

  setJobList(jobs, completed, activeIndex) {
    const el = this.el('hud-jobs');
    if (!el) return;
    el.innerHTML = jobs.map((j, i) => {
      const done = completed.has(j.id) ? ' ✓' : '';
      const active = i === activeIndex ? ' ▶ ' : '';
      return `<div class="${i === activeIndex ? 'active' : ''}">${active}${i + 1}. ${j.title}${done}</div>`;
    }).join('');
  }

  showDialogue(text, hint) {
    const box = this.el('dialogue');
    const body = this.el('dialogue-text');
    if (!box || !body) return;
    body.textContent = text;
    const h = this.el('dialogue-hint');
    if (h) h.textContent = hint || 'Tekan E untuk lanjut';
    box.classList.add('visible');
    this.dialogueVisible = true;
  }

  hideDialogue() {
    const box = this.el('dialogue');
    if (box) box.classList.remove('visible');
    this.dialogueVisible = false;
  }

  toast(message, ms = 3200) {
    const el = this.el('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
  }

  setInteract(text) {
    const el = this.el('interact');
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.classList.add('visible');
    } else {
      el.classList.remove('visible');
    }
  }

  // Realtime minimap: roads, buildings, water, job marker, police, player arrow.
  drawMinimap(world) {
    if (!this.mapCtx) return;
    const ctx = this.mapCtx;
    const S = 168;
    const scale = S / 460;
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    ctx.fillStyle = '#10181f';
    ctx.fillRect(0, 0, S, S);
    // water
    ctx.fillStyle = '#146b8a';
    ctx.fillRect(S / 2 + 220 * scale, 0, S, S);
    // roads
    ctx.strokeStyle = '#3d444b';
    ctx.lineWidth = 2;
    for (let c = -220; c <= 220; c += 44) {
      const [x1] = toMap(c, 0);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
      const [, z1] = toMap(0, c);
      ctx.beginPath(); ctx.moveTo(0, z1); ctx.lineTo(S, z1); ctx.stroke();
    }
    // buildings
    ctx.fillStyle = '#5a6b7a';
    for (const b of world.city.buildings) {
      const [bx, bz] = toMap(b.aabb.minX, b.aabb.minZ);
      const w = (b.aabb.maxX - b.aabb.minX) * scale;
      const h = (b.aabb.maxZ - b.aabb.minZ) * scale;
      ctx.fillRect(bx, bz, Math.max(1, w), Math.max(1, h));
    }
    // job / taxi / race marker
    const marker = world.jobMarker;
    if (marker) {
      const [mx, mz] = toMap(marker.x, marker.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(mx, mz, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.stroke();
    }
    // police
    ctx.fillStyle = '#3f8cff';
    for (const car of world.police.cars) {
      const [px, pz] = toMap(car.x, car.z);
      ctx.fillRect(px - 2, pz - 2, 4, 4);
    }
    if (world.police.heli && world.police.heli.group.visible) {
      const [hx, hz] = toMap(world.police.heli.group.position.x, world.police.heli.group.position.z);
      ctx.fillStyle = '#ff5522';
      ctx.beginPath(); ctx.arc(hx, hz, 4, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow
    const [px, pz] = toMap(world.player.x, world.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-world.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
