// jobs.js - the story jobs and side activities of Teluk Kirana.
// Six story jobs in sequence, each with opening dialogue, a clear
// objective, a 3D light beam marker and cash + respect rewards.
// Two repeatable side activities run between story jobs: taxi fares
// and a short checkpoint street race.

import * as THREE from 'three';
import { gridToWorld, PIER_Z, POI } from './config.js';
import { distance2d } from './rng.js';

// Cast of original characters who give the jobs.
export const CAST = {
  salma: 'Salma the Harbor Captain',
  bimo: 'Bimo the Mechanic',
  ratu: 'Ratu the Market Trader',
  dewo: 'Dewo the Courier',
  lala: 'Lala the Beach Singer',
  pakTono: 'Pak Tono the Dock Foreman',
};

// Job definitions. kind drives the objective logic in the JobSystem:
// deliverCar, pickupDeliver, escape, passenger, chaseTarget, escortCargo.
export const STORY_JOBS = [
  {
    id: 'job1',
    title: 'First Wheels',
    giver: CAST.bimo,
    kind: 'deliverCar',
    dialog: [
      ['Bimo', 'You walk everywhere in this heat? Take that coupe by my bench.'],
      ['Bimo', 'Drive it down to the shipyard garage. Gently, she is a classic.'],
      ['You', 'Consider it delivered, Bimo.'],
    ],
    target: { x: POI.garage.x, z: POI.garage.z, label: 'Shipyard Garage' },
    cash: 300, respect: 10,
  },
  {
    id: 'job2',
    title: 'Market Rush',
    giver: CAST.ratu,
    kind: 'pickupDeliver',
    dialog: [
      ['Ratu', 'My spice crates sit at the Grand Market, and the pier buyers leave soon!'],
      ['Ratu', 'Pick up the package at Pasar Raya, then race it to the pier. Quick!'],
      ['You', 'On it. Nobody outruns the heat.'],
    ],
    pickup: { x: gridToWorld(3) + 10, z: gridToWorld(3) - 14, label: 'Spice Package' },
    target: { x: gridToWorld(3), z: PIER_Z, label: 'The Pier' },
    timeLimit: 110,
    cash: 450, respect: 14,
  },
  {
    id: 'job3',
    title: 'Cool Down',
    giver: CAST.dewo,
    kind: 'escape',
    dialog: [
      ['Dewo', 'Bad news: the port police think my van carried more than fish.'],
      ['Dewo', 'They are watching you now too. Lose the heat, three stars, all of it.'],
      ['You', 'Stay low, break sight, let it cool. Got it.'],
    ],
    startStars: 3,
    cash: 500, respect: 18,
  },
  {
    id: 'job4',
    title: 'Singer to the Shore',
    giver: CAST.lala,
    kind: 'passenger',
    dialog: [
      ['Lala', 'My show at Kirana Beach starts at sunset and my ride never came!'],
      ['Lala', 'Take me there in any car with four wheels. I tip in songs and cash.'],
      ['You', 'Hop in. Front row traffic, coming up.'],
    ],
    pickup: { x: gridToWorld(2) - 8, z: gridToWorld(4) + 8, label: 'Lala' },
    target: { x: gridToWorld(0) + 8, z: gridToWorld(0) + 6, label: 'Kirana Beach Stage' },
    cash: 380, respect: 12,
  },
  {
    id: 'job5',
    title: 'Runaway Truck',
    giver: CAST.salma,
    kind: 'chaseTarget',
    dialog: [
      ['Salma', 'A dock runner just stole a loaded pickup and fled north!'],
      ['Salma', 'Chase him down and stop that truck. Ram it until it gives up.'],
      ['You', 'One stopped truck, coming right up.'],
    ],
    targetHealth: 60,
    cash: 650, respect: 22,
  },
  {
    id: 'job6',
    title: 'Heat Season Finale',
    giver: CAST.pakTono,
    kind: 'escortCargo',
    dialog: [
      ['Pak Tono', 'One last container, kid. It goes to Palm Heights tonight.'],
      ['Pak Tono', 'The helicopter will be watching. Drive smart, drive fast.'],
      ['You', 'Heat season ends with me on top, Pak.'],
    ],
    pickup: { x: gridToWorld(4), z: PIER_Z, label: 'Marked Container Truck' },
    target: { x: gridToWorld(5) - 10, z: gridToWorld(0) + 10, label: 'Palm Heights Villa' },
    startStars: 2,
    cash: 1200, respect: 40,
  },
];

// A glowing vertical beam marking the current objective.
export function makeObjectiveBeam() {
  const group = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd23c, transparent: true, opacity: 0.4,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 42, 12, 1, true), beamMat);
  beam.position.y = 21;
  group.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd23c, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.1, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  group.visible = false;
  group.userData = { beam, ring };
  return group;
}

export class JobSystem {
  constructor(scene, state, police) {
    this.scene = scene;
    this.state = state;      // shared game state (cash, respect, jobsDone)
    this.police = police;
    this.beam = makeObjectiveBeam();
    scene.add(this.beam);
    this.active = null;      // current job runtime object
    this.dialogQueue = [];
    this.onDialog = null;    // callback(lines, done)
    this.onBanner = null;    // callback(text, sub)
    this.onRadio = null;     // callback(text)
    this.targetCar = null;   // for chaseTarget jobs
    this.time = 0;
  }

  nextJobIndex() {
    return this.state.jobsDone.length;
  }

  allDone() {
    return this.nextJobIndex() >= STORY_JOBS.length;
  }

  // Start the next story job if none is active.
  startNext() {
    if (this.active || this.allDone()) return false;
    const def = STORY_JOBS[this.nextJobIndex()];
    this.active = {
      def,
      stage: def.kind === 'pickupDeliver' || def.kind === 'passenger' || def.kind === 'escortCargo'
        ? 'pickup' : 'main',
      timeLeft: def.timeLimit || 0,
      startedAt: this.time,
      targetCarHealth: def.targetHealth || 0,
    };
    if (def.startStars) this.police.setStars(Math.max(this.police.stars, def.startStars));
    if (this.onDialog) this.onDialog(def.dialog, def.giver);
    if (this.onRadio) this.onRadio('New job: ' + def.title + ' - ' + def.giver);
    return true;
  }

  currentTarget() {
    if (!this.active) return null;
    const a = this.active;
    if (a.stage === 'pickup') return a.def.pickup;
    if (a.def.kind === 'chaseTarget' && this.targetCar) {
      return { x: this.targetCar.x, z: this.targetCar.z, label: 'Target Truck' };
    }
    if (a.def.kind === 'escape') return null;
    return a.def.target;
  }

  objectiveText() {
    if (!this.active) {
      if (this.allDone()) return 'All story jobs done. Free roam the bay!';
      const def = STORY_JOBS[this.nextJobIndex()];
      return 'Next job: ' + def.title + ' (press J)';
    }
    const a = this.active;
    const d = a.def;
    switch (d.kind) {
      case 'deliverCar':
        return 'Deliver the car to the Shipyard Garage';
      case 'pickupDeliver':
        return a.stage === 'pickup' ? 'Pick up the spice package at Pasar Raya' : 'Deliver the package to the pier!';
      case 'escape':
        return 'Lose the police: break sight until the stars are gone';
      case 'passenger':
        return a.stage === 'pickup' ? 'Pick up Lala (in a car)' : 'Drive Lala to Kirana Beach';
      case 'chaseTarget':
        return 'Stop the runaway truck: ram it!';
      case 'escortCargo':
        return a.stage === 'pickup' ? 'Collect the container truck at the pier' : 'Deliver the cargo to Palm Heights';
      default:
        return d.title;
    }
  }

  complete() {
    const a = this.active;
    if (!a) return;
    this.state.cash += a.def.cash;
    this.state.respect += a.def.respect;
    this.state.jobsDone.push(a.def.id);
    if (this.onBanner) {
      this.onBanner('JOB COMPLETE', a.def.title + '  +$' + a.def.cash + '  +' + a.def.respect + ' respect');
    }
    this.active = null;
    this.targetCar = null;
    this.beam.visible = false;
  }

  fail(reason) {
    if (!this.active) return;
    if (this.onBanner) this.onBanner('JOB FAILED', reason + ' - press J to retry');
    if (this.active.def.startStars && this.active.def.kind !== 'escape') {
      // Leave the heat as it is; the player must cool down naturally.
    }
    this.active = null;
    this.targetCar = null;
    this.beam.visible = false;
  }

  // Per-frame update. ctx carries player, cars and callbacks.
  update(dt, ctx) {
    this.time += dt;
    const a = this.active;
    // Animate the beam even with no job (hidden anyway).
    if (this.beam.visible) {
      this.beam.userData.ring.rotation.z += dt * 1.5;
      this.beam.userData.beam.material.opacity = 0.32 + Math.sin(this.time * 3) * 0.1;
    }
    if (!a) return;
    const player = ctx.player;
    const p = player.pos;

    // Timer jobs.
    if (a.def.timeLimit && a.stage !== 'pickup') {
      a.timeLeft -= dt;
      if (a.timeLeft <= 0) {
        this.fail('Out of time');
        if (ctx.onFailSound) ctx.onFailSound();
        return;
      }
    } else if (a.def.timeLimit && a.stage === 'pickup') {
      a.timeLeft = a.def.timeLimit;
    }

    // Position the beam on the current target.
    const target = this.currentTarget();
    if (target) {
      this.beam.visible = true;
      this.beam.position.set(target.x, 0, target.z);
    } else {
      this.beam.visible = false;
    }

    const d = a.def;
    const near = target ? distance2d(p.x, p.z, target.x, target.z) : Infinity;

    switch (d.kind) {
      case 'deliverCar': {
        if (player.car && near < 7) this.complete();
        break;
      }
      case 'pickupDeliver': {
        if (a.stage === 'pickup' && near < 5) {
          a.stage = 'main';
          if (this.onRadio) this.onRadio('Package collected. The clock is running!');
        } else if (a.stage === 'main' && near < 7) {
          this.complete();
        }
        break;
      }
      case 'escape': {
        if (this.police.stars === 0) this.complete();
        break;
      }
      case 'passenger': {
        if (a.stage === 'pickup') {
          if (player.car && near < 6) {
            a.stage = 'main';
            if (this.onDialog) {
              this.onDialog([['Lala', 'Nice wheels! Beach, please, and do not spare the palms.']], 'Lala');
            }
          }
        } else if (player.car && near < 7) {
          this.complete();
        }
        break;
      }
      case 'chaseTarget': {
        if (this.targetCar) {
          if (this.targetCar.health <= 100 - a.targetCarHealth || this.targetCar.stopped) {
            this.complete();
          }
        }
        break;
      }
      case 'escortCargo': {
        if (a.stage === 'pickup' && near < 6) {
          a.stage = 'main';
          this.police.setStars(Math.max(this.police.stars, 2));
          if (this.onRadio) this.onRadio('Cargo rolling. Expect company from the sky.');
        } else if (a.stage === 'main' && near < 8) {
          this.complete();
        }
        break;
      }
      default:
        break;
    }
  }
}

// Side activity: taxi fares. Pick a passenger point, then a drop point.
export class TaxiActivity {
  constructor(state) {
    this.state = state;
    this.active = false;
    this.stage = 'pickup';
    this.pickup = null;
    this.drop = null;
    this.fare = 0;
  }

  start(rng) {
    const spots = [
      { x: gridToWorld(1) + 6, z: gridToWorld(5) - 6 },
      { x: gridToWorld(4) - 6, z: gridToWorld(1) + 6 },
      { x: gridToWorld(2) + 6, z: gridToWorld(2) - 6 },
      { x: gridToWorld(5) - 6, z: gridToWorld(3) + 6 },
      { x: gridToWorld(0) + 6, z: gridToWorld(4) - 6 },
    ];
    this.pickup = spots[rng.int(0, spots.length - 1)];
    let drop = spots[rng.int(0, spots.length - 1)];
    if (drop === this.pickup) drop = spots[(spots.indexOf(this.pickup) + 2) % spots.length];
    this.drop = drop;
    this.fare = 90 + rng.int(0, 12) * 15;
    this.stage = 'pickup';
    this.active = true;
    return this.pickup;
  }

  target() {
    if (!this.active) return null;
    return this.stage === 'pickup'
      ? { ...this.pickup, label: 'Taxi Passenger' }
      : { ...this.drop, label: 'Taxi Drop-off' };
  }

  update(player) {
    if (!this.active) return null;
    const p = player.pos;
    const t = this.target();
    if (!player.car) return null;
    if (distance2d(p.x, p.z, t.x, t.z) < 6.5) {
      if (this.stage === 'pickup') {
        this.stage = 'drop';
        return 'picked';
      }
      this.active = false;
      this.state.cash += this.fare;
      this.state.respect += 2;
      this.state.sideDone = (this.state.sideDone || 0) + 1;
      return 'done';
    }
    return null;
  }
}

// Side activity: a short checkpoint street race against the clock.
export class RaceActivity {
  constructor(state) {
    this.state = state;
    this.active = false;
    this.points = [];
    this.idx = 0;
    this.timeLeft = 0;
    this.prize = 400;
  }

  start() {
    this.points = [
      { x: gridToWorld(0), z: gridToWorld(6), label: 'Checkpoint 1' },
      { x: gridToWorld(3), z: gridToWorld(6), label: 'Checkpoint 2' },
      { x: gridToWorld(6), z: gridToWorld(6), label: 'Checkpoint 3' },
      { x: gridToWorld(6), z: gridToWorld(3), label: 'Checkpoint 4' },
      { x: gridToWorld(6), z: gridToWorld(0), label: 'Finish' },
    ];
    this.idx = 0;
    this.timeLeft = 75;
    this.active = true;
  }

  target() {
    if (!this.active) return null;
    return this.points[this.idx];
  }

  update(dt, player) {
    if (!this.active) return null;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.active = false;
      return 'failed';
    }
    const p = player.pos;
    const t = this.points[this.idx];
    if (player.car && distance2d(p.x, p.z, t.x, t.z) < 9) {
      this.idx++;
      this.timeLeft += 14;
      if (this.idx >= this.points.length) {
        this.active = false;
        this.state.cash += this.prize;
        this.state.respect += 6;
        this.state.sideDone = (this.state.sideDone || 0) + 1;
        return 'done';
      }
      return 'checkpoint';
    }
    return null;
  }
}
