// jobs.js — the story of Heat Season: eight jobs with dialogue, told in
// order, plus two repeatable side activities (taxi fares and street races).
//
// Every job is a chain of stages: talk to someone, drive or walk to a marked
// place, sometimes with the heat rising. Finishing pays cash and respect and
// unlocks the next job. All characters are invented for this game.

export const STORY_JOBS = [
  {
    id: 'crate-run', title: 'Job 1 — The Harbourmaster\u2019s Crate',
    giver: 'Kapten Rudi Hartono', giverPos: { x: 158, z: 52 },
    dialogue: [
      ['Kapten Rudi', 'Kira. One crate, no questions. It fell off a manifest, not a ship.'],
      ['Kira', 'Everything falls somewhere with you, Kapten. Where to?'],
      ['Kapten Rudi', 'Bengkel Sari at the market. And Kira — the harbour patrol is bored today. Drive bored too.'],
    ],
    objective: 'Deliver the crate to Bengkel Sari in Pasar',
    target: { x: -44, z: 22 }, pay: 150, respect: 6, heatOnStart: 0,
    outro: [['Sari', 'Rudi\u2019s crate. Heavier than his promises. Tell him the motor on pier three still rattles.']],
  },
  {
    id: 'market-debt', title: 'Job 2 — Pasar Ledger',
    giver: 'Ibu Lastri', giverPos: { x: -66, z: -30 },
    dialogue: [
      ['Ibu Lastri', 'The spice syndicate says I owe them. I owe nobody but the rain.'],
      ['Kira', 'You want me to carry a message, Ibu?'],
      ['Ibu Lastri', 'Carry this ledger to the old town notary. Paper beats muscle, if it arrives.'],
    ],
    objective: 'Take the ledger to the Kota Tua notary',
    target: { x: 66, z: -66 }, pay: 170, respect: 7, heatOnStart: 0,
    outro: [['Notary Pello', 'Stamped and witnessed. The syndicate can queue like everyone else.']],
  },
  {
    id: 'hill-medicine', title: 'Job 3 — Medicine for Bukit',
    giver: 'Dokter Amara', giverPos: { x: -110, z: -110 },
    dialogue: [
      ['Dokter Amara', 'The clinic fridge died at noon. This cooler is the last cold medicine on the hill.'],
      ['Kira', 'Then I drive like the ice is melting. Because it is.'],
      ['Dokter Amara', 'Ninety seconds of grace, Kira. Go.'],
    ],
    objective: 'Rush the cooler to the Pantai pharmacy',
    target: { x: 22, z: 154 }, pay: 210, respect: 9, heatOnStart: 0, timeLimit: 150,
    outro: [['Pharmacist Bima', 'Still cold. You just saved the hill clinic a very bad week.']],
  },
  {
    id: 'borrowed-sedan', title: 'Job 4 — A Borrowed Sedan',
    giver: 'Sari the Mechanic', giverPos: { x: -44, z: 22 },
    dialogue: [
      ['Sari', 'A customer left a sedan. A different customer wants it gone. You see my problem.'],
      ['Kira', 'I see a car with no owner and a city full of police.'],
      ['Sari', 'Then be quick and be boring. Chop yard by the south shore. No scratches I can\u2019t buff out.'],
    ],
    objective: 'Deliver the borrowed sedan to the Pantai chop yard (enter any car first)',
    target: { x: -22, z: 176 }, pay: 260, respect: 10, heatOnStart: 12, needsVehicle: true,
    outro: [['Yard Boss Olin', 'Clean work. Sari always sends the careful ones.']],
  },
  {
    id: 'night-ferry', title: 'Job 5 — The Night Ferry Manifest',
    giver: 'Kapten Rudi Hartono', giverPos: { x: 158, z: 52 },
    dialogue: [
      ['Kapten Rudi', 'The night ferry carries a manifest that must not reach the morning ferry.'],
      ['Kira', 'You want me to race a boat on land, Kapten.'],
      ['Kapten Rudi', 'I want the manifest at the lighthouse depot before the patrol shift changes. Same thing.'],
    ],
    objective: 'Beat the shift change: reach the Bukit depot fast',
    target: { x: -154, z: -154 }, pay: 320, respect: 12, heatOnStart: 18, timeLimit: 170,
    outro: [['Depot Keeper Nia', 'Manifest received, questions unasked. Rudi owes you twice now.']],
  },
  {
    id: 'syndicate-parley', title: 'Job 6 — Parley at the Pier',
    giver: 'Ibu Lastri', giverPos: { x: -66, z: -30 },
    dialogue: [
      ['Ibu Lastri', 'The syndicate agreed to talk. At pier nine. At dusk. Bring your calm face.'],
      ['Kira', 'And if the talk goes loud?'],
      ['Ibu Lastri', 'Then run, courier. Running is also a kind of talking.'],
    ],
    objective: 'Meet the syndicate at pier nine (harbour, east pier)',
    target: { x: 196, z: 22 }, pay: 300, respect: 12, heatOnStart: 26,
    outro: [['Syndicate Envoy Voss', 'Lastri\u2019s debt is settled — in writing. You have interesting friends, courier.']],
  },
  {
    id: 'storm-cargo', title: 'Job 7 — Storm Cargo',
    giver: 'Dokter Amara', giverPos: { x: -110, z: -110 },
    dialogue: [
      ['Dokter Amara', 'A storm shipment washed to the wrong warehouse — Kota Tua, by the notary.'],
      ['Kira', 'Generators? Medicine?'],
      ['Dokter Amara', 'Both. And every patrol in the city is watching the roads tonight. I\u2019m sorry, Kira.'],
    ],
    objective: 'Collect the storm cargo from Kota Tua and bring it back to the Bukit clinic',
    target: { x: 66, z: -44 }, pay: 380, respect: 14, heatOnStart: 30, returnToGiver: true,
    outro: [['Dokter Amara', 'The hill will sleep warm tonight. So will I. Thank you.']],
  },
  {
    id: 'heat-season', title: 'Job 8 — Heat Season',
    giver: 'Kapten Rudi Hartono', giverPos: { x: 158, z: 52 },
    dialogue: [
      ['Kapten Rudi', 'Last one, Kira. Your debt paper. It\u2019s in the harbour office safe — tonight it moves to the bank in Kota Tua.'],
      ['Kira', 'If I reach the bank first, I\u2019m free.'],
      ['Kapten Rudi', 'If you reach it at all, you\u2019re legend. The whole city will be watching. Go loud, courier.'],
    ],
    objective: 'Intercept your debt paper: reach the Kota Tua bank',
    target: { x: 88, z: -88 }, pay: 600, respect: 25, heatOnStart: 42,
    outro: [
      ['Kira', 'Paper in hand. Debt: zero. Teluk Kirana, you beautiful furnace — I\u2019m staying.'],
      ['Kapten Rudi', 'Heat Season is over, courier. The harbour is yours now.'],
    ],
  },
];

export const SIDE_ACTIVITIES = {
  taxi: {
    title: 'Taxi Fare',
    blurb: 'Pick up the marked passenger, drop them at the glowing drop-off.',
  },
  race: {
    title: 'Street Race — Harbour Loop',
    blurb: 'Three checkpoints around the harbour and old town. Beat the clock.',
    checkpoints: [
      { x: 154, z: -66 }, { x: 66, z: -110 }, { x: 110, z: 22 },
    ],
    parTime: 95,
  },
};

// The job manager: a small state machine the orchestrator ticks each frame.
export class JobManager {
  constructor(hooks) {
    this.hooks = hooks; // { notify, startDialogue(lines, done), addCash, addRespect, addHeat, save }
    this.storyIndex = 0;         // next story job to offer
    this.active = null;          // { job, stage: 'go'|'return', deadline|null }
    this.sideActive = null;      // taxi / race runtime state
    this.completedStory = [];
  }

  get nextGiver() {
    const job = STORY_JOBS[this.storyIndex];
    return job ? { job, pos: job.giverPos, name: job.giver } : null;
  }

  get finished() { return this.storyIndex >= STORY_JOBS.length; }

  startStoryJob() {
    const job = STORY_JOBS[this.storyIndex];
    if (!job || this.active) return;
    this.hooks.startDialogue(job.dialogue, () => {
      this.active = { job, stage: 'go', deadline: job.timeLimit ? this.hooks.now() + job.timeLimit : null };
      if (job.heatOnStart) this.hooks.addHeat(job.heatOnStart);
      this.hooks.notify(`${job.title}: ${job.objective}`);
      this.hooks.save();
    });
  }

  // Returns the current world-space objective marker, if any.
  currentObjective() {
    if (this.active) {
      const { job, stage } = this.active;
      if (stage === 'return') return { x: job.giverPos.x, z: job.giverPos.z, label: `Return to ${job.giver}` };
      return { x: job.target.x, z: job.target.z, label: job.objective };
    }
    if (this.sideActive?.kind === 'taxi') {
      const s = this.sideActive;
      return s.pickedUp
        ? { x: s.drop.x, z: s.drop.z, label: 'Drop off your passenger' }
        : { x: s.pick.x, z: s.pick.z, label: 'Pick up the passenger' };
    }
    if (this.sideActive?.kind === 'race') {
      const cp = SIDE_ACTIVITIES.race.checkpoints[this.sideActive.next];
      if (cp) return { x: cp.x, z: cp.z, label: `Checkpoint ${this.sideActive.next + 1} of ${SIDE_ACTIVITIES.race.checkpoints.length}` };
    }
    return null;
  }

  // Called when the player steps into the objective marker.
  reachObjective(playerInVehicle) {
    if (this.active) {
      const { job } = this.active;
      if (job.needsVehicle && !playerInVehicle) {
        this.hooks.notify('You need to arrive in a vehicle for this job.');
        return;
      }
      if (this.active.stage === 'go' && job.returnToGiver) {
        this.active.stage = 'return';
        this.active.deadline = null;
        this.hooks.notify('Cargo collected. Take it back to the giver.');
        return;
      }
      this.completeStoryJob();
      return;
    }
    if (this.sideActive?.kind === 'taxi') {
      const s = this.sideActive;
      if (!s.pickedUp) {
        s.pickedUp = true;
        this.hooks.notify('Passenger aboard. Mind the corners.');
      } else {
        const fare = Math.round(s.fare);
        this.hooks.addCash(fare);
        this.hooks.addRespect(2);
        this.hooks.notify(`Fare paid: $${fare}.`);
        this.sideActive = null;
        this.hooks.save();
      }
      return;
    }
    if (this.sideActive?.kind === 'race') {
      const s = this.sideActive;
      s.next += 1;
      if (s.next >= SIDE_ACTIVITIES.race.checkpoints.length) {
        const elapsed = this.hooks.now() - s.startedAt;
        if (elapsed <= SIDE_ACTIVITIES.race.parTime) {
          this.hooks.addCash(220);
          this.hooks.addRespect(8);
          this.hooks.notify(`Race won in ${Math.round(elapsed)}s! Prize $220.`);
        } else {
          this.hooks.notify(`Race finished in ${Math.round(elapsed)}s — over par. No prize.`);
        }
        this.sideActive = null;
        this.hooks.save();
      } else {
        this.hooks.notify(`Checkpoint ${s.next} cleared.`);
      }
    }
  }

  completeStoryJob() {
    const { job } = this.active;
    this.active = null;
    this.storyIndex += 1;
    this.completedStory.push(job.id);
    this.hooks.startDialogue(job.outro, () => {});
    this.hooks.addCash(job.pay);
    this.hooks.addRespect(job.respect);
    this.hooks.notify(`${job.title} complete: +$${job.pay}, +${job.respect} respect.`);
    if (this.finished) this.hooks.notify('STORY COMPLETE — Heat Season survived. Free roam is yours.');
    this.hooks.save();
  }

  // Timers: fail a timed job whose clock ran out (it can be retaken).
  update() {
    if (this.active?.deadline && this.hooks.now() > this.active.deadline) {
      const title = this.active.job.title;
      this.active = null;
      this.hooks.notify(`${title} failed — too slow. Talk to the giver to retry.`);
    }
  }

  startTaxi(rng, playerPos) {
    if (this.sideActive || this.active) return false;
    const pick = { x: Math.round(playerPos.x + rng.range(-70, 70)), z: Math.round(playerPos.z + rng.range(-70, 70)) };
    const drop = { x: Math.round(pick.x + rng.range(-120, 120)), z: Math.round(pick.z + rng.range(-120, 120)) };
    const dist = Math.hypot(drop.x - pick.x, drop.z - pick.z);
    this.sideActive = { kind: 'taxi', pick, drop, pickedUp: false, fare: 18 + dist * 0.09 };
    this.hooks.notify('Taxi fare: pick up the passenger at the gold marker.');
    return true;
  }

  startRace() {
    if (this.sideActive || this.active) return false;
    this.sideActive = { kind: 'race', next: 0, startedAt: this.hooks.now() };
    this.hooks.notify('Street race started — hit every checkpoint before par time!');
    this.hooks.addHeat(8);
    return true;
  }

  restore(saved) {
    if (!saved) return;
    this.storyIndex = Math.min(saved.storyIndex || 0, STORY_JOBS.length);
    this.completedStory = saved.completedStory || [];
  }

  snapshot() {
    return { storyIndex: this.storyIndex, completedStory: this.completedStory };
  }
}
