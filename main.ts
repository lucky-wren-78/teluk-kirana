// Teluk Kirana: Heat Season - make.fun gta6-01 entry program.
// This file is the hand-in plumbing for the game: it copies the
// static game/ folder and the screenshots/ folder next to it into
// the output directory, then writes dossier.json there using the
// vendored buildDossier helper from the kit. The game itself is a
// 3D open-world crime game set in a tropical port city at dusk:
// five districts, six story jobs, traffic, carjacking, a five-star
// wanted system with a police helicopter, synthesized radio and
// localStorage saves. It runs from plain static files with no
// build step; this program only packages it, deterministically,
// so two runs produce byte-identical output.
//
// Usage outside the grader: MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output folders for the game and its screenshots.
mkdirSync(join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });

// Copy the playable game exactly as it sits in the repository.
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });

// Copy the screenshots the entry is judged by (cover first by name).
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Write the dossier with the same caps the gate applies: the source
// text cap, at most four screenshots of at most 256 KiB each, and
// the game folder limits of 993 entries, 48 MiB and 1000-byte paths.
const dossierText = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierText);
