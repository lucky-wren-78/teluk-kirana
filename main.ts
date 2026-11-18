// Teluk Kirana v4 — entrypoint for make.fun gta6-01 (Node 22, stdlib only).
// Hands the game in: copies game/ and screenshots/ beside this file into
// /output (or $MAKEFUN_OUTPUT_DIR outside the grader) and writes the
// dossier.json the judge reads, built with the kit's vendored library.
// Deterministic: same inputs, byte-identical dossier on every run.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//   node serve.ts            # play it at http://localhost:8080
//   node shoot.mjs           # re-render the four screenshots

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The four screenshots the dossier covers: exactly the shots.json list.
const shotNames = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8')).map((s) => s.name);
for (const name of shotNames) {
  const p = join(here, 'screenshots', name);
  if (!existsSync(p) || !statSync(p).isFile()) throw new Error(`missing screenshot: screenshots/${name}`);
  if (statSync(p).size > 262144) throw new Error(`screenshot over 256 KiB: screenshots/${name}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the rest refuse an entry the scorer would refuse.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

const dossierBytes = statSync(join(out, 'dossier.json')).size;
const gameFiles = readdirSync(join(out, 'game'), { recursive: true }).length;
console.log(`dossier.json: ${dossierBytes} bytes, game/ entries: ${gameFiles}, screenshots: ${shotNames.length}`);
