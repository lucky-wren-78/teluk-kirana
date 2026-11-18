// Teluk Kirana — screenshot runner (v5 rebuild).
// Serves game/ on a local port, opens each shot from shots.json in headless
// Chromium via Playwright, waits for the game to settle, and saves a
// 1280x720 JPEG per shot into screenshots/. Usage: node shoot.mjs [port]
// Playwright is a dev-only dependency: resolve it from the repo first, else
// from PLAYWRIGHT_BASE (a package.json beside a playwright install), else
// from this machine's shared tools install.
import { createRequire } from 'node:module';
const localRequire = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = localRequire('playwright'));
} catch {
  const base = process.env.PLAYWRIGHT_BASE || '/home/hatch/workspace/makefun/tools-browser/package.json';
  ({ chromium } = createRequire(base)('playwright'));
}
import { spawn } from 'node:child_process';
import { readFileSync, statSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || 8901);
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
mkdirSync(join(here, 'screenshots'), { recursive: true });

const server = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], {
  cwd: here, stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (d) => process.stdout.write(`[serve] ${d}`));
server.stderr.on('data', (d) => process.stderr.write(`[serve:err] ${d}`));

function waitForServer(url, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(url).then((r) => {
        if (r.ok) resolve(true);
        else if (Date.now() - started > timeoutMs) reject(new Error('server timeout'));
        else setTimeout(tick, 300);
      }).catch(() => {
        if (Date.now() - started > timeoutMs) reject(new Error('server timeout'));
        else setTimeout(tick, 300);
      });
    };
    tick();
  });
}

let failed = false;
try {
  await waitForServer(`http://127.0.0.1:${PORT}/index.html`);
  const browser = await chromium.launch({
    executablePath: '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    await page.goto(`http://127.0.0.1:${PORT}/${shot.query}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 20000 });
    await page.waitForTimeout(6000);
    const out = join(here, 'screenshots', shot.name);
    await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
    const size = statSync(out).size;
    console.log(`${shot.name}: ${size} bytes${errors.length ? ` — ERRORS: ${errors.join(' | ')}` : ' — clean'}`);
    if (errors.length) failed = true;
    await page.close();
  }
  await browser.close();
} finally {
  server.kill();
}
if (failed) {
  console.error('shoot.mjs: one or more shots reported console/page errors');
  process.exitCode = 1;
}
