// hud.js — everything drawn over the 3D view: the wallet, wanted stars,
// health, objective line, dialogue box, prompts, toasts and banners, plus the
// canvas minimap (a pre-rendered static layer of streets and shore, with live
// dots for traffic, police, the objective and the player) refreshed every frame.

import { districtAt } from './config.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const els = {
    hud: $('hud'),
    minimap: $('minimap'),
    district: $('district-name'),
    stars: $('stars'),
    money: $('money'),
    respect: $('respect'),
    radio: $('radio-label'),
    healthFill: $('health-fill'),
    vehicleInfo: $('vehicle-info'),
    objectiveBox: $('objective-box'),
    objTitle: $('obj-title'),
    objText: $('obj-text'),
    objDist: $('obj-dist'),
    dialogBox: $('dialog-box'),
    dialogName: $('dialog-name'),
    dialogLine: $('dialog-line'),
    prompt: $('prompt'),
    toast: $('toast'),
    banner: $('banner'),
    bannerTitle: $('banner-title'),
    bannerSub: $('banner-sub'),
    damageFlash: $('damage-flash'),
    srStatus: $('sr-status'),
  };
  const timers = { dialog: 0, toast: 0, banner: 0 };
  let lastStars = -1;
  let staticLayer = null;

  // World -340..340 maps onto a 184 px square.
  const MAP_SIZE = 184;
  const MAP_SCALE = MAP_SIZE / 680;
  const mapX = (x) => (x + 340) * MAP_SCALE;
  const mapZ = (z) => (z + 340) * MAP_SCALE;

  function buildStaticLayer() {
    staticLayer = document.createElement('canvas');
    staticLayer.width = staticLayer.height = MAP_SIZE;
    const c = staticLayer.getContext('2d');
    const S = MAP_SCALE;
    c.fillStyle = '#12808f';
    c.fillRect(0, 0, MAP_SIZE, MAP_SIZE); // sea
    c.fillStyle = '#eacf9d';
    c.fillRect(mapX(-318), mapZ(-318), 636 * S, 636 * S); // island
    c.fillStyle = '#565d66';
    c.fillRect(mapX(-270), mapZ(-270), 540 * S, 540 * S); // city ground
    c.strokeStyle = '#31363d';
    c.lineWidth = 15 * S;
    for (let v = -240; v <= 240; v += 60) {
      c.beginPath();
      c.moveTo(mapX(v), mapZ(-270));
      c.lineTo(mapX(v), mapZ(270));
      c.stroke();
      c.beginPath();
      c.moveTo(mapX(-270), mapZ(v));
      c.lineTo(mapX(270), mapZ(v));
      c.stroke();
    }
    c.fillStyle = '#86b364';
    c.fillRect(mapX(-53), mapZ(-53), 46 * S, 46 * S); // plaza
    c.fillStyle = '#9a8d76';
    c.fillRect(mapX(266), mapZ(-280), 52 * S, 560 * S); // dock apron
    c.fillStyle = '#8a6844';
    c.fillRect(mapX(-10), mapZ(292), 20 * S, 86 * S); // pier
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 1;
    c.strokeRect(mapX(-318), mapZ(-318), 636 * S, 636 * S);
    return staticLayer;
  }

  const hud = {
    els,
    show() { els.hud.classList.remove('hidden'); },
    hide() { els.hud.classList.add('hidden'); },
    setMoney(m) { els.money.textContent = `$${m.toLocaleString('en-US')}`; },
    setRespect(r, districtRep) {
      els.respect.textContent = `RESPECT ${r}`;
      void districtRep;
    },
    setRadio(name) { els.radio.textContent = `♪ ${name}`; },
    setStars(n) {
      if (n === lastStars) return;
      lastStars = n;
      els.stars.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
      els.stars.style.opacity = n === 0 ? '0.25' : '1';
    },
    setHealth(frac) {
      els.healthFill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    },
    setVehicleInfo(text) { els.vehicleInfo.textContent = text || ''; },
    setDistrict(x, z) { els.district.textContent = districtAt(x, z).name; },
    setObjective(title, text, distText) {
      if (!title) {
        els.objectiveBox.classList.add('hidden');
        return;
      }
      els.objectiveBox.classList.remove('hidden');
      els.objTitle.textContent = title;
      els.objText.textContent = text;
      els.objDist.textContent = distText || '';
    },
    dialog(name, line) {
      els.dialogName.textContent = name;
      els.dialogLine.textContent = line;
      els.dialogBox.classList.remove('hidden');
      timers.dialog = 4.4;
      els.srStatus.textContent = `${name}: ${line}`;
    },
    prompt(html) {
      if (!html) {
        els.prompt.classList.add('hidden');
        return;
      }
      els.prompt.innerHTML = html;
      els.prompt.classList.remove('hidden');
    },
    toast(text) {
      els.toast.textContent = text;
      els.toast.classList.remove('hidden');
      timers.toast = 3.4;
    },
    banner(title, sub) {
      els.bannerTitle.textContent = title;
      els.bannerSub.textContent = sub || '';
      els.banner.classList.remove('hidden');
      timers.banner = 3.1;
    },
    flashDamage() {
      els.damageFlash.style.opacity = '1';
      setTimeout(() => { els.damageFlash.style.opacity = '0'; }, 90);
    },
    update(dt) {
      for (const key of Object.keys(timers)) {
        if (timers[key] > 0) {
          timers[key] -= dt;
          if (timers[key] <= 0) {
            if (key === 'dialog') els.dialogBox.classList.add('hidden');
            if (key === 'toast') els.toast.classList.add('hidden');
            if (key === 'banner') els.banner.classList.add('hidden');
          }
        }
      }
    },
    drawMinimap(data) {
      if (!staticLayer) buildStaticLayer();
      const c = els.minimap.getContext('2d');
      c.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
      c.drawImage(staticLayer, 0, 0);
      // Traffic: pale dots. Police: blue dots. Objective: gold beacon.
      c.fillStyle = 'rgba(240,240,230,0.8)';
      for (const car of data.traffic) {
        c.beginPath();
        c.arc(mapX(car.x), mapZ(car.z), 1.6, 0, 7);
        c.fill();
      }
      for (const cop of data.police) {
        c.fillStyle = '#3f8cff';
        c.beginPath();
        c.arc(mapX(cop.x), mapZ(cop.z), 2.6, 0, 7);
        c.fill();
        c.strokeStyle = '#ff2a1e';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(mapX(cop.x), mapZ(cop.z), 3.8, 0, 7);
        c.stroke();
      }
      if (data.target) {
        const pulse = 3.4 + Math.sin(data.t * 4) * 1.1;
        c.fillStyle = '#ffc93e';
        c.beginPath();
        c.arc(mapX(data.target.x), mapZ(data.target.z), pulse, 0, 7);
        c.fill();
        c.strokeStyle = 'rgba(255,201,62,0.6)';
        c.beginPath();
        c.arc(mapX(data.target.x), mapZ(data.target.z), pulse + 3.4, 0, 7);
        c.stroke();
      }
      // Player arrow.
      c.save();
      c.translate(mapX(data.px), mapZ(data.pz));
      c.rotate(Math.PI - data.heading); // canvas y is down; heading 0 faces +Z (south)
      c.fillStyle = '#ffffff';
      c.strokeStyle = '#17303a';
      c.beginPath();
      c.moveTo(0, -6);
      c.lineTo(4.4, 5);
      c.lineTo(0, 2.4);
      c.lineTo(-4.4, 5);
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
    },
  };
  return hud;
}
