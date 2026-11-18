// Teluk Kirana v4 — screenshot + smoke-test runner (Node 22 + Playwright).
// Reads shots.json, serves game/ on a local port, renders each ?shot= scene
// to screenshots/<name>.jpg (1280x720, quality 82), then play-tests the
// plain game: start, walk, enter a car, drive, switch radio, shoot, and
// reports any console/page error. Usage:
//   NODE_PATH=/path/to/node_modules node shoot.mjs [--port 8901]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { createServer } from 'node:http';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const gameRoot = resolve(join(here, 'game'));
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const port = Number(process.argv.find((a, i, arr) => arr[i - 1] === '--port') ?? 8901);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname = url.pathname;
  try { pathname = decodeURIComponent(pathname); } catch { res.writeHead(400).end(); return; }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(gameRoot, normalize(pathname)));
  if (file !== gameRoot && !file.startsWith(gameRoot + sep)) { res.writeHead(403).end(); return; }
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'content-length': stats.size, 'cache-control': 'no-store' });
    readFileSync(file) && res.end(readFileSync(file));
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));
console.log(`serving game/ on http://localhost:${port}`);

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  return page;
}

// 1. Screenshots.
for (const shot of shots) {
  const page = await newPage();
  await page.goto(`http://localhost:${port}/index.html${shot.query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });
  await page.waitForTimeout(400);
  const path = join(here, 'screenshots', shot.name);
  await page.screenshot({ path, type: 'jpeg', quality: 82 });
  const size = statSync(path).size;
  console.log(`shot ${shot.name}: ${size} bytes${size > 262144 ? ' — OVER 256 KiB!' : ''}`);
  await page.close();
}

// 2. Smoke test: play the real game.
const page = await newPage();
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.waitForSelector('#start-btn', { state: 'visible' });
try {
  await page.click('#start-btn', { timeout: 10000 });
} catch {
  // Headless swiftshader can starve hit-testing; the handler is what matters.
  await page.evaluate(() => document.getElementById('start-btn').click());
}
await page.waitForTimeout(800);
// Enter the player's car first (parked by the spawn), then drive.
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
await page.keyboard.down('KeyW');
await page.waitForTimeout(2000);
await page.keyboard.up('KeyW');
const drove = await page.evaluate(() => {
  const w = window.__game;
  return { inVehicle: w.player.inVehicle, speedKmh: Math.round(w.speedKmh), pos: [w.player.pos.x.toFixed(0), w.player.pos.z.toFixed(0)] };
});
console.log('after drive:', JSON.stringify(drove));
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
await page.keyboard.down('KeyW');
await page.waitForTimeout(1500);
await page.keyboard.up('KeyW');
const walked = await page.evaluate(() => {
  const w = window.__game;
  return { z: w.player.pos.z.toFixed(1), screen: w.screen, wanted: w.police.wanted };
});
console.log('after walk:', JSON.stringify(walked));
await page.keyboard.press('KeyQ');
await page.mouse.click(640, 360);
await page.waitForTimeout(400);
const shot = await page.evaluate(() => {
  const w = window.__game;
  return { ammo: w.player.ammo, wanted: w.police.wanted, cash: w.player.cash };
});
console.log('after shoot:', JSON.stringify(shot));
await page.keyboard.press('KeyJ');
await page.waitForTimeout(600);
const job = await page.evaluate(() => ({ objective: document.getElementById('objective').textContent }));
console.log('after job start:', JSON.stringify(job));
await page.close();

await browser.close();
server.close();

if (errors.length > 0) {
  console.log(`SMOKE TEST FAILED — ${errors.length} error(s):`);
  for (const e of errors) console.log('  ' + e);
  process.exit(1);
}
console.log('SMOKE TEST PASSED — 0 console/page/network errors');
