// shoot.mjs - take the four entry screenshots of Teluk Kirana.
// Serves game/ with a small built-in static server, opens each
// scene listed in shots.json in headless Chromium through
// Playwright, waits for the game to signal window.__tkReady plus a
// render settle delay, then saves JPEGs into screenshots/, stepping
// the quality down until each file fits the 256 KiB gate limit.

import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const gameRoot = resolve(join(here, 'game'));
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const outDir = join(here, 'screenshots');
mkdirSync(outDir, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

// Minimal static file server for the game folder.
const server = createServer((req, res) => {
  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = resolve(join(gameRoot, '.' + pathname));
  if (filePath !== gameRoot && !filePath.startsWith(gameRoot + sep)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(readFileSync(filePath));
});

await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
const base = 'http://127.0.0.1:' + port;

// Find a Playwright installation on this machine: a local
// node_modules first, then the shared tools folder beside the repo.
async function loadPlaywright() {
  const moduleUrls = [
    new URL('./node_modules/playwright/index.mjs', import.meta.url),
    new URL('../../tools-browser/node_modules/playwright/index.mjs', import.meta.url),
  ];
  for (const url of moduleUrls) {
    try {
      if (existsSync(fileURLToPath(url))) return await import(url.href);
    } catch {
      // Try the next candidate.
    }
  }
  return await import('playwright');
}

const playwright = await loadPlaywright();
const chromium = playwright.chromium ?? playwright.default?.chromium;
if (!chromium) throw new Error('playwright chromium not found');

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[page error]', msg.text());
});
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

const MAX_BYTES = 262144;
for (const shot of shots) {
  const url = base + '/index.html' + shot.query;
  console.log('shooting', shot.name, url);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__tkReady === true, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  const target = join(outDir, shot.name);
  let quality = 88;
  for (;;) {
    await page.screenshot({ path: target, type: 'jpeg', quality });
    const size = statSync(target).size;
    console.log(' ', shot.name, 'quality', quality, 'bytes', size);
    if (size <= MAX_BYTES || quality <= 40) break;
    quality -= 10;
  }
}

await browser.close();
server.close();
console.log('done');
