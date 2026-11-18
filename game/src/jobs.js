// Story jobs and side work: eight chained jobs from Pak Darma, Raka and
// Bu Lastri, plus taxi fares and a street race. A glowing beacon marks the
// current objective; reaching it advances the step, pays out, and opens the
// next job. Dialogue plays through the HUD dialog panel.
import * as THREE from 'three';
import { CONFIG } from './config.js';

function buildBeacon(scene) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30; g.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
  g.visible = false;
  scene.add(g);
  return g;
}

export function createJobs(scene) {
  return {
    scene,
    beacon: buildBeacon(scene),
    index: 0, step: 0, active: false, done: false,
    dialogQueue: [], dialogTimer: 0,
    side: null, // { kind: 'taxi'|'race', ... }
    raceTimer: 0, raceCheckpoint: 0,
    completedCount: 0,
  };
}

export function currentJobDef(world) {
  return CONFIG.jobs[world.jobs.index] || null;
}

export function startJob(world, index) {
  const jobs = world.jobs;
  jobs.index = index;
  jobs.step = 0;
  jobs.active = true;
  jobs.done = false;
  const def = CONFIG.jobs[index];
  jobs.dialogQueue = def.dialog.slice();
  jobs.dialogTimer = 0;
  moveBeaconToStep(world);
  world.hud.setObjective(`${def.title} — ${def.steps[0].text}`);
  world.hud.toast(`Job baru: ${def.title}`);
  world.audio.blip();
}

function moveBeaconToStep(world) {
  const jobs = world.jobs;
  const def = currentJobDef(world);
  if (!def || !jobs.active) { jobs.beacon.visible = false; return; }
  const step = def.steps[jobs.step];
  if (!step) { jobs.beacon.visible = false; return; }
  jobs.beacon.position.set(step.at[0], 0, step.at[1]);
  jobs.beacon.visible = true;
}

export function objectiveText(world) {
  const jobs = world.jobs;
  if (jobs.side) {
    if (jobs.side.kind === 'taxi') return `Taksi: antar penumpang ke ${jobs.side.destName} (${jobs.side.left} tersisa)`;
    if (jobs.side.kind === 'race') return `Balapan: checkpoint ${jobs.raceCheckpoint + 1}/3 — ${Math.max(0, jobs.raceTimer).toFixed(0)} dtk`;
  }
  const def = currentJobDef(world);
  if (!def) return 'Semua job selesai — Teluk Kirana milikmu.';
  if (!jobs.active) return `Job berikutnya: ${def.title} — tekan J untuk mulai`;
  const step = def.steps[jobs.step];
  return step ? `${def.title}: ${step.text}` : def.title;
}

export function updateJobs(world, dt) {
  const jobs = world.jobs;
  // Dialogue lines, one at a time.
  if (jobs.dialogQueue.length > 0) {
    jobs.dialogTimer -= dt;
    if (jobs.dialogTimer <= 0) {
      const line = jobs.dialogQueue.shift();
      world.hud.showDialog(line);
      jobs.dialogTimer = 4.5;
    }
  }
  // Beacon pulse.
  if (jobs.beacon.visible) {
    const s = 1 + Math.sin(world.time * 3) * 0.12;
    jobs.beacon.scale.set(s, 1, s);
  }
  if (jobs.side) { updateSide(world, dt); return; }
  const def = currentJobDef(world);
  if (!def || !jobs.active) return;
  const step = def.steps[jobs.step];
  if (!step) return;
  const d = Math.hypot(world.player.pos.x - step.at[0], world.player.pos.z - step.at[1]);
  if (d < step.radius) {
    jobs.step += 1;
    world.audio.blip();
    if (jobs.step >= def.steps.length) {
      // Job complete.
      world.player.cash += def.reward;
      jobs.completedCount += 1;
      jobs.active = false;
      jobs.beacon.visible = false;
      world.hud.showDialog(`${def.giver}: "Bagus. $${def.reward} buatmu."`);
      world.hud.toast(`Job selesai! +$${def.reward}`);
      world.save.saveGame(world);
      const next = jobs.index + 1;
      if (next < CONFIG.jobs.length) {
        jobs.index = next;
        world.hud.setObjective(`Job berikutnya: ${CONFIG.jobs[next].title} — tekan J untuk mulai`);
      } else {
        jobs.done = true;
        world.hud.setObjective('Semua job selesai — Teluk Kirana milikmu.');
        world.hud.showDialog('Pak Darma: "Kamu legenda Teluk Kirana sekarang."');
      }
    } else {
      moveBeaconToStep(world);
      world.hud.setObjective(`${def.title} — ${def.steps[jobs.step].text}`);
    }
  }
}

// ---- Side activities ----

export function startTaxi(world) {
  const jobs = world.jobs;
  if (jobs.side) return;
  const dests = [
    { name: 'Perumahan', at: [208, 160] },
    { name: 'Pusat Kota', at: [64, -64] },
    { name: 'Pelabuhan', at: [0, 272] },
  ];
  const dest = dests[jobs.completedCount % dests.length];
  jobs.side = { kind: 'taxi', left: 3, dest, destName: dest.name };
  jobs.beacon.position.set(dest.at[0], 0, dest.at[1]);
  jobs.beacon.visible = true;
  world.hud.toast('Taksi: 3 penumpang menunggu. Antar mereka!');
  world.hud.showDialog('Penumpang: "Ke Perumahan, cepat ya!"');
}

export function startRace(world) {
  const jobs = world.jobs;
  if (jobs.side) return;
  jobs.side = { kind: 'race', checkpoints: [[-64, 272], [192, 256], [-224, 288]] };
  jobs.raceCheckpoint = 0;
  jobs.raceTimer = 120;
  jobs.beacon.position.set(-64, 0, 272);
  jobs.beacon.visible = true;
  world.hud.toast('Street race! 3 checkpoint, 120 detik.');
}

function updateSide(world, dt) {
  const jobs = world.jobs;
  const side = jobs.side;
  const px = world.player.pos.x, pz = world.player.pos.z;
  if (side.kind === 'taxi') {
    const d = Math.hypot(px - side.dest.at[0], pz - side.dest.at[1]);
    if (d < 10) {
      side.left -= 1;
      world.player.cash += 40;
      world.audio.blip();
      if (side.left <= 0) {
        jobs.side = null;
        jobs.beacon.visible = false;
        world.hud.toast('Taksi selesai! +$120');
        world.hud.setObjective(objectiveText(world));
      } else {
        const dests = [
          { name: 'Pasar Ikan', at: [-176, -32] },
          { name: 'Pinggiran', at: [-208, 176] },
          { name: 'Dermaga Barat', at: [-224, 288] },
        ];
        const dest = dests[(3 - side.left) % dests.length];
        side.dest = dest; side.destName = dest.name;
        jobs.beacon.position.set(dest.at[0], 0, dest.at[1]);
        world.hud.toast(`Penumpang berikutnya: ${dest.name} (+$40)`);
      }
    }
  } else if (side.kind === 'race') {
    jobs.raceTimer -= dt;
    const cp = side.checkpoints[jobs.raceCheckpoint];
    const d = Math.hypot(px - cp[0], pz - cp[1]);
    if (d < 10) {
      jobs.raceCheckpoint += 1;
      world.audio.blip();
      if (jobs.raceCheckpoint >= side.checkpoints.length) {
        const bonus = Math.max(50, Math.round(jobs.raceTimer) * 2);
        world.player.cash += bonus;
        jobs.side = null;
        jobs.beacon.visible = false;
        world.hud.toast(`Menang balapan! +$${bonus}`);
        world.hud.setObjective(objectiveText(world));
      } else {
        const next = side.checkpoints[jobs.raceCheckpoint];
        jobs.beacon.position.set(next[0], 0, next[1]);
      }
    }
    if (jobs.raceTimer <= 0) {
      jobs.side = null;
      jobs.beacon.visible = false;
      world.hud.toast('Balapan gagal — waktu habis.');
      world.hud.setObjective(objectiveText(world));
    }
  }
}
