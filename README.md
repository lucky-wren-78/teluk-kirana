# Teluk Kirana: Heat Season

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/lucky-wren-78/teluk-kirana/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/lucky-wren-78/teluk-kirana/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Teluk Kirana: Heat Season** is an original open-world crime game that runs
entirely in the browser. One tropical port city, eight story jobs, a five-star
wanted system, and a long hot season to survive. It was built from scratch for
the [make.fun gta6-01 bounty](https://make.fun/c/gta6-01) — the city, its
people, its jobs and its radio stations are all invented for this entry; no
commercial game's assets, names or maps are used.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

There is no build step and nothing is fetched from the network: open
`game/index.html` from any static server and play. three.js r160 is vendored
under `game/vendor/`, and every sound is synthesized live with WebAudio.

## The city

Teluk Kirana is a procedural port city on a 44-unit road grid — the same seed
grows the same streets every load:

- **Pelabuhan** — the harbour: container stacks, gantry cranes, a pier,
  moored boats, buoys, and the flat red-railed bridge across the channel.
- **Pasar Lama** — the old market: fourteen stalls with striped awnings and
  goods crates, string lights over the plaza, crowds all day.
- **Kota Tua** — the old town: pale colonial blocks, neon signs, tight streets.
- **Marina** — a sheltered basin full of masted boats on the south-west shore.
- **Bukit Kirana** — the hill district: the tallest towers in the city, one
  of them capped with a helipad.

Buildings carry lit windows, water tanks, AC units and antennas; palms,
benches, lamps and crates fill the sidewalks. A full day–night cycle turns
the lamps and neon on after dark, and rain showers roll through whenever
they please.

## What you do

- **8 story jobs with dialogue** — deliver Bu Ratna's fish, run the nameless
  package, collect the salon debt, outrun the bridge raid, find container
  412, beat Raka's street race, expose the harbour mole, and drive the
  finale: one last delivery at maximum heat. Taxi fares and checkpoint
  races fill the gaps between jobs.
- **Drive anything** — sedans, hatchbacks, pickups, vans, taxis and two
  motorbikes that lean into corners. Traffic loops the grid, pedestrians
  stroll (and scatter from gunfire), and any parked or moving vehicle can
  be taken with `E` — the police will have opinions about that.
- **Five-star wanted system** — patrol cars hunt you from the first star,
  a helicopter with a real searchlight joins at three, and at four to five
  stars the road ahead fills with striped roadblocks and spike strips.
- **Combat and consequences** — a raycast pistol with tracers and muzzle
  flash; getting cornered on foot gets you busted and fined.
- **A living HUD** — cash, wanted stars, health, ammo, clock, district
  banner, job tracker and a realtime minimap with traffic, police and the
  helicopter on it.
- **Synth radio** — three stations (Kirana FM pop, Ombak reggae, Jalan Raya
  rock) generated note-by-note with WebAudio, plus engine and siren loops.
  `Q` changes station, `R` toggles, `M` mutes.
- **Save and continue** — progress (cash, finished jobs, time of day) is
  kept in localStorage; press `H` to save and continue from the start
  screen next visit.

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrow keys | Walk / drive |
| Shift | Run |
| E | Enter or leave a vehicle · advance dialogue |
| F / mouse click | Fire pistol |
| Q | Next radio station |
| R | Radio on/off |
| M | Mute / unmute |
| H | Save game |
| Esc | Pause |
| 1–8 | Start a story job |
| Mouse drag | Orbit the camera |

## Under the hood

- **Fixed-step simulation** — the world advances in 1/60 s steps from an
  accumulator, so physics is frame-rate independent; rendering consumes
  however many steps are due.
- **Instanced rendering** — buildings, windows, roof clutter, palms, lamps,
  stalls and containers are InstancedMeshes: the whole city is a few dozen
  draw calls and stays smooth even on software GL.
- **Camera that respects walls** — the chase camera is resolved against
  building AABBs every frame, so it never clips inside a wall.
- **One spotlight rule** — only the vehicle you drive carries a real
  headlight, and the city's point lights join the scene only after dark;
  twenty always-on lights would tax every fragment for nothing.
- **Deterministic screenshot mode** — `?shot=<id>` freezes the clock,
  weather and helicopter, stages extra traffic and a crowd around the
  subject, and starts a story job, so every cover shot below shows the
  real game with its HUD up. The four shots are defined in `shots.json`
  and rendered by `shoot.mjs` in headless Chromium.

## Screenshots

Rendered by `node shoot.mjs` from the game's own code (1280×720):

1. `1-dusk-bridge-pursuit.jpg` — a motorbike chase across the harbour
   bridge at golden dusk, police on the rider's tail, skyline behind.
2. `2-market-rush-noon.jpg` — Pasar Lama at noon: stalls, crowds, and
   traffic threading through the market streets.
3. `3-rain-roadblock-stand.jpg` — a five-star roadblock in the night
   rain: barriers, spike strips, headlights on wet asphalt.
4. `4-harbor-sunrise-run.jpg` — sunrise on the quay: the helicopter's
   searchlight over the water, the bridge span, and an early-red sedan.

## Layout

```
game/
  index.html        page, HUD, start & pause screens
  style.css         HUD and menu styling
  src/config.js     tuning, spawn points, districts, stations
  src/rng.js        seeded RNG — the same city every load
  src/city.js       procedural city, colliders, harbour, market
  src/vehicles.js   cars, motorbikes, traffic AI
  src/player.js     on-foot movement, entering vehicles
  src/pedestrians.js citizens, crowds, fleeing
  src/police.js     wanted levels, helicopter, roadblocks, spikes
  src/jobs.js       8 story jobs, taxi fares, street races
  src/combat.js     pistol, raycast, tracer, muzzle flash
  src/audio.js      synth radio + SFX (WebAudio, no audio files)
  src/hud.js        HUD and the realtime minimap
  src/save.js       localStorage save / load
  src/main.js       fixed-step loop, camera, day/night, shot mode
  vendor/           three.js r160 (vendored, minified)
main.ts             hand-in program — copies the game out, writes dossier.json
serve.ts            tiny static server for local play (port 8080)
shoot.mjs           Playwright renderer for the four cover shots
shots.json          the four staged shots
```

## License

MIT — see [LICENSE](LICENSE).
