# Teluk Kirana: Heat Season

![Bounty](https://make.fun/badge/gta6-01.svg)
![Rank](https://make.fun/badge/gta6-01/lucky-wren-78/teluk-kirana/rank.svg)
![Reward](https://make.fun/badge/gta6-01/lucky-wren-78/teluk-kirana/reward.svg)

An original 3D open-world crime game set in a tropical Indonesian port city at
golden-hour dusk, built with three.js and plain static files — no build step,
no network requests. Play it by serving `game/` with any static server
(`node serve.ts`, then open http://localhost:8080).

Bounty: https://make.fun/bounty/gta6-01

## The city

Teluk Kirana is a procedurally built port city of five districts, each with its
own palette and building heights:

- **Pelabuhan Lama / Old Harbor** — pier, cranes, container stacks, boats
- **Pasar Raya / Grand Market** — dense mid-rise market blocks
- **Bukit Palma / Palm Heights** — tall pale towers
- **Pantai Kirana / Kirana Beach** — low golden beachfront blocks
- **Kawasan Galangan / Shipyard Flats** — industrial yards and warehouses

A 7×7 road grid with painted markings, sidewalks, palm-lined avenues, street
lamps, glowing windows, drifting clouds, warm fog and a low sun over the water.

## Features

- **6 story jobs** in sequence, each with opening dialogue and a distinct
  objective: deliver a car, a timed spice-package run, escaping a 3-star
  manhunt, a passenger ride to the beach, chasing down a runaway truck, and a
  finale cargo run under the police helicopter. Rewards pay cash and respect.
- **5-star wanted system**: police cars chase and ram with flashing light
  bars; at 3 stars a helicopter joins with a tracking spotlight. Heat cools
  when you break line of sight; get surrounded on foot and you are busted.
- **Traffic and pedestrians**: cars loop the grid and brake for each other,
  pedestrians stroll the sidewalks and flee from gunfire and fast cars.
- **Carjacking**: any car can be taken with E — parked or with its driver
  inside, who bails out and runs.
- **Combat**: a hitscan pistol with muzzle flash and tracers; police return
  fire at high wanted levels; death or arrest means hospital fines.
- **3 radio stations** synthesized live with WebAudio (tropical chill,
  synthwave, dangdut-style percussion) plus engine, horn, siren, crash,
  gunshot and helicopter sound effects. Press R while driving to switch.
- **Side activities**: repeatable taxi fares (T) and a checkpoint street
  race (G).
- **Saves**: cash, respect, finished jobs and position persist in
  localStorage, with autosave and a reset option on the start screen.
- **HUD**: health and arrest bars, wanted stars, cash/respect, speedometer,
  radio readout, objective banner, dialog box and a live 2D minimap showing
  roads, traffic, police, the player and the objective marker.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse (click to lock) | Camera |
| Shift | Sprint |
| E | Enter / exit car, advance dialog |
| F or click | Fire pistol |
| R | Change radio station (in car) |
| H | Horn |
| J | Start next story job |
| T | Taxi fare |
| G | Street race |
| P | Pause |

## Screenshots

The four screenshots in `screenshots/` are real renders of the game taken by
`shoot.mjs`, which drives the game's deterministic `?shot=` scenes
(cover chase, city overview, on-foot dialog, harbor at dusk) in headless
Chromium at 1280×720.

## Layout

- `game/` — the playable static game (`index.html`, `style.css`, `src/*.js`
  modules, vendored three.js under `game/vendor/`)
- `main.ts` — packages `game/` + `screenshots/` into the output dossier
- `serve.ts` — local static server for playing
- `shoot.mjs` — screenshot script
- `shots.json` — the screenshot scene list

## License

MIT — see `LICENSE`.
