import { createServer } from 'node:http';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));
const defaultRecords = resolve(appDir, '../output/arrangements');
const filenamePattern = /^[a-zA-Z0-9_-]+\.json$/;
const maxSize = 2 * 1024 * 1024;
const staticFiles = new Map([
  ['/', ['index.html', 'text/html']], ['/style.css', ['style.css', 'text/css']],
  ['/view.mjs', ['view.mjs', 'text/javascript']], ['/render.mjs', ['render.mjs', 'text/javascript']],
  ['/sample-arrangement.json', ['sample-arrangement.json', 'application/json']],
]);

async function recordPath(directory, name) {
  if (!filenamePattern.test(name)) throw new Error('invalid_path');
  const root = await realpath(directory);
  const path = await realpath(resolve(root, name));
  if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw new Error('invalid_path');
  return path;
}

export function createViewServer({ recordsDir = defaultRecords } = {}) {
  return createServer(async (req, res) => {
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, {
        'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      });
      res.end(body);
    };
    // Local-only viewer; reject rebinding hosts and cross-origin browser reads.
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? '') || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) {
      send(403, '{"error":"forbidden"}'); return;
    }
    if (req.method !== 'GET') { send(405, '{"error":"read_only"}'); return; }
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const asset = staticFiles.get(url.pathname);
      if (asset) { send(200, await readFile(resolve(appDir, asset[0])), asset[1]); return; }
      if (url.pathname === '/api/arrangements') {
        let entries;
        try { entries = await readdir(recordsDir, { withFileTypes: true }); }
        catch (error) { if (error.code !== 'ENOENT') throw error; entries = []; }
        const files = entries.filter(entry => entry.isFile() && filenamePattern.test(entry.name)).map(entry => entry.name).sort();
        send(200, JSON.stringify({ files })); return;
      }
      if (url.pathname.startsWith('/api/arrangements/')) {
        const name = decodeURIComponent(url.pathname.slice('/api/arrangements/'.length));
        const path = await recordPath(recordsDir, name);
        if ((await stat(path)).size > maxSize) { send(413, '{"error":"file_too_large"}'); return; }
        const body = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '');
        JSON.parse(body);
        send(200, body); return;
      }
      send(404, '{"error":"not_found"}');
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code) || error.message === 'invalid_path' || error instanceof URIError) send(404, '{"error":"not_found"}');
      else send(500, '{"error":"unreadable_record"}');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--port', '--records'].includes(args[i]) || !args[i+1] || args[i+1].startsWith('--')) {
      console.error('使い方: node app/serve.mjs [--port 4173] [--records output/arrangements]');
      process.exit(1);
    }
    options[args[i]] = args[i+1];
  }
  const port = Number(options['--port'] ?? 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('ポートは1〜65535の整数で指定してください。'); process.exit(1); }
  const recordsDir = options['--records'] ? resolve(options['--records']) : defaultRecords;
  const server = createViewServer({ recordsDir });
  server.on('error', error => { console.error(`表示サーバーを起動できません (${error.code})。別の --port を指定してください。`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`代打手配の記録: http://127.0.0.1:${port}\n記録フォルダ: ${recordsDir}\n閲覧専用 / Ctrl+Cで終了`));
}
