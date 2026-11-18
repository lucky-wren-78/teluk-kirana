// Teluk Kirana — pocket static server for local play-testing.
//
// `node serve.ts` (optionally `--port 8123`) serves the game/ folder on
// 127.0.0.1 so the entry can be played and screenshotted without any build
// step or network access. It is deliberately boring: correct MIME types for
// the file kinds a browser game ships, a hard refusal for any path that tries
// to climb out of game/, and no caching so edits show up on reload.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));

const argv = process.argv.slice(2);
const portFlagAt = argv.indexOf('--port');
const wantedPort = portFlagAt === -1 ? 8080 : Number(argv[portFlagAt + 1]);
const listenPort = Number.isInteger(wantedPort) && wantedPort > 0 && wantedPort < 65536 ? wantedPort : 8080;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.bin': 'application/octet-stream',
};

const server = createServer((request, response) => {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
  } catch {
    response.writeHead(400).end('malformed path');
    return;
  }
  if (decodedPath.endsWith('/')) decodedPath += 'index.html';

  const targetFile = resolve(join(gameRoot, normalize(decodedPath)));
  const insideGame = targetFile === gameRoot || targetFile.startsWith(gameRoot + sep);
  if (!insideGame) {
    response.writeHead(403).end('outside the game folder');
    return;
  }

  let byteSize: number;
  try {
    const info = statSync(targetFile);
    if (!info.isFile()) throw new Error('directory, not a file');
    byteSize = info.size;
  } catch {
    response.writeHead(404).end('no such file');
    return;
  }

  response.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(targetFile).toLowerCase()] ?? 'application/octet-stream',
    'content-length': byteSize,
    'cache-control': 'no-store',
  });
  createReadStream(targetFile).pipe(response);
});

server.listen(listenPort, '127.0.0.1', () => {
  console.log(`Teluk Kirana game/ serving at http://127.0.0.1:${listenPort}`);
});
