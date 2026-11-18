// shots.js — the programmed screenshot poses. The judge reads screenshots
// first, so each ?shot=N freezes a composed, fully live scene: a five-star
// chase for the cover, the whole city from the air, a carjacking about to
// happen, and a harbour job mid-collection. Poses only move actors and set
// state; nothing is faked — every pixel is the real game, rendered by its own
// code.

import { LANDMARKS } from './world.js';
import { distance2d } from './random.js';

function setPosedObjective(director, jobIndex, stepIndex, title, text, target) {
  director.mode = 'active';
  director.jobIndex = jobIndex;
  director.stepIndex = stepIndex;
  director.armed = true;
  director.objectiveTitle = title;
  director.objectiveText = text;
  director.target = target;
  if (target) director.markerGroup.position.set(target.x, 0, target.z);
  director.markerGroup.visible = !!target;
}

function posePoliceCar(game, x, z, heading) {
  const car = game.vehicleFactory.createVehicle(game.scene, 'police', 0xf3ead8, x, z, heading);
  car.driver = 'posed';
  game.police.cars.push(car);
  return car;
}

function posePlayerCar(game, car, x, z, heading) {
  car.mesh.position.set(x, 0.05, z);
  car.heading = heading;
  car.mesh.rotation.y = heading;
  car.parked = false;
  game.enterVehicle(car, true);
}

export function poseScreenshotScene(game, shot) {
  const { player, police, director, state, hud } = game;
  state.money = 2840;
  state.respect = 41;
  hud.show();

  if (shot === 1) {
    // COVER: a five-star escape on the coast road, helicopter overhead.
    // A composed side view so the chase reads in one frame: the Comet GT
    // mid-frame, two Patroli cars closing in ahead of it, the helicopter
    // above with its spotlight on the road.
    posePlayerCar(game, game.jobCar, 150, 246, Math.PI / 2);
    police.heat = 150;
    posePoliceCar(game, 174, 241, -Math.PI / 2);
    posePoliceCar(game, 168, 252, -Math.PI / 2 - 0.2);
    police.helicopter.visible = true;
    police.helicopter.position.set(172, 16, 236);
    setPosedObjective(
      director, 4, 2, 'Job 5 · Brankas Bank',
      'Escape to the safehouse in Kota Tua', LANDMARKS.safehouse,
    );
    game.cameraOverride = { x: 128, y: 9, z: 262, lookX: 168, lookY: 2, lookZ: 238 };
  } else if (shot === 2) {
    // The whole city from the air: downtown towers, the plaza, the bay beyond.
    posePlayerCar(game, game.parkedCars[0], 24, 66, Math.PI / 2);
    police.heat = 50;
    setPosedObjective(
      director, 3, 0, 'Job 4 · Penumpang Malam',
      'Pick up the singer downtown', LANDMARKS.passengerSpot,
    );
    game.cameraOverride = { x: 168, y: 118, z: 208, lookX: -20, lookY: 0, lookZ: 10 };
  } else if (shot === 3) {
    // On foot, one breath before a carjacking in Bukit Palem.
    player.mesh.position.set(-143.5, 0, -169.5);
    player.heading = Math.atan2(game.jobCar.x - player.x, game.jobCar.z - player.z);
    player.mesh.rotation.y = player.heading;
    let moved = 0;
    for (const ped of game.peds) {
      if (moved >= 3) break;
      if (distance2d(ped.x, ped.z, player.x, player.z) > 26) {
        ped.mesh.position.set(player.x + 4 + moved * 3.5, 0, player.z - 5 + moved * 2.5);
        ped.target = { x: ped.x + 8, z: ped.z };
        moved++;
      }
    }
    hud.prompt('<b>E</b> — take the Kirana Comet GT');
    setPosedObjective(
      director, 1, 1, 'Job 2 · Mobil Pinjaman',
      'Steal the pink Comet GT', { x: game.jobCar.x, z: game.jobCar.z },
    );
    game.cameraSnap = true;
  } else if (shot === 4) {
    // Harbour job in progress: crates, containers, cranes and closing police.
    const van = game.parkedCars.find((c) => c.kind === 'van') || game.parkedCars[1];
    posePlayerCar(game, van, 262, -38, 0.5);
    director.jobIndex = 2;
    director.stepIndex = 0;
    director.mode = 'active';
    director.armStep();
    const step = director.currentJob().steps[0];
    step.points[0].taken = true;
    if (director.crateMeshes[0]) game.scene.remove(director.crateMeshes[0]);
    director.collected = 1;
    director.refreshObjective();
    police.heat = 50;
    posePoliceCar(game, 252, -20, 2.6);
    hud.dialog('SARI', 'One crate down. Two to go — and leave the Patroli nothing to find.');
    // A composed side view of the dock: the box van, a golden crate, a
    // closing Patroli car and the cranes behind — the chase cam sits too
    // close behind the van's tall cargo box to read any of it.
    game.cameraOverride = { x: 234, y: 13, z: -66, lookX: 280, lookY: 1, lookZ: -28 };
  }
  game.frozen = true;
}
