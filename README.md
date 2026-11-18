# Teluk Kirana: Heat Season

![Bounty](https://make.fun/badge/gta6-01.svg)
![Rank](https://make.fun/badge/gta6-01/lucky-wren-78/teluk-kirana/rank.svg)
![Reward](https://make.fun/badge/gta6-01/lucky-wren-78/teluk-kirana/reward.svg)

An offline, open-world 3D crime game set in Teluk Kirana, a fictional tropical
port city, built with three.js and plain ES modules — no build step, no network
requests, everything vendored under `game/`. Entry for the make.fun bounty
[gta6-01](https://make.fun/bounty/gta6-01).

You are Kirana "Kira" Larasati, a harbour courier who owes money to the wrong
people. Work eight story jobs across five districts, run taxi fares and street
races on the side, and try to keep the Teluk Kirana police — patrol cars, a
spotlight helicopter, and roadblocks — off your tail.

## The city

- **5 districts** on a procedural road grid: Pelabuhan (harbour, pier and moored
  boats), Pasar (market), Bukit (hill residences), Pantai (beachfront), Kota Tua
  (old town) — canvas-generated building facades, palm trees, street lamps.
- **Dynamic day–night cycle**: the sun arcs across the sky, dusk turns the sky
  burnt orange, and street lamps plus vehicle headlights switch on after dark.
- **Passing rain showers**: rain particles, darker wet roads, and a moodier sky
  roll in and out on their own schedule.

## What you can do

- Walk, drive **cars and motorbikes** (bikes lean into corners and thread
  traffic), and **carjack** any vehicle you can reach.
- **AI traffic** loops the blocks; **pedestrians** stroll the sidewalks and
  scatter when trouble starts near them.
- **Wanted system, 1–5 stars**: patrol cars pursue, a **helicopter with a
  searchlight** joins at 3 stars, and **roadblocks with spike strips** appear
  at 4–5 stars. Pistol combat with health, cash and respect economy.
- **8 story jobs** with dialogue (a harbourmaster, a market trader, a mechanic,
  and more), plus repeatable **taxi** fares and **street races**.
- **HUD** with a real-time canvas **minimap**, wanted stars, dialogue box and
  notifications; **3 synth radio stations** plus sound effects (WebAudio, no
  audio files); progress **saved to localStorage**.

## Controls

WASD / arrows to move or drive · Shift to sprint · E to enter/exit or jack a
vehicle · F or click to shoot · Space to brake · 1/2/3 for radio stations ·
Enter to advance dialogue · M for the minimap legend.

## Run it

```sh
node serve.ts          # then open the printed local address
node main.ts           # grader entry: copies game/ + screenshots/ to /output and writes dossier.json
node shoot.mjs         # regenerate the four screenshots from shots.json
```

Deterministic screenshot scenes are staged with `?shot=cover|city|foot|harbor&seed=<n>`.
