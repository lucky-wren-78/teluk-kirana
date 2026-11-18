// Teluk Kirana — HUD: cash, wanted stars, health, ammo, clock, radio,
// district banner, the job tracker and objective line, dialogue boxes,
// toasts, the interact prompt — and the realtime minimap, drawn on a 2D
// canvas from the live world state every frame.
import { RADIO_STATIONS } from './config.js';

export class Hud {
  constructor() {
    this.cache = new Map();
    this.minimap = this.el('minimap');
    this.mapCtx = this.minimap ? this.minimap.getContext('2d') : null;
    this.toastTimer = null;
    this.dialogueVisible = false;
    this.districtName = '';
  }

  el(id) {
    if (!this.cache.has(id)) this.cache.set(id, document.getElementById(id));
    return this.cache.get(id);
  }

  setCash(amount) {
    const el = this.el('hud-cash');
    if (el) el.textContent = `$${Math.floor(amount).toLocaleString('en-US')}`;
  }

  setWanted(level) {
    const el = this.el('hud-wanted');
    if (!el) return;
    el.textContent = '★'.repeat(level) + '☆'.repeat(Math.max(0, 5 - level));
    el.classList.toggle('hot', level >= 3);
  }

  setSpeed(kmh, inVehicle) {
    const el = this.el('hud-speed');
    if (el) el.textContent = inVehicle ? `${Math.round(Math.abs(kmh))} km/h` : 'JALAN KAKI';
  }

  setHealth(hp) {
    const bar = this.el('hud-health');
    if (!bar) return;
    const pct = Math.max(0, Math.min(100, hp));
    bar.style.width = `${pct}%`;
    bar.classList.toggle('low', pct < 30);
  }

  setAmmo(ammo) {
    const el = this.el('hud-ammo');
    if (el) el.textContent = `▸ ${ammo}`;
  }

  setClock(hour, minute, raining) {
    const el = this.el('hud-clock');
    if (!el) return;
    const hh = String(Math.floor(hour) % 24).padStart(2, '0');
    const mm = String(Math.floor(minute) % 60).padStart(2, '0');
    el.textContent = `${hh}:${mm}${raining ? ' · hujan' : ''}`;
  }

  setDistrict(name) {
    if (name === this.districtName) return;
    this.districtName = name;
    const el = this.el('hud-district');
    if (el) el.textContent = name.toUpperCase();
  }

  setStation(index, on, muted) {
    const el = this.el('hud-radio');
    if (!el) return;
    if (muted) el.textContent = '♪ radio — bisu (M)';
    else el.textContent = on ? `♪ ${RADIO_STATIONS[index].name}` : '♪ radio mati (R)';
  }

  setObjective(text) {
    const el = this.el('hud-objective');
    if (el) el.textContent = text;
  }

  setJobList(jobs, completed, activeIndex) {
    const el = this.el('hud-jobs');
    if (!el) return;
    el.innerHTML = jobs.map((job, i) => {
      const mark = completed.has(job.id) ? ' ✓' : i === activeIndex ? ' ▶' : '';
      const cls = i === activeIndex ? ' class="active"' : '';
      return `<div${cls}>${i + 1}. ${job.title}${mark}</div>`;
    }).join('');
  }

  showDialogue(text, hint) {
    const box = this.el('dialogue');
    const body = this.el('dialogue-text');
    if (!box || !body) return;
    body.textContent = text;
    const hintEl = this.el('dialogue-hint');
    if (hintEl) hintEl.textContent = hint || 'Tekan E untuk lanjut';
    box.classList.add('visible');
    this.dialogueVisible = true;
  }

  hideDialogue() {
    const box = this.el('dialogue');
    if (box) box.classList.remove('visible');
    this.dialogueVisible = false;
  }

  toast(message, ms = 3400) {
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

  // Minimap: sea, basin, roads, bridge, buildings, the job marker, police
  // blips, the helicopter, and the player arrow in the middle of it all.
  drawMinimap(world) {
    if (!this.mapCtx) return;
    const ctx = this.mapCtx;
    const S = 176;
    const scale = S / 470;
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    ctx.fillStyle = '#131a21';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#14607f';
    const [seaX] = toMap(218, 0);
    ctx.fillRect(seaX, 0, S - seaX, S);
    const [basinX, basinZ] = toMap(-193, 120);
    ctx.fillRect(basinX, basinZ, 150 * scale, 96 * scale);
    ctx.strokeStyle = '#454e57';
    ctx.lineWidth = 2;
    for (let c = -220; c <= 220; c += 44) {
      const [lx] = toMap(c, 0);
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, S); ctx.stroke();
      const [, lz] = toMap(0, c);
      ctx.beginPath(); ctx.moveTo(0, lz); ctx.lineTo(S, lz); ctx.stroke();
    }
    // the bridge, drawn as a pale span over the channel
    ctx.strokeStyle = '#c9c2ae';
    ctx.lineWidth = 3;
    const [b1x, b1z] = toMap(196, 0);
    const [b2x] = toMap(312, 0);
    ctx.beginPath(); ctx.moveTo(b1x, b1z); ctx.lineTo(b2x, b1z); ctx.stroke();
    ctx.fillStyle = '#5d6d7d';
    for (const b of world.city.buildings) {
      const [bx, bz] = toMap(b.aabb.minX, b.aabb.minZ);
      ctx.fillRect(bx, bz, Math.max(1, (b.aabb.maxX - b.aabb.minX) * scale), Math.max(1, (b.aabb.maxZ - b.aabb.minZ) * scale));
    }
    // traffic dots
    ctx.fillStyle = '#9fb3c8';
    for (const v of world.traffic) {
      const [vx, vz] = toMap(v.x, v.z);
      ctx.fillRect(vx - 1, vz - 1, 2, 2);
    }
    const marker = world.jobMarker;
    if (marker) {
      const [mx, mz] = toMap(marker.x, marker.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(mx, mz, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#14100a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = '#3f8cff';
    for (const car of world.police.cars) {
      const [px, pz] = toMap(car.x, car.z);
      ctx.fillRect(px - 2, pz - 2, 4, 4);
    }
    if (world.police.heli && world.police.heli.group.visible) {
      const hp = world.police.heli.group.position;
      const [hx, hz] = toMap(hp.x, hp.z);
      ctx.fillStyle = '#ff5522';
      ctx.beginPath(); ctx.arc(hx, hz, 4, 0, Math.PI * 2); ctx.fill();
    }
    const [px, pz] = toMap(world.player.x, world.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-world.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
