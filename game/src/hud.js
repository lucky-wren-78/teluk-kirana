// The HUD: wanted stars, health, cash, speed, clock, weather and radio,
// a live minimap canvas, the objective line, dialogue panel, toasts, and
// the start / pause / game-over overlays. All DOM; the 3D view stays clean.
import { CONFIG } from './config.js';
import { objectiveText } from './jobs.js';

function $(id) { return document.getElementById(id); }

export function createHud(world) {
  const hud = {
    world,
    dialogTimer: null,
    toastTimer: null,
    lastObjective: '',
    minimap: $('minimap'),
    update(dt) { updateHud(world, dt); },
    toast(msg) { toast(world, msg); },
    showDialog(line) { showDialog(world, line); },
    setObjective(text) { $('objective').textContent = text; hud.lastObjective = text; },
    flashDamage() {
      const el = $('damage-flash');
      el.style.opacity = '0.55';
      setTimeout(() => { el.style.opacity = '0'; }, 180);
    },
    showGameOver(text) {
      $('gameover-text').textContent = text;
      $('gameover').classList.remove('hidden');
    },
    hideGameOver() { $('gameover').classList.add('hidden'); },
    showStart() { $('start-screen').classList.remove('hidden'); },
    hideStart() { $('start-screen').classList.add('hidden'); },
    setPaused(paused) { $('paused').classList.toggle('hidden', !paused); },
  };
  return hud;
}

function toast(world, msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(world.hud.toastTimer);
  world.hud.toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

function showDialog(world, line) {
  const el = $('dialog');
  el.textContent = line;
  el.classList.remove('hidden');
  clearTimeout(world.hud.dialogTimer);
  world.hud.dialogTimer = setTimeout(() => el.classList.add('hidden'), 4200);
}

function fmtClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function drawMinimap(world) {
  const cv = world.hud.minimap;
  if (!cv) return;
  const g = cv.getContext('2d');
  const S = cv.width;
  const scale = S / (CONFIG.worldSize + 40);
  const toX = (x) => (x + CONFIG.worldSize / 2 + 20) * scale;
  const toZ = (z) => (z + CONFIG.worldSize / 2 + 20) * scale;
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#10151d';
  g.fillRect(0, 0, S, S);
  // Water at the south edge.
  g.fillStyle = '#14586e';
  g.fillRect(0, toZ(320), S, S - toZ(320));
  // Districts.
  for (const d of CONFIG.districts) {
    g.fillStyle = d.accent + '33';
    g.fillRect(toX(d.cx - d.hx), toZ(d.cz - d.hz), d.hx * 2 * scale, d.hz * 2 * scale);
  }
  // Roads.
  g.strokeStyle = '#3a3f47';
  g.lineWidth = 2;
  for (const r of world.city.roadLines) {
    g.beginPath(); g.moveTo(toX(r), 0); g.lineTo(toX(r), S); g.stroke();
    g.beginPath(); g.moveTo(0, toZ(r)); g.lineTo(S, toZ(r)); g.stroke();
  }
  // Job beacon.
  if (world.jobs.beacon.visible) {
    const bx = toX(world.jobs.beacon.position.x);
    const bz = toZ(world.jobs.beacon.position.z);
    g.fillStyle = '#ffd24a';
    g.beginPath(); g.arc(bx, bz, 5 + Math.sin(world.time * 4) * 1.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffd24a'; g.beginPath(); g.arc(bx, bz, 9, 0, Math.PI * 2); g.stroke();
  }
  // Police chasers.
  g.fillStyle = '#4d7cff';
  for (const car of world.police.chasers) {
    g.beginPath(); g.arc(toX(car.pos.x), toZ(car.pos.z), 3, 0, Math.PI * 2); g.fill();
  }
  // Player arrow.
  const px = toX(world.player.pos.x);
  const pz = toZ(world.player.pos.z);
  g.save();
  g.translate(px, pz);
  g.rotate(Math.PI - world.player.heading);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
  g.restore();
  // North marker.
  g.fillStyle = '#ffffff';
  g.font = 'bold 11px system-ui, sans-serif';
  g.fillText('N', S / 2 - 4, 12);
}

function updateHud(world, dt) {
  const { player, police } = world;
  // Stars.
  const stars = $('stars');
  let s = '';
  for (let i = 1; i <= 5; i += 1) s += i <= police.wanted ? '★' : '☆';
  if (stars.textContent !== s) stars.textContent = s;
  stars.classList.toggle('hot', police.wanted >= 3);
  // Health / cash / ammo / speed / clock / weather / radio.
  $('health-fill').style.width = `${Math.max(0, player.health)}%`;
  $('cash').textContent = `$${Math.round(player.cash)}`;
  $('ammo').textContent = player.inVehicle ? '—' : `◉ ${player.ammo}`;
  $('speed').textContent = `${Math.round(world.speedKmh || 0)} km/h`;
  $('clock').textContent = fmtClock(world.timeOfDay);
  $('weather').textContent = world.weather === 'rain' ? '🌧 Hujan' : '☀ Cerah';
  $('radio').textContent = CONFIG.radio[world.audioState.station].name;
  // Objective line follows the jobs module.
  const obj = objectiveText(world);
  if (obj && obj !== world.hud.lastObjective) world.hud.setObjective(obj);
  // Interact prompt.
  const prompt = $('prompt');
  if (!player.inVehicle && world.vehicles.nearestCar) {
    prompt.textContent = world.vehicles.nearestCar.driver === 'npc'
      ? 'Tekan E — bajak mobil' : 'Tekan E — naik mobil';
    prompt.classList.remove('hidden');
  } else if (player.inVehicle) {
    prompt.textContent = 'Tekan E — turun';
    prompt.classList.remove('hidden');
  } else {
    prompt.classList.add('hidden');
  }
  drawMinimap(world);
}
