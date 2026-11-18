# Teluk Kirana: Heat Season

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/lucky-wren-78/teluk-kirana/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/lucky-wren-78/teluk-kirana/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the browser — a tropical port city, built
for the [make.fun gta6-01 bounty](https://make.fun/c/gta6-01). No Rockstar
assets, names, or map: Teluk Kirana, its people, its jobs, and its radio
stations are all invented here.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/index.html` runs from static files
(three.js r160 is vendored under `game/vendor/`).

## The game

- **A living port city** — 5 districts (Pelabuhan, Pasar Lama, Kota Tua,
  Marina, Bukit Kirana), a road grid, a harbour bridge, market stalls,
  cranes, containers, palms and a marina.
- **8 story jobs with dialogue** — from Bu Ratna's fish delivery to the
  "Heat Season" finale — plus taxi fares and street races.
- **Drive anything** — cars and motorbikes (with lean), traffic AI,
  pedestrians, carjacking with `E`.
- **5-star wanted system** — police cars chase you, a helicopter with a
  searchlight joins at 3★, roadblocks and spike strips at 4–5★.
- **Day–night cycle and rain** — street lamps and headlights come on after
  dark; showers roll in and out.
- **Combat, HUD, radio, saves** — pistol combat, a HUD with a realtime
  minimap, 3 synth radio stations (WebAudio, no audio files), and a
  localStorage save (`H` to save, continue from the start screen).
- **Screenshot mode** — `?shot=1-bridge-bike-dusk`,
  `?shot=2-market-noon`, `?shot=3-roadblock-rain-night`,
  `?shot=4-harbor-sunrise-heli` stage the four cover shots.

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Walk / drive |
| Shift | Run |
| E | Enter or steal a vehicle · advance dialogue · exit vehicle |
| F / click | Fire pistol |
| Q | Change radio station |
| R | Radio on/off |
| H | Save game |
| 1–8 | Start a story job |
| Mouse drag | Orbit camera |

## Structure

```
game/
  index.html            page + HUD + start screen
  style.css             HUD and menu styling
  src/config.js         tuning, spawn points, districts
  src/rng.js            seeded RNG (deterministic city)
  src/city.js           procedural city, colliders, lamps
  src/vehicles.js       cars, motorbikes, traffic AI
  src/player.js         on-foot movement, enter/exit
  src/pedestrians.js    wandering citizens
  src/police.js         wanted levels, helicopter, roadblocks
  src/jobs.js           8 story jobs, taxi, street race
  src/combat.js         pistol, raycast, tracer
  src/audio.js          synth radio + SFX (WebAudio)
  src/hud.js            HUD, minimap, dialogue
  src/save.js           localStorage save/load
  src/main.js           fixed-step loop, camera, day/night, shots
  vendor/three.module.min.js   three.js r160 (vendored)
main.ts                 entry program — writes /output + dossier.json
serve.ts                local static server
shoot.mjs               Playwright screenshot runner
shots.json              the four staged screenshots
```

## Screenshots

Taken by `node shoot.mjs` from the game's own code in headless Chromium:

1. `1-bridge-bike-dusk.jpg` — motorbike chase across the bridge at dusk
2. `2-market-noon.jpg` — Pasar Lama market square at noon, from above
3. `3-roadblock-rain-night.jpg` — police roadblock in the night rain
4. `4-harbor-sunrise-heli.jpg` — the harbour at sunrise under the helicopter

## License

MIT — see [LICENSE](LICENSE).
