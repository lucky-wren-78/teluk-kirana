// hud.js — everything drawn over the 3D view: wanted stars, cash and
// respect, the health bar, the clock, notifications, the dialogue box, and
// the circular real-time minimap with player, objective, police and
// activity blips.

import { CITY } from './config.js';

export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      wanted: document.getElementById('wanted'),
      clock: document.getElementById('clock'),
      weather: document.getElementById('weather'),
      cash: document.getElementById('cash'),
      respect: document.getElementById('respect'),
      healthfill: document.getElementById('healthfill'),
      joblabel: document.getElementById('joblabel'),
      minimap: document.getElementById('minimap'),
      speedo: document.getElementById('speedo'),
      radio: document.getElementById('radio'),
      notify: document.getElementById('notify'),
      dialogue: document.getElementById('dialogue'),
      dlgName: document.getElementById('dlg-name'),
      dlgText: document.getElementById('dlg-text'),
      prompt: document.getElementById('prompt'),
      crosshair: document.getElementById('crosshair'),
      damageflash: document.getElementById('damageflash'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.lastStars = -1;
    this.dialogueQueue = null;
    this.dialogueDone = null;
    this.bustShown = 0;
  }

  show() { this.el.hud.classList.remove('hidden'); }

  setStars(stars, bustProgress) {
    if (stars !== this.lastStars || Math.abs(bustProgress - this.bustShown) > 0.05) {
      this.lastStars = stars;
      this.bustShown = bustProgress;
      let html = '';
      for (let i = 1; i <= 5; i++) {
        html += `<span class="${i <= stars ? 'star-on' : 'star-off'}">★</span>`;
      }
      if (bustProgress > 0.02) html += `<span style="color:#ff5040;font-size:15px;letter-spacing:1px"> BUSTING ${Math.round(bustProgress * 100)}%</span>`;
      this.el.wanted.innerHTML = html;
    }
  }

  setStats(cash, respect, health, jobText) {
    this.el.cash.textContent = `$${Math.round(cash)}`;
    this.el.respect.textContent = `RESPECT ${Math.round(respect)}`;
    this.el.healthfill.style.width = `${Math.max(0, Math.min(100, health))}%`;
    this.el.joblabel.textContent = jobText || '';
  }

  setClock(hour, raining) {
    const hh = Math.floor(hour);
    const mm = Math.floor((hour - hh) * 60);
    this.el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    this.el.weather.textContent = raining ? '☂ RAIN' : '';
  }

  setSpeed(kmh, driving) {
    this.el.speedo.classList.toggle('hidden', !driving);
    if (driving) this.el.speedo.textContent = `${Math.round(Math.abs(kmh))} km/h`;
    this.el.crosshair.classList.toggle('hidden', driving);
  }

  setRadio(name) {
    this.el.radio.classList.toggle('hidden', !name);
    if (name) this.el.radio.textContent = `♪ ${name}`;
  }

  notify(text, ms = 3400) {
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = text;
    this.el.notify.appendChild(note);
    setTimeout(() => note.remove(), ms);
    while (this.el.notify.children.length > 3) this.el.notify.firstChild.remove();
  }

  setPrompt(text) {
    if (text) {
      this.el.prompt.textContent = text;
      this.el.prompt.classList.remove('hidden');
    } else {
      this.el.prompt.classList.add('hidden');
    }
  }

  flashDamage() {
    this.el.damageflash.style.opacity = '1';
    setTimeout(() => { this.el.damageflash.style.opacity = '0'; }, 90);
  }

  // Dialogue: queue of [speaker, line]; advance with nextDialogue().
  startDialogue(lines, onDone) {
    this.dialogueQueue = [...lines];
    this.dialogueDone = onDone || null;
    this.el.dialogue.classList.remove('hidden');
    this.showNextLine();
  }

  showNextLine() {
    const line = this.dialogueQueue && this.dialogueQueue.shift();
    if (!line) {
      this.el.dialogue.classList.add('hidden');
      const done = this.dialogueDone;
      this.dialogueDone = null;
      if (done) done();
      return;
    }
    this.el.dlgName.textContent = line[0];
    this.el.dlgText.textContent = line[1];
  }

  get dialogueOpen() { return this.dialogueQueue !== null && !this.el.dialogue.classList.contains('hidden'); }

  // Minimap: north-up, player-centred, roads as a grid, water on the east
  // and south edges, gold objective, blue/red police, white traffic dots.
  drawMinimap(playerPos, playerHeading, objective, blips) {
    const ctx = this.mapCtx;
    const S = 180;
    const scale = S / 190; // shows about 190 world metres across
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#274d2d';
    ctx.fillRect(0, 0, S, S);
    const toMap = (x, z) => [S / 2 + (x - playerPos.x) * scale, S / 2 + (z - playerPos.z) * scale];
    // water
    ctx.fillStyle = '#14607a';
    let [wx, wy] = toMap(CITY.halfSize + 10, -500);
    ctx.fillRect(wx, 0, S, S);
    let [, sy] = toMap(0, CITY.halfSize + 16);
    ctx.fillRect(0, sy, S, S);
    void wy;
    // roads
    ctx.strokeStyle = 'rgba(220,220,210,0.5)';
    ctx.lineWidth = 3;
    const lines = [-198, -154, -110, -66, -22, 22, 66, 110, 154, 198];
    for (const l of lines) {
      const [vx] = toMap(l, 0);
      ctx.beginPath(); ctx.moveTo(vx, 0); ctx.lineTo(vx, S); ctx.stroke();
      const [, hz] = toMap(0, l);
      ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(S, hz); ctx.stroke();
    }
    // blips
    for (const blip of blips) {
      const [bx, bz] = toMap(blip.x, blip.z);
      if (bx < -6 || bx > S + 6 || bz < -6 || bz > S + 6) continue;
      ctx.fillStyle = blip.kind === 'police' ? '#3f7dff' : blip.kind === 'heli' ? '#ff4040' : 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(bx, bz, blip.kind === 'traffic' ? 2 : 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // objective
    if (objective) {
      const [ox, oz] = toMap(objective.x, objective.z);
      const cx = Math.max(8, Math.min(S - 8, ox));
      const cz = Math.max(8, Math.min(S - 8, oz));
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(cx, cz, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    // player arrow
    ctx.translate(S / 2, S / 2);
    ctx.rotate(Math.PI / 2 + playerHeading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4.6, 5);
    ctx.lineTo(0, 2.4);
    ctx.lineTo(-4.6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
