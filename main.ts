// Teluk Kirana: Heat Season — handover program (Node 22, standard library only).
//
// What this file does, in plain words: it takes the finished game that lives in
// the game/ folder next to it, plus the four screenshots in screenshots/, copies
// both into the output directory, and then asks the vendored make.fun library to
// summarise that output into dossier.json — the single document the judges read.
//
// Two promises this plumbing keeps:
//   1. Determinism. Nothing here consults the clock or a random source, so two
//      runs over the same tree produce byte-identical dossier.json files.
//   2. Early refusal. The caps handed to buildDossier mirror the competition
//      gate, so an entry the scorer would reject fails here first, loudly.
//
// Run it the way the grader does (writes to /output), or locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Resolve everything relative to this file, never to the caller's cwd, so the
// program behaves identically no matter where it is launched from.
const entryDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Stage the payload: game tree first, then the screenshot set beside it.
mkdirSync(outputDir, { recursive: true });
cpSync(join(entryDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(entryDir, 'screenshots'))) {
  cpSync(join(entryDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Gate numbers for gta6-01, spelled out once so a future edit touches one place:
// the dossier text budget, at most four screenshots of at most 256 KiB each, and
// a game tree of at most 993 files / 48 MiB with no path longer than 1000 bytes.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

const dossierBytes = buildDossier(outputDir, GATE_CAPS);
writeFileSync(join(outputDir, 'dossier.json'), dossierBytes);

console.log(`Teluk Kirana handed in: dossier.json is ${dossierBytes.length} bytes in ${outputDir}`);
