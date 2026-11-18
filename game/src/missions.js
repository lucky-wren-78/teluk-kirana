// missions.js — the story of Heat Season: six jobs told by Sari the harbour
// fixer and Bimo the mechanic, run by a small objective director. Objectives
// are plain data (go to, steal, collect, hold, escape, checkpoints); the
// director moves a light-beam marker around the city, plays the dialogue,
// watches timers and pays out. A repeatable beach-road race unlocks after job 2.

import * as THREE from '../vendor/three.module.min.js';
import { LANDMARKS } from './world.js';
import { distance2d } from './random.js';

const L = LANDMARKS;

export const STORY_JOBS = [
  {
    id: 'paket-pertama',
    title: 'Job 1 · Paket Pertama',
    giver: 'SARI',
    startAt: L.cafeSari,
    meetText: 'Meet Sari at Kafe Sari',
    intro: [
      'You are the new driver everyone keeps talking about? Good. I need hands I can trust.',
      'A crate of mine is sitting at the dock gate. Pick it up and take it to Bimo at his garage.',
    ],
    steps: [
      { kind: 'goto', at: L.dockGate, text: 'Pick up Sari’s crate at the Dock Gate' },
      { kind: 'goto', at: L.garageBimo, text: 'Deliver the crate to Bimo’s garage' },
    ],
    outro: ['Clean run. The harbour remembers who delivers. There will be more work.'],
    reward: { money: 250, respect: 4, district: 'harbour' },
  },
  {
    id: 'mobil-pinjaman',
    title: 'Job 2 · Mobil Pinjaman',
    giver: 'BIMO',
    startAt: L.garageBimo,
    meetText: 'Meet Bimo at his garage',
    intro: [
      'A pink Comet GT in Bukit Palem. Rich kid, richer debts. The bank says it is ours now.',
      'Take it — gently, if you can — and bring it here. Oh, and keep this pistol. Just in case.',
    ],
    steps: [
      { kind: 'goto', at: L.hotelPalem, text: 'Head to Bukit Palem, near Hotel Palem' },
      { kind: 'steal', at: { x: -150, z: -173 }, text: 'Steal the pink Comet GT' },
      { kind: 'goto', at: L.garageBimo, text: 'Deliver the Comet GT to Bimo’s garage' },
    ],
    outro: ['Not a scratch that matters. You have a gift, kawan. The pistol is yours now.'],
    reward: { money: 400, respect: 5, district: 'palm', unlock: 'pistol' },
  },
  {
    id: 'tiga-peti',
    title: 'Job 3 · Tiga Peti',
    giver: 'SARI',
    startAt: L.dockGate,
    meetText: 'Meet Sari at the Dock Gate',
    intro: [
      'Three crates fell off a manifest around my docks. Customs is suddenly very curious.',
      'Collect all three and bring your car back to the gate. If the Patroli sniff around, do not lead them to me.',
    ],
    steps: [
      {
        kind: 'collect', count: 3, heatOnFirst: 2,
        points: [{ x: 268, z: -60 }, { x: 292, z: 118 }, { x: 274, z: -168 }],
        text: 'Collect the unmarked crates',
      },
      { kind: 'goto', at: L.dockGate, text: 'Return to the Dock Gate' },
    ],
    outro: ['All three. The harbour breathes again — and so do I.'],
    reward: { money: 600, respect: 6, district: 'harbour' },
  },
  {
    id: 'penumpang-malam',
    title: 'Job 4 · Penumpang Malam',
    giver: 'BIMO',
    startAt: L.garageBimo,
    meetText: 'Meet Bimo at his garage',
    intro: [
      'A singer from the capital is stuck downtown and her boat leaves from the Palem side.',
      'Pick her up at the downtown corner and get her to Hotel Palem. She hates being late more than I hate rust.',
    ],
    steps: [
      { kind: 'goto', at: L.passengerSpot, text: 'Pick up the singer downtown' },
      { kind: 'goto', at: L.hotelPalem, text: 'Drive the singer to Hotel Palem', timeLimit: 140 },
    ],
    outro: ['She tipped in songs and cash. Mostly cash. Good driving.'],
    reward: { money: 800, respect: 6, district: 'downtown' },
  },
  {
    id: 'brankas-bank',
    title: 'Job 5 · Brankas Bank',
    giver: 'SARI',
    startAt: L.cafeSari,
    meetText: 'Meet Sari at Kafe Sari',
    intro: [
      'Bank Kirana keeps the dockers’ wages in a vault and calls it "processing". Five days of processing.',
      'Hold your nerve at the bank, take what is owed, and disappear to the old-town safehouse. Do not get caught.',
    ],
    steps: [
      { kind: 'goto', at: L.bankKirana, text: 'Go to Bank Kirana' },
      { kind: 'hold', at: L.bankKirana, seconds: 5, heatOnStart: 3, text: 'Empty the vault — hold your ground' },
      { kind: 'escape', at: L.safehouse, text: 'Escape to the safehouse in Kota Tua' },
    ],
    outro: ['The wages are back with the dockers by morning. You are becoming a story they tell here.'],
    reward: { money: 1500, respect: 9, district: 'oldtown' },
  },
  {
    id: 'perahu-terakhir',
    title: 'Job 6 · Perahu Terakhir',
    giver: 'SARI',
    startAt: L.dockGate,
    meetText: 'Meet Sari at the Dock Gate — the finale',
    intro: [
      'One last run, and the whole island will know your name. Hit every checkpoint across Kirana.',
      'Then the heat will come — all of it. Lose them at my boat on the pier. Do not stop for anything.',
    ],
    steps: [
      {
        kind: 'checkpoints', timeLimit: 165,
        points: [L.plaza, { x: 180, z: 180 }, L.hotelPalem, { x: -180, z: -60 }, L.raceStart],
        text: 'Hit every checkpoint',
      },
      { kind: 'escape', at: L.pierEnd, heatOnStart: 4, text: 'Reach Sari’s boat at the end of the pier' },
    ],
    outro: ['You did it. Teluk Kirana is yours now — every district, every street. Heat Season complete.'],
    reward: { money: 3000, respect: 15, district: 'downtown' },
  },
];

const RACE_POINTS = [
  { x: 60, z: 252 }, { x: -60, z: 180 }, { x: -180, z: 252 }, { x: 60, z: 120 },
];
const RACE_TIME_LIMIT = 80;
const RACE_REWARD = 300;

export function createMissionDirector(deps) {
  const { scene, state, police, ui, audio, jobCar, onReward, onSeasonComplete, persist } = deps;

  // The golden light-beam marker the whole city navigates by.
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 2.3, 30, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffc93e, transparent: true, opacity: 0.34,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  beam.position.y = 15;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4.4, 5.6, 28),
    new THREE.MeshBasicMaterial({
      color: 0xffc93e, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.18;
  const markerGroup = new THREE.Group();
  markerGroup.add(beam);
  markerGroup.add(ring);
  markerGroup.visible = false;
  scene.add(markerGroup);

  const crateMeshes = [];

  const director = {
    markerGroup,
    crateMeshes,
    mode: 'meet', // meet | active | race | free
    jobIndex: 0,
    stepIndex: 0,
    stepIndex2: 0,
    armed: false,
    collected: 0,
    stepTime: 0,
    holdProgress: 0,
    dialogQueue: [],
    dialogTimer: 0,
    afterDialog: null,
    raceStep: 0,
    raceTime: 0,
    raceCooldown: 0,
    markerPulse: 0,
    target: null,
    objectiveTitle: '',
    objectiveText: '',

    currentJob() { return STORY_JOBS[this.jobIndex] || null; },

    currentStep() {
      const job = this.currentJob();
      return job ? job.steps[this.stepIndex] : null;
    },

    begin() {
      this.jobIndex = state.jobIndex;
      this.mode = state.seasonDone ? 'free' : 'meet';
      this.refreshObjective();
    },

    refreshObjective() {
      const job = this.currentJob();
      if (this.mode === 'meet' && job) {
        this.target = job.startAt;
        this.objectiveTitle = job.title;
        this.objectiveText = job.meetText;
      } else if (this.mode === 'active' && job) {
        const step = this.currentStep();
        this.objectiveTitle = job.title;
        this.objectiveText = step.text;
        if (step.kind === 'collect') {
          this.target = step.points.find((p) => !p.taken) || null;
        } else if (step.kind === 'checkpoints') {
          this.target = step.points[this.stepIndex2] || null;
        } else {
          this.target = step.at;
        }
      } else if (this.mode === 'race') {
        this.target = RACE_POINTS[this.raceStep];
        this.objectiveTitle = 'Street Race · Beach Road';
        this.objectiveText = `Checkpoint ${this.raceStep + 1} of ${RACE_POINTS.length} — ${Math.max(0, Math.ceil(RACE_TIME_LIMIT - this.raceTime))}s`;
      } else if (this.mode === 'free' && state.jobIndex >= 2) {
        this.target = LANDMARKS.raceStart;
        this.objectiveTitle = 'Free Roam';
        this.objectiveText = 'Drive to Beach Road for a street race, or make your own trouble';
      } else {
        this.target = null;
        this.objectiveTitle = '';
        this.objectiveText = '';
      }
    },

    say(name, lines, after) {
      for (const line of lines) this.dialogQueue.push({ name, line });
      this.afterDialog = after || null;
    },

    startJob() {
      const job = this.currentJob();
      this.mode = 'active';
      this.armed = false;
      this.stepIndex = 0;
      this.stepTime = 0;
      ui.banner(job.title.replace(/^Job \d+ · /, ''), 'A new story job');
      this.say(job.giver, job.intro, () => this.armStep());
      this.refreshObjective();
    },

    armStep() {
      const step = this.currentStep();
      this.armed = true;
      this.stepTime = 0;
      this.holdProgress = 0;
      this.collected = 0;
      this.stepIndex2 = 0;
      if (step.kind === 'collect') {
        for (const p of step.points) {
          p.taken = false;
          const crate = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 1.5, 1.5),
            new THREE.MeshBasicMaterial({ color: 0xffc93e }),
          );
          crate.position.set(p.x, 1.1, p.z);
          scene.add(crate);
          crateMeshes.push(crate);
        }
      }
      if (step.heatOnStart) police.setMinStars(step.heatOnStart);
      this.refreshObjective();
    },

    completeStep() {
      audio.sfx.checkpoint();
      this.stepIndex++;
      const job = this.currentJob();
      if (this.stepIndex >= job.steps.length) this.completeJob();
      else {
        this.armStep();
        this.refreshObjective();
      }
    },

    completeJob() {
      const job = this.currentJob();
      for (const crate of crateMeshes) scene.remove(crate);
      crateMeshes.length = 0;
      this.say(job.giver, job.outro, null);
      onReward(job);
      audio.sfx.jobDone();
      ui.toast(`JOB COMPLETE · +$${job.reward.money}`);
      state.jobIndex++;
      this.jobIndex = state.jobIndex;
      if (job.reward.unlock === 'pistol') state.hasPistol = true;
      if (this.jobIndex >= STORY_JOBS.length) {
        state.seasonDone = true;
        this.mode = 'free';
        onSeasonComplete();
      } else {
        this.mode = 'meet';
      }
      persist();
      this.refreshObjective();
    },

    failStep(reason) {
      ui.toast(reason);
      audio.sfx.busted();
      police.clearHeat();
      this.stepIndex = 0;
      this.armStep();
      this.refreshObjective();
    },

    notifyEnteredVehicle(vehicle) {
      if (this.mode !== 'active') return;
      const step = this.currentStep();
      if (step && step.kind === 'steal' && vehicle === jobCar) {
        ui.toast('You have the Comet GT');
        this.completeStep();
      }
    },

    update(dt, ctx, t) {
      this.markerPulse += dt;
      this.pumpDialogue(dt);
      this.updateMarker();
      for (const crate of crateMeshes) crate.rotation.y += dt * 1.4;

      const px = ctx.px;
      const pz = ctx.pz;
      if (this.mode === 'meet') {
        const job = this.currentJob();
        if (job && distance2d(px, pz, job.startAt.x, job.startAt.z) < 7.5) this.startJob();
        return;
      }
      if (this.mode === 'free') {
        this.updateFreeRoam(dt, ctx);
        return;
      }
      if (this.mode === 'race') {
        this.updateRace(dt, ctx);
        return;
      }
      this.updateActiveStep(dt, ctx);
      void t;
    },

    // One dialogue line every 3.6 s; the pending callback (arming the first
    // step) fires once the last line has had its time on screen.
    pumpDialogue(dt) {
      if (this.dialogTimer > 0) this.dialogTimer -= dt;
      if (this.dialogQueue.length && this.dialogTimer <= 0) {
        const next = this.dialogQueue.shift();
        ui.dialog(next.name, next.line);
        this.dialogTimer = 3.6;
      }
      if (!this.dialogQueue.length && this.dialogTimer <= 0 && this.afterDialog) {
        const after = this.afterDialog;
        this.afterDialog = null;
        after();
      }
    },

    updateMarker() {
      if (this.target) {
        markerGroup.visible = true;
        markerGroup.position.set(this.target.x, 0, this.target.z);
        const s = 1 + Math.sin(this.markerPulse * 3.2) * 0.1;
        ring.scale.set(s, s, 1);
        beam.material.opacity = 0.28 + Math.sin(this.markerPulse * 3.2) * 0.08;
      } else {
        markerGroup.visible = false;
      }
    },

    updateFreeRoam(dt, ctx) {
      this.raceCooldown = Math.max(0, this.raceCooldown - dt);
      const atStart = distance2d(ctx.px, ctx.pz, LANDMARKS.raceStart.x, LANDMARKS.raceStart.z) < 9;
      if (state.jobIndex >= 2 && ctx.inCar && this.raceCooldown <= 0 && atStart) {
        this.mode = 'race';
        this.raceStep = 0;
        this.raceTime = 0;
        ui.banner('STREET RACE', 'Beat the clock · $300');
        audio.sfx.blip();
        this.refreshObjective();
      }
    },

    updateRace(dt, ctx) {
      this.raceTime += dt;
      const point = RACE_POINTS[this.raceStep];
      if (distance2d(ctx.px, ctx.pz, point.x, point.z) < 10) {
        audio.sfx.checkpoint();
        this.raceStep++;
        if (this.raceStep >= RACE_POINTS.length) {
          state.money += RACE_REWARD;
          state.respect += 2;
          state.racesWon++;
          ui.toast(`RACE WON · +$${RACE_REWARD}`);
          audio.sfx.cash();
          this.mode = 'free';
          this.raceCooldown = 20;
          persist();
        }
      } else if (this.raceTime > RACE_TIME_LIMIT) {
        ui.toast('Race lost — the clock wins this one');
        this.mode = 'free';
        this.raceCooldown = 8;
      }
      this.refreshObjective();
    },

    updateActiveStep(dt, ctx) {
      // Only once the intro dialogue has armed the step.
      const job = this.currentJob();
      if (!job || !this.armed) return;
      const step = this.currentStep();
      const px = ctx.px;
      const pz = ctx.pz;
      this.stepTime += dt;
      if (step.timeLimit && this.stepTime > step.timeLimit) {
        this.failStep('Out of time — the job restarts');
        return;
      }
      if (step.kind === 'goto' || step.kind === 'escape') {
        const radius = step.kind === 'escape' ? 9 : 8;
        if (distance2d(px, pz, step.at.x, step.at.z) < radius) {
          if (step.kind === 'escape') police.clearHeat();
          this.completeStep();
        }
      } else if (step.kind === 'hold') {
        if (distance2d(px, pz, step.at.x, step.at.z) < 9) {
          this.holdProgress += dt;
          this.objectiveText = `${step.text} (${Math.ceil(step.seconds - this.holdProgress)}s)`;
          if (this.holdProgress >= step.seconds) this.completeStep();
        } else {
          this.holdProgress = Math.max(0, this.holdProgress - dt * 0.7);
        }
      } else if (step.kind === 'collect') {
        step.points.forEach((p, i) => {
          if (!p.taken && distance2d(px, pz, p.x, p.z) < 7.5) {
            p.taken = true;
            scene.remove(crateMeshes[i]);
            this.collected++;
            audio.sfx.pickup();
            if (step.heatOnFirst && this.collected === 1) police.setMinStars(step.heatOnFirst);
            ui.toast(`Crate ${this.collected} of ${step.count}`);
            if (this.collected >= step.count) this.completeStep();
          }
        });
        if (this.mode === 'active') this.refreshObjective();
      } else if (step.kind === 'checkpoints') {
        const point = step.points[this.stepIndex2];
        if (point && distance2d(px, pz, point.x, point.z) < 11) {
          audio.sfx.checkpoint();
          this.stepIndex2++;
          ui.toast(`Checkpoint ${this.stepIndex2} of ${step.points.length}`);
          if (this.stepIndex2 >= step.points.length) this.completeStep();
          else this.refreshObjective();
        }
      }
    },
  };
  return director;
}
