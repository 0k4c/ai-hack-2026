import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { renderRecord, validateRecord } from './render.mjs';
import { createViewServer } from './serve.mjs';

const sample = JSON.parse(await readFile(new URL('./sample-arrangement.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(sample);

test('契約v1の全巡・除外理由・初回と合計計測を表示し、勤務を確定しない', () => {
  const value = clone();
  value.rounds.reverse();
  const html = renderRecord(value, { sample:true });
  for (const expected of ['1巡目 / 最大3巡','2巡目 / 最大3巡','次の候補へ打診','店長の承認待ち','未送信（デモ）','週の労働時間上限を超過','連勤上限を超過','希望休','既存勤務と重複','sample-model','2,100','$0.000300','架空サンプル','disabled','閲覧のみ']) assert.ok(html.includes(expected), expected);
  assert.ok(html.indexOf('1巡目') < html.indexOf('2巡目'));
  assert.equal(html.includes('確定済み'), false);
});

test('null、欠損、不明な費用ソースをゼロとして表示しない', () => {
  const value = clone();
  value.totalTokens = null;
  value.totalEstimatedCostUsd = null;
  value.totalDurationMs = null;
  value.selectionRequest = null;
  for (const round of value.rounds) {
    round.tokens = null; round.estimatedCostUsd = null; round.actualModel = null; round.durationMs = null;
  }
  const html = renderRecord(value);
  assert.ok(html.includes('実モデル <strong>不明</strong>'));
  assert.ok(html.includes('トークン <strong>不明</strong>'));
  assert.equal(html.includes('$0.000000'), false);
  for (const source of ['not_called','unavailable']) {
    const unknown = clone();
    unknown.rounds.forEach(round => { round.costSource = source; round.estimatedCostUsd = 0; round.tokens.total = 0; });
    unknown.totalEstimatedCostUsd = 0; unknown.totalTokens.total = 0;
    const output = renderRecord(unknown);
    assert.equal(output.includes('$0.000000'), false);
    assert.ok(output.includes('合計概算費用（USD）</span><span class="metric-value">不明'));
  }
  const zero = clone();
  zero.rounds[0].estimatedCostUsd = 0;
  assert.ok(renderRecord(zero).includes('$0.000000'));
  zero.rounds[0].estimatedCostUsd = 0.00000001;
  assert.ok(renderRecord(zero).includes('$0.000001 未満'));
});

test('条件付き・上限停止・API失敗・途中記録・候補ゼロを表示する', () => {
  const value = clone();
  value.rounds[0].interpretation.kind = 'conditional';
  value.rounds[0].action.type = 'retry';
  assert.ok(renderRecord(value).includes('条件を変えて再打診'));
  value.status = 'escalated'; value.stopReason = 'round_limit';
  value.rounds.push({ ...value.rounds[1], number:3, action:{type:'escalate',reason:'上限'} });
  assert.ok(renderRecord(value).includes('3巡目 / 最大3巡'));
  assert.ok(renderRecord(value).includes('打診回数の上限に達しました'));
  value.status = 'failed'; value.stopReason = 'api_failure';
  value.error = {code:'api_error',httpStatus:429,message:'APIの呼び出しに失敗しました。'};
  assert.ok(renderRecord(value).includes('HTTP 429'));
  value.status = 'pending';
  assert.ok(renderRecord(value).includes('計数・費用は途中値'));
  value.status = 'escalated'; value.stopReason = 'no_candidates'; value.rounds = []; value.selection = null;
  value.filtering.evaluations = []; value.provisionalAssignment = null;
  assert.ok(renderRecord(value).includes('打診できる候補がいません'));
});

test('AI回答や読み込んだ文字列をHTMLとして実行しない', () => {
  const value = clone();
  const injection = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  value.processId = injection;
  value.rounds[0].originalReply = injection;
  value.rounds[0].selectionReason = injection;
  value.rounds[0].action.reason = injection;
  value.rounds[0].actualModel = injection;
  value.filtering.evaluations[0].reasons = [injection];
  const html = renderRecord(value);
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;img'));
});

test('未知の追加キーは許容し、壊れた契約は利用者向けのエラーにする', () => {
  assert.doesNotThrow(() => validateRecord({...clone(), llmCallCount:3}));
  for (const value of [null, {}, {...clone(),schemaVersion:2}, {...clone(),rounds:[null]}, {...clone(),filtering:{}}, {...clone(),rounds:[clone().rounds[0],clone().rounds[0]]}]) assert.throws(() => validateRecord(value));
});

test('HTTPサーバーは記録の読取だけを許可し、秘密ファイルや範囲外のパスを公開しない', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'arrangement-view-'));
  t.after(() => rm(directory, { recursive:true, force:true }));
  const recordsDir = join(directory, 'records');
  await mkdir(recordsDir);
  await writeFile(join(recordsDir, 'one.json'), '\uFEFF' + JSON.stringify(sample));
  await writeFile(join(recordsDir, 'bad.json'), '{broken');
  await writeFile(join(recordsDir, 'large.json'), ' '.repeat(2 * 1024 * 1024 + 1));
  await writeFile(join(directory, '.env'), 'PRIVATE_MARKER=secret');
  const server = createViewServer({ recordsDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const listing = await (await fetch(base + '/api/arrangements')).json();
  assert.deepEqual(listing.files, ['bad.json','large.json','one.json']);
  const response = await fetch(base + '/api/arrangements/one.json');
  assert.deepEqual(await response.json(), sample);
  assert.ok(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  for (const path of ['/.env','/serve.mjs','/view.test.mjs','/api/arrangements/..%2F.env','/api/arrangements/%2e%2e%5c.env','/api/arrangements/missing.json']) assert.equal((await fetch(base + path)).status,404,path);
  assert.equal((await fetch(base + '/api/arrangements/large.json')).status,413);
  assert.equal((await fetch(base + '/api/arrangements/bad.json')).status,500);
  assert.equal((await fetch(base + '/api/arrangements/one.json', {method:'POST'})).status,405);
  assert.equal((await fetch(base + '/', {headers:{Origin:'https://untrusted.example'}})).status,403);
  const hostStatus = await new Promise((resolve,reject) => { const req=request(base,{headers:{Host:'untrusted.example'}},res=>{res.resume(); resolve(res.statusCode);}); req.on('error',reject); req.end(); });
  assert.equal(hostStatus,403);
  for (const path of ['/','/view.mjs','/render.mjs','/style.css','/sample-arrangement.json']) assert.equal((await fetch(base + path)).status,200,path);
});

test('記録ディレクトリがまだ存在しない場合は空一覧を返す', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'arrangement-empty-'));
  t.after(() => rm(directory, {recursive:true,force:true}));
  const server = createViewServer({ recordsDir:join(directory,'missing') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  assert.deepEqual(await (await fetch(`http://127.0.0.1:${server.address().port}/api/arrangements`)).json(),{files:[],records:[]});
});
