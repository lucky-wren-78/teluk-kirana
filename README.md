![gta6-01](https://make.fun/badge/gta6-01.svg)
![Teluk Kirana rank](https://make.fun/badge/gta6-01/lucky-wren-78/teluk-kirana/rank.svg)
![Teluk Kirana reward](https://make.fun/badge/gta6-01/lucky-wren-78/teluk-kirana/reward.svg)

# Teluk Kirana: Heat Season

An open-world crime game in a procedural tropical port city, built for the
[make.fun gta6-01 competition](https://make.fun/c/gta6-01/). Explore five
districts on foot, by car, or by motorbike; take story jobs from Pak Darma,
Raka and Bu Lastri; dodge a five-star police force with a helicopter,
roadblocks and spike strips.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

WASD move / drive · Mouse look · Click shoot · E enter / exit vehicle ·
R reload · Q radio · J start job · T taxi fares · G street race · P pause ·
M mute. Progress saves to localStorage; the start screen offers Continue.

## The city

- **5 districts**: Pelabuhan (harbour, cranes, docks, boats), Pasar Ikan
  (market stalls), Pusat Kota (downtown towers), Perumahan, Pinggiran.
- **Traffic AI** on road loops, pedestrians on the sidewalks, carjacking.
- **5-star wanted system**: patrols, chases, helicopter spotlight from 3
  stars, roadblocks + spike strips at 4–5 stars.
- **8 story jobs** with dialogue and a beacon objective, plus taxi fares
  and a timed street race.
- **Dynamic day–night cycle** (street lamps and headlights after dark) and
  occasional **rain showers** with sound.
- **3 synth radio stations** + WebAudio SFX (engine, gunshots, sirens, rain).

## Tech

three.js r160 (vendored as `game/vendor/three.module.min.js`), plain ES
modules, no build step, no network at runtime — everything runs offline
from static files.

## Screenshots

Rendered by `node shoot.mjs` from `shots.json`:

1. `1-night-chase.jpg` — night rain chase in the harbour, 4 stars, helicopter overhead
2. `2-market.jpg` — morning in the fish market, on foot
3. `3-rain-harbor.jpg` — rain over the harbour cranes, on the motorbike
4. `4-dawn.jpg` — dawn in downtown, on foot

## License

MIT — see [LICENSE](LICENSE).
