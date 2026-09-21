import { createServer } from 'node:http';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { ApprovalError, approveArrangement, inspectArrangement } from '../src/approve-arrangement.mjs';

class HttpError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}
const viewState = state => ({ ...state, reason: state.reason === 'not_approvable' ? '承認待ち・日付・勤務条件を確認してください。' : state.reason });

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
  const approvalToken = randomBytes(32).toString('hex');
  const loadRecord = async name => {
    const path = await recordPath(recordsDir, name);
    if ((await stat(path)).size > maxSize) throw new HttpError('ファイルは2MB以内にしてください。', 413);
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  };
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
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'POST' && url.pathname.startsWith('/api/approve/')) {
        if (req.headers.origin !== `http://${req.headers.host}` || req.headers['x-approval-token'] !== approvalToken || req.headers['content-type'] !== 'application/json') {
          send(403, JSON.stringify({ error:'この画面を開き直して承認してください。' })); return;
        }
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 1024) throw new HttpError('承認要求が大きすぎます。', 413);
        }
        let input;
        try { input = JSON.parse(body); } catch { throw new HttpError('承認要求が不正です。', 400); }
        if (!input || Object.keys(input).join(',') !== 'recordHash' || !/^[a-f0-9]{64}$/.test(input.recordHash)) throw new HttpError('承認要求が不正です。', 400);
        const name = decodeURIComponent(url.pathname.slice('/api/approve/'.length));
        if (!/^[a-f0-9]{64}\.json$/.test(name)) throw new HttpError('保存された手配記録を選択してください。', 400);
        const options = { recordsDir, processId: name.slice(0, -5), expectedRecordHash: input.recordHash };
        const saved = await approveArrangement(options);
        const result = { ...viewState(await inspectArrangement(options)), alreadyApproved: !saved.created };
        send(200, JSON.stringify(result)); return;
      }
      if (req.method !== 'GET') { send(405, '{"error":"read_only"}'); return; }
      if (url.pathname === '/api/session') { send(200, JSON.stringify({ approvalToken })); return; }
      if (url.pathname.startsWith('/api/review/')) {
        const name = decodeURIComponent(url.pathname.slice('/api/review/'.length));
        const review = /^[a-f0-9]{64}\.json$/.test(name)
          ? viewState(await inspectArrangement({ recordsDir, processId: name.slice(0, -5) }))
          : { record: await loadRecord(name), canApprove: false, approval: null, recordHash: null, reason: '保存された手配記録を選択してください。' };
        send(200, JSON.stringify(review)); return;
      }
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
      if (error instanceof HttpError) send(error.status, JSON.stringify({ error:error.message }));
      else if (error instanceof ApprovalError) send(error.code === 'not_found' ? 404 : 409, JSON.stringify({ error: error.message, code: error.code }));
      else if (['ENOENT', 'ENOTDIR'].includes(error.code) || error.message === 'invalid_path' || error instanceof URIError) send(404, '{"error":"not_found"}');
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
  server.listen(port, '127.0.0.1', () => console.log(`代打手配の記録: http://127.0.0.1:${port}\n記録フォルダ: ${recordsDir}\n承認は記録フォルダ内のapprovalsへ保存 / Ctrl+Cで終了`));
}
