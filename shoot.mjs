// shoot.mjs — Teluk Kirana's own play-test + screenshot tool (Node 22, no
// deps of its own: it borrows the Playwright install kept beside this
// workspace's other make.fun tooling). It serves game/ locally, smoke-tests
// the real game in headless Chromium (start screen, walking, entering a car,
// driving), then takes the four entry screenshots from the game's programmed
// ?shot= poses, shrinking JPEG quality until each file fits the kit's 256 KiB
// cap.
//
//   node shoot.mjs            smoke test + screenshots into screenshots/
//   node shoot.mjs --test     smoke test only

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(REPO, '..', '..', 'tools-browser', 'package.json'));
const { chromium } = require('playwright');

const TEST_ONLY = process.argv.includes('--test');
const PORT = 8931;
const BASE = `http://127.0.0.1:${PORT}`;
const MAX_SHOT_BYTES = 262144;

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: 'pipe' });
await new Promise((resolve) => setTimeout(resolve, 900));

const report = { consoleErrors: [], pageErrors: [], checks: {}, shots: [] };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader'] });

async function newPage(viewport = { width: 1280, height: 720 }) {
  const page = await browser.newPage({ viewport });
  page.on('console', (m) => {
    if (m.type() === 'error') report.consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => report.pageErrors.push(String(e)));
  return page;
}

// Runs a Playwright wait and records a boolean instead of throwing.
async function tryWait(page, fn, arg, timeout, polling = 400) {
  try {
    await page.waitForFunction(fn, arg, { timeout, polling });
    return true;
  } catch {
    return false;
  }
}

try {
  // ---- Smoke test: the real game, played with real keys ------------------
  // Headless software GL renders this scene slowly, so the checks wait on
  // game state changes (positions, flags) rather than wall-clock durations.
  const page = await newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(
    () => window.__gameDebug && window.__gameDebug.framesRendered > 12,
    null, { timeout: 120000 },
  );
  report.checks.startScreenVisible = await page.isVisible('#start-screen');
  await page.click('#btn-new');
  await page.waitForFunction(() => window.__gameDebug.playing === true, null, { timeout: 30000 });
  const before = await page.evaluate(() => ({ px: window.__gameDebug.px, pz: window.__gameDebug.pz }));
  await page.keyboard.down('KeyW');
  report.checks.playerWalked = await tryWait(page, (start) => {
    const d = window.__gameDebug;
    return Math.hypot(d.px - start.px, d.pz - start.pz) > 2;
  }, before, 120000);
  await page.keyboard.up('KeyW');
  // Enter the nearest parked car through the game's own hook, then drive it.
  await page.evaluate(() => {
    const g = window.__game;
    const car = g.parkedCars[0];
    g.player.mesh.position.set(car.x + 2, 0, car.z + 2);
    g.enterVehicle(car, false);
  });
  report.checks.enteredCar = await tryWait(page, () => window.__gameDebug.inCar === true, null, 30000);
  const carStart = await page.evaluate(() => {
    const c = window.__game.parkedCars[0];
    return { x: c.x, z: c.z };
  });
  await page.keyboard.down('KeyW');
  let maxSpeed = 0;
  let drove = 0;
  const driveDeadline = Date.now() + 120000;
  while (Date.now() < driveDeadline) {
    const s = await page.evaluate(() => {
      const c = window.__game.parkedCars[0];
      return { x: c.x, z: c.z, speed: window.__gameDebug.carSpeed };
    });
    maxSpeed = Math.max(maxSpeed, Math.abs(s.speed));
    drove = Math.hypot(s.x - carStart.x, s.z - carStart.z);
    if (drove > 5 && maxSpeed > 3) break;
    await page.waitForTimeout(600);
  }
  await page.keyboard.up('KeyW');
  report.checks.carDrove = drove > 5;
  report.checks.carReachedSpeed = maxSpeed > 3;
  await page.close();

  // ---- Screenshots from the programmed poses -----------------------------
  if (!TEST_ONLY) {
    const shots = JSON.parse(await readFile(path.join(REPO, 'shots.json'), 'utf8'));
    for (const shot of shots) {
      const shotPage = await newPage();
      await shotPage.goto(`${BASE}/index.html${shot.query}`, { waitUntil: 'load' });
      await shotPage.waitForFunction(() => window.__shotReady === true, null, { timeout: 240000 });
      await shotPage.waitForTimeout(500);
      // Software GL can take a while to composite one 1280x720 frame of the
      // full city; the default 30 s screenshot timeout is too tight for it.
      let quality = 88;
      let buffer = await shotPage.screenshot({ type: 'jpeg', quality, timeout: 120000 });
      while (buffer.length > MAX_SHOT_BYTES && quality > 55) {
        quality -= 7;
        buffer = await shotPage.screenshot({ type: 'jpeg', quality, timeout: 120000 });
      }
      const out = path.join(REPO, 'screenshots', shot.name);
      await writeFile(out, buffer);
      const size = (await stat(out)).size;
      report.shots.push({ name: shot.name, bytes: size, quality, fits: size <= MAX_SHOT_BYTES });
      await shotPage.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}

report.ok = report.consoleErrors.length === 0 && report.pageErrors.length === 0
  && Object.values(report.checks).every(Boolean)
  && report.shots.every((s) => s.fits);
console.log(JSON.stringify(report, null, 2));
if (!existsSync(path.join(REPO, 'screenshots'))) report.note = 'no screenshots dir';
process.exit(report.ok ? 0 : 1);
