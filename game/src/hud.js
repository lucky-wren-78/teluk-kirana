// hud.js - the heads-up display for Teluk Kirana.
// Updates the DOM bars and labels (health, wanted stars, cash,
// respect, speed, radio, objective) and draws the live 2D minimap:
// roads, the player arrow, cars, police, pedestrians hints and the
// objective marker, with north fixed at the top.

import { GRID, PITCH, CITY_HALF, gridToWorld, districtAt } from './config.js';
import { clamp } from './rng.js';

export class Hud {
  constructor() {
    this.el = {};
    const ids = [
      'healthFill', 'wantedStars', 'cashLabel', 'respectLabel', 'speedLabel',
      'radioLabel', 'objectiveLabel', 'districtLabel', 'jobBanner', 'bannerTitle',
      'bannerSub', 'dialogBox', 'dialogName', 'dialogText', 'toast',
      'timerLabel', 'arrestFill', 'promptLabel',
    ];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map ? this.map.getContext('2d') : null;
    this.bannerUntil = 0;
    this.toastUntil = 0;
    this.dialogLines = [];
    this.dialogIdx = 0;
    this.dialogDone = null;
    this.time = 0;
  }

  showBanner(title, sub, seconds = 3.4) {
    if (!this.el.jobBanner) return;
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub || '';
    this.el.jobBanner.classList.add('show');
    this.bannerUntil = this.time + seconds;
  }

  showToast(text, seconds = 2.6) {
    if (!this.el.toast) return;
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this.toastUntil = this.time + seconds;
  }

  // Dialog box: shows lines one at a time; advance with E or click.
  showDialog(lines, onDone) {
    this.dialogLines = lines || [];
    this.dialogIdx = 0;
    this.dialogDone = onDone || null;
    this.renderDialog();
  }

  renderDialog() {
    if (!this.el.dialogBox) return;
    if (this.dialogIdx >= this.dialogLines.length) {
      this.el.dialogBox.classList.remove('show');
      const done = this.dialogDone;
      this.dialogDone = null;
      if (done) done();
      return;
    }
    const [name, text] = this.dialogLines[this.dialogIdx];
    this.el.dialogName.textContent = name;
    this.el.dialogText.textContent = text;
    this.el.dialogBox.classList.add('show');
  }

  advanceDialog() {
    if (this.dialogLines.length === 0) return false;
    if (this.dialogIdx < this.dialogLines.length) {
      this.dialogIdx++;
      this.renderDialog();
      return true;
    }
    return false;
  }

  get dialogOpen() {
    return this.dialogIdx < this.dialogLines.length;
  }

  update(dt, view) {
    this.time += dt;
    const e = this.el;
    if (e.healthFill) {
      e.healthFill.style.width = clamp(view.health, 0, 100) + '%';
      e.healthFill.style.background = view.health > 35
        ? 'linear-gradient(90deg,#53d769,#a8e063)' : 'linear-gradient(90deg,#e33,#f66)';
    }
    if (e.wantedStars) {
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < view.stars ? '★' : '☆';
      e.wantedStars.textContent = stars;
      e.wantedStars.classList.toggle('hot', view.stars >= 3);
      e.wantedStars.classList.toggle('cooling', view.stars > 0 && view.cooling);
    }
    if (e.cashLabel) e.cashLabel.textContent = '$' + Math.round(view.cash).toLocaleString('en-US');
    if (e.respectLabel) e.respectLabel.textContent = 'Respect ' + Math.round(view.respect);
    if (e.speedLabel) {
      e.speedLabel.textContent = view.inCar ? Math.round(view.speedKmh) + ' km/h' : '';
    }
    if (e.radioLabel) {
      e.radioLabel.textContent = view.inCar ? '♪ ' + view.stationName : '';
    }
    if (e.objectiveLabel) e.objectiveLabel.textContent = view.objective || '';
    if (e.districtLabel) {
      const d = districtAt(view.x, view.z);
      e.districtLabel.textContent = d.name + ' · ' + d.sub;
    }
    if (e.timerLabel) {
      if (view.timeLeft !== null && view.timeLeft !== undefined) {
        e.timerLabel.textContent = '⏱ ' + Math.max(0, Math.ceil(view.timeLeft)) + 's';
        e.timerLabel.classList.add('show');
      } else {
        e.timerLabel.classList.remove('show');
      }
    }
    if (e.arrestFill) {
      const wrap = e.arrestFill.parentElement;
      if (view.arrest > 0.02) {
        wrap.classList.add('show');
        e.arrestFill.style.width = clamp(view.arrest * 100, 0, 100) + '%';
      } else {
        wrap.classList.remove('show');
      }
    }
    if (e.promptLabel) {
      if (view.prompt) {
        e.promptLabel.textContent = view.prompt;
        e.promptLabel.classList.add('show');
      } else {
        e.promptLabel.classList.remove('show');
      }
    }
    if (this.bannerUntil && this.time > this.bannerUntil) {
      e.jobBanner.classList.remove('show');
      this.bannerUntil = 0;
    }
    if (this.toastUntil && this.time > this.toastUntil) {
      e.toast.classList.remove('show');
      this.toastUntil = 0;
    }
    this.drawMinimap(view);
  }

  drawMinimap(view) {
    const ctx = this.mapCtx;
    if (!ctx || !this.map) return;
    const size = this.map.width;
    const half = size / 2;
    const scale = half / (CITY_HALF + 40);
    const toMap = (x, z) => [half + x * scale, half + z * scale];

    // Background: warm land with a teal sea at the south edge.
    ctx.fillStyle = '#2a2438';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#1d6f77';
    const [, seaY] = toMap(0, CITY_HALF + 30);
    ctx.fillRect(0, seaY, size, size - seaY);

    // Blocks.
    ctx.fillStyle = '#4a4258';
    for (let gx = 0; gx < GRID - 1; gx++) {
      for (let gz = 0; gz < GRID - 1; gz++) {
        const cx = gridToWorld(gx) + PITCH / 2;
        const cz = gridToWorld(gz) + PITCH / 2;
        const [mx, my] = toMap(cx, cz);
        const w = PITCH * scale * 0.82;
        ctx.fillRect(mx - w / 2, my - w / 2, w, w);
      }
    }
    // Roads.
    ctx.strokeStyle = '#8a8296';
    ctx.lineWidth = Math.max(1.5, 12 * scale);
    for (let i = 0; i < GRID; i++) {
      const c = gridToWorld(i);
      const [a] = toMap(c, 0);
      ctx.beginPath();
      ctx.moveTo(a, 0);
      ctx.lineTo(a, size);
      ctx.stroke();
      const [, b] = toMap(0, c);
      ctx.beginPath();
      ctx.moveTo(0, b);
      ctx.lineTo(size, b);
      ctx.stroke();
    }

    const dot = (x, z, color, r) => {
      const [mx, my] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    };

    // Traffic as pale dots, police as flashing red/blue dots.
    if (view.traffic) for (const car of view.traffic) dot(car.x, car.z, '#cfc8da', 1.6);
    if (view.police) {
      const phase = Math.floor(this.time * 5) % 2 === 0;
      for (const car of view.police) dot(car.x, car.z, phase ? '#ff4444' : '#4488ff', 2.6);
    }

    // Objective: a pulsing gold ring.
    if (view.target) {
      const [mx, my] = toMap(view.target.x, view.target.z);
      const r = 5 + Math.sin(this.time * 5) * 1.6;
      ctx.strokeStyle = '#ffd23c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd23c';
      ctx.beginPath();
      ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player arrow at the centre of attention.
    const [px, py] = toMap(view.x, view.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(view.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 2.4);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // North marker.
    ctx.fillStyle = '#ffd9a0';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', half, 13);
  }
}
