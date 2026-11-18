// Teluk Kirana — cover-shot renderer for the v6 entry.
// Boots serve.ts on a scratch port, opens every entry of shots.json in
// headless Chromium (Playwright), waits until the game reports ready and
// the staged scene has settled, then saves a 1280x720 JPEG per shot into
// screenshots/. Any console error or page error in a shot fails the run.
//   node shoot.mjs [port]
// Playwright is a dev-only tool here: it is resolved from this repo when
// present, otherwise from PLAYWRIGHT_BASE (the package.json of a shared
// tools install).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 8917);
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
mkdirSync(join(here, 'screenshots'), { recursive: true });

function loadChromium() {
  try {
    return createRequire(import.meta.url)('playwright').chromium;
  } catch {
    const base = process.env.PLAYWRIGHT_BASE || '/home/hatch/workspace/makefun/tools-browser/package.json';
    return createRequire(base)('playwright').chromium;
  }
}

async function waitForServer(url, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error(`server did not answer at ${url}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

const server = spawn(process.execPath, ['serve.ts', '--port', String(port)], {
  cwd: here, stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (d) => process.stdout.write(`[serve] ${d}`));
server.stderr.on('data', (d) => process.stderr.write(`[serve] ${d}`));

let failed = false;
try {
  await waitForServer(`http://127.0.0.1:${port}/index.html`);
  const chromium = loadChromium();
  const browser = await chromium.launch({
    executablePath: '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const problems = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
    await page.goto(`http://127.0.0.1:${port}/${shot.query}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 25000 });
    await page.waitForTimeout(5500);
    const outPath = join(here, 'screenshots', shot.name);
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 84 });
    const bytes = statSync(outPath).size;
    console.log(`${shot.name}: ${bytes} bytes${problems.length ? ` — PROBLEMS: ${problems.join(' | ')}` : ' — clean'}`);
    if (problems.length) failed = true;
    await page.close();
  }
  await browser.close();
} finally {
  server.kill();
}
if (failed) {
  console.error('shoot.mjs: at least one shot had console/page errors');
  process.exitCode = 1;
}
