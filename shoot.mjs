// Teluk Kirana — screenshot harvester.
//
// Boots the local static server (serve.ts), walks every entry in shots.json,
// loads the game with that entry's query string (the game stages a deterministic
// scene for ?shot=...&seed=...), waits until the page reports it is ready, and
// saves a 1280x720 JPEG into screenshots/. If a frame comes out over the
// 256 KiB gate limit, quality is stepped down and the shot retaken.
//
// Playwright is resolved from the sibling tools folder when it is not installed
// beside this script, so the harvester works on this machine as-is:
//   node shoot.mjs

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = dirname(fileURLToPath(import.meta.url));
const PORT = 8931;
const BASE = `http://127.0.0.1:${PORT}`;
const MAX_SHOT_BYTES = 262144;

async function loadPlaywright() {
  try {
    const mod = await import('playwright');
    if (mod.chromium) return mod;
  } catch { /* fall through to the sibling tools folder */ }
  const { createRequire } = await import('node:module');
  const requireFromTools = createRequire(join(repoDir, '..', '..', 'tools-browser', 'package.json'));
  const mod = requireFromTools('playwright');
  if (mod && mod.chromium) return mod;
  throw new Error('shoot.mjs: could not load playwright from any known location');
}

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolvePromise, rejectPromise) => {
    const attempt = () => {
      fetch(url).then((res) => {
        if (res.ok) resolvePromise();
        else retry();
      }).catch(retry);
    };
    const retry = () => {
      if (Date.now() > deadline) rejectPromise(new Error(`server at ${url} never came up`));
      else setTimeout(attempt, 200);
    };
    attempt();
  });
}

const server = spawn(process.execPath, [join(repoDir, 'serve.ts'), '--port', String(PORT)], { stdio: 'ignore' });
try {
  await waitForServer(`${BASE}/index.html`, 15000);
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const shots = JSON.parse(readFileSync(join(repoDir, 'shots.json'), 'utf8'));

  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(`${BASE}/index.html${shot.query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__TK_READY__ === true, null, { timeout: 30000 });
    await page.waitForTimeout(600);

    const outPath = join(repoDir, 'screenshots', shot.name);
    let quality = 82;
    for (;;) {
      await page.screenshot({ path: outPath, type: 'jpeg', quality });
      const size = statSync(outPath).size;
      if (size <= MAX_SHOT_BYTES || quality <= 40) {
        console.log(`${shot.name}: ${size} bytes at quality ${quality}${errors.length ? ` (page errors: ${errors.join('; ')})` : ''}`);
        break;
      }
      quality -= 14;
    }
    await page.close();
  }
  await browser.close();
} finally {
  server.kill();
}
if (!existsSync(join(repoDir, 'screenshots'))) throw new Error('screenshots folder missing');
