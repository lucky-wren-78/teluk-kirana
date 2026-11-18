# TELUK KIRANA: Heat Season

[![make.fun bounty: gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Teluk Kirana rank on make.fun](https://make.fun/badge/gta6-01/lucky-wren-78/teluk-kirana/rank.svg)](https://make.fun/c/gta6-01)
[![Teluk Kirana reward on make.fun](https://make.fun/badge/gta6-01/lucky-wren-78/teluk-kirana/reward.svg)](https://make.fun/c/gta6-01)

An entry for the make.fun bounty [gta6-01](https://make.fun/c/gta6-01): a 3D
open-world crime game in a fictional tropical island port, built with three.js
and played offline in a desktop browser from static files.

**6 story jobs · 5-star wanted system with helicopter pursuit · drivable
traffic & carjacking · district reputation · 3-station synth radio · saves**

## The game

Teluk Kirana is an island port at golden hour: downtown glass towers, the
old town, palm-roofed Bukit Palem, and the container harbour with its cranes.
You are the new driver Sari the harbour fixer keeps hearing about. Run her
jobs, build your name district by district, and stay ahead of the Patroli.

- **Open world on foot and by car** — a 9×9 street grid with traffic AI,
  pedestrians, parked cars and a south pier, all grown from a seed.
- **Carjacking** — take any parked car or pull a driver out of traffic. The
  city notices.
- **5-star wanted system** — heat rises with every crime and cools when you
  behave; police cars hunt and ram, and from four stars a helicopter orbits
  with a spotlight. Get boxed in and you are busted.
- **6 story jobs** — Sari and Bimo send you across the island: a first
  delivery, a repossessed Comet GT (and a pistol), three unmarked crates, a
  singer who hates being late, a bank vault, and a finale checkpoint run to
  Sari's boat. Plus a repeatable beach-road street race.
- **District reputation** — finishing jobs raises your standing where the
  work happened.
- **HUD + minimap** — wallet, respect, wanted stars, health, objective line,
  dialogue, and a live canvas minimap with traffic, police and the objective
  beacon.
- **Radio & sound** — three procedural WebAudio radio stations, engine hum,
  siren, and effects. No audio files.
- **Saves** — money, respect, story progress and unlocks persist in
  localStorage.

Everything is original: the city, the people and the stories are invented.
No assets, names, characters or music from any commercial game.

## How to play

Serve the game locally and open it in a desktop browser:

```bash
node serve.ts
# open http://localhost:8080
```

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot · drive |
| E | Enter / exit car (carjack) |
| F | Punch · shoot (click, once the pistol is unlocked) |
| Shift | Sprint |
| Space | Handbrake |
| R | Cycle radio station |
| P / Esc | Pause |

Screenshots are posed by the game itself: open `?shot=1` … `?shot=4` (with
`&seed=7&quality=high` for the entry frames) for the four programmed scenes.
`node shoot.mjs` runs the smoke test and regenerates `screenshots/`.

## Layout

- `game/` — the game itself: `index.html`, `style.css`, `src/` (one module
  per system: `config`, `world`, `vehicles`, `police`, `missions`, `hud`,
  `audio`, `player`, `pedestrians`, `combat`, `save`, `shots`, `main`) and
  `vendor/three.module.min.js` (vendored three.js).
- `main.ts` — the entry program (Node 22, stdlib only): copies `game/` and
  `screenshots/` to `/output` and writes `dossier.json`. Run it twice and
  the bytes are identical.
- `serve.ts` — a tiny static server for local play.
- `shoot.mjs` — the repo's play-test + screenshot tool.
- `shots.json` — the four programmed screenshot poses.
- `screenshots/` — the entry screenshots (cover first).

## License

MIT — see `LICENSE`.
