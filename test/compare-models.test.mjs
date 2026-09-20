import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { comparisonInputs, comparisonMarkdown, parseArgs, runComparison, summarize } from '../src/compare-models.mjs';

const interpretation = { interpretation: { summary: '指定日の18時から22時まで勤務できます。', preferences: [{
  sourceText: '2026年9月21日は18時から22時まで入れます。', kind: 'available', dates: ['2026-09-21'],
  allDay: false, startTime: '18:00', endTime: '22:00',
}] }, ambiguities: [] };
const selection = { employeeId: 'e2', reason: '週労働時間に余裕があります。' };
const body = (result, usage = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30, cost_usd: 0.0001 }) => ({
  model: 'test/model', usage, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }],
});
async function setup(t) {
  const outputDir = await mkdtemp(join(tmpdir(), 'model-comparison-test-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  return { outputDir, apiKey: 'test-only-key' };
}
const goodFetch = async (_url, options) => new Response(JSON.stringify(body(JSON.parse(options.body).max_tokens === 512 ? selection : interpretation)));

test('同一入力で3モデル各3回・2機能の18回を実行し、回答・計測・人の所見欄を保存する', async t => {
  const options = await setup(t);
  const requests = [];
  const result = await runComparison({ ...options, fetchImpl: async (url, init) => {
    const payload = JSON.parse(init.body);
    requests.push(payload);
    assert.equal(url, 'https://api.orcarouter.ai/v1/chat/completions');
    assert.doesNotMatch(init.body, /田中|佐藤|鈴木|test-only-key/);
    const pending = JSON.parse(await readFile(join(options.outputDir, (await readdir(options.outputDir)).find(name => name.endsWith('.json'))), 'utf8'));
    assert.equal(pending.rows.at(-1).status, 'pending');
    return goodFetch(url, init);
  } });
  assert.equal(requests.length, 18);
  assert.equal(result.report.status, 'completed');
  assert.equal(result.report.summary.length, 6);
  for (const task of ['selection', 'interpretation']) assert.equal(new Set(result.report.rows.filter(row => row.task === task).map(row => row.inputHash)).size, 1);
  for (const max of [512,4096]) assert.equal(new Set(requests.filter(row => row.max_tokens === max).map(row => JSON.stringify(row.messages))).size, 1);
  assert.deepEqual(result.report.rows.map(row => row.requestedModel).filter((_,index) => index % 6 === 0), ['orcarouter/auto','orcarouter/free','google/gemini-2.5-flash']);
  for (const row of result.report.rows) {
    assert.equal(row.humanReview.verdict, null);
    assert.equal(row.humanReview.notes, null);
    assert.equal(row.tokens.total, 30);
    assert.equal(row.estimatedCostUsd, 0.0001);
    assert.ok(row.durationMs >= 0);
    assert.ok(row.result);
  }
  const saved = await readFile(result.path, 'utf8');
  assert.doesNotMatch(saved, /test-only-key/);
  assert.deepEqual(JSON.parse(saved), result.report);
  assert.match(await readFile(result.markdownPath, 'utf8'), /形式検証の成功であり、品質の採点ではありません/);
});

test('不正な解釈も取得した課金情報を保持し、429と欠損を0へ変えない', async t => {
  let calls = 0;
  const { report } = await runComparison({ ...await setup(t), models: ['test/model'], repeats: 2,
    fetchImpl: async () => {
      calls++;
      if (calls === 1) return new Response(JSON.stringify(body(selection, undefined)));
      if (calls === 2) return new Response(JSON.stringify(body({ interpretation: {} })));
      if (calls === 3) return new Response('secret raw error', { status: 429 });
      const value = body(interpretation); delete value.usage;
      return new Response(JSON.stringify(value));
    },
  });
  assert.equal(calls, 4);
  assert.equal(report.status, 'completed_with_errors');
  assert.equal(report.rows[1].error.code, 'invalid_interpretation');
  assert.equal(report.rows[1].estimatedCostUsd, 0.0001);
  assert.equal(report.rows[2].httpStatus, 429);
  assert.equal(report.rows[2].estimatedCostUsd, null);
  assert.equal(report.rows[3].tokens.total, null);
  assert.equal(report.summary[0].estimatedCostUsd.mean, null);
  assert.equal(report.summary[0].estimatedCostUsd.knownCount, 1);
  assert.doesNotMatch(JSON.stringify(report), /secret raw error/);
});

test('認証エラーでは1回で停止し残りを実行しない', async t => {
  let calls = 0;
  const { report } = await runComparison({ ...await setup(t), fetchImpl: async () => { calls++; return new Response('secret', { status: 401 }); } });
  assert.equal(calls, 1);
  assert.equal(report.status, 'stopped_authentication');
  assert.equal(report.plannedCalls, 18);
  assert.equal(report.rows.length, 1);
});

test('キー未設定・保存不可・不正オプションで通信しない', async t => {
  const options = await setup(t);
  const fetchImpl = () => assert.fail('通信しない');
  await assert.rejects(runComparison({ ...options, apiKey: '', fetchImpl }), /ORCAROUTER_API_KEY/);
  await assert.rejects(runComparison({ ...options, repeats: 4, fetchImpl }), /1〜3/);
  const file = join(options.outputDir, 'file');
  await writeFile(file, 'x');
  await assert.rejects(runComparison({ ...options, outputDir: file, fetchImpl }));
  assert.throws(() => parseArgs(['--models', 'a,a']));
  assert.throws(() => parseArgs(['--configured','--models','a'], { ORCAROUTER_MODEL: 'orcarouter/test' }));
  assert.throws(() => parseArgs(['--configured'], {}));
  assert.throws(() => parseArgs(['--unknown']));
});

test('環境変数だけでNamed Routerへ切り替え、Fallbackの観測値を保持する', async t => {
  const options = parseArgs(['--configured','--repeats','1'], { ORCAROUTER_MODEL: 'orcarouter/test-router' });
  const { report } = await runComparison({ ...options, ...await setup(t), fetchImpl: async (url, init) => {
    assert.equal(JSON.parse(init.body).model, 'orcarouter/test-router');
    const response = await goodFetch(url, init);
    response.headers.set('x-orca-fallback-model', 'provider/fallback');
    response.headers.set('x-orca-request-id', 'test-request');
    return response;
  } });
  assert.equal(report.rows.length, 2);
  assert.equal(report.rows[0].actualModel, 'provider/fallback');
  assert.equal(report.rows[0].fallbackModel, 'provider/fallback');
  assert.equal(report.rows[0].requestId, 'test-request');
});

test('中断しても完了済みの記録を保持し、自動再試行しない', async t => {
  const options = await setup(t);
  let calls = 0;
  await assert.rejects(runComparison({ ...options, fetchImpl: async (...args) => { calls++; return goodFetch(...args); },
    onProgress: () => { throw new Error('test interruption'); },
  }), /test interruption/);
  assert.equal(calls, 1);
  const file = (await readdir(options.outputDir)).find(name => name.endsWith('.json'));
  const saved = JSON.parse(await readFile(join(options.outputDir, file), 'utf8'));
  assert.equal(saved.rows[0].status, 'succeeded');
  assert.equal(saved.status, 'running');
});

test('集計とMarkdownは明示の0を保持し、表を壊す文字をエスケープする', () => {
  const rows = [{ task:'selection', requestedModel:'test/model', status:'succeeded', apiCalled:true,
    actualModel:'<script>|x', tokens:{total:0}, estimatedCostUsd:0, durationMs:0, repeat:1 }];
  const summary = summarize(rows);
  assert.equal(summary[0].estimatedCostUsd.mean, 0);
  const markdown = comparisonMarkdown({id:'test',status:'completed',createdAt:'today',inputHash:'hash',rows,summary});
  assert.ok(markdown.includes('&lt;script&gt;&#124;x'));
  assert.equal(markdown.includes('<script>'), false);
});

test('CLIのplanはキーなしで入力と18回の計画だけを返す', async () => {
  const cli = fileURLToPath(new URL('../src/compare-models.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, '--plan'], { encoding:'utf8', env:{...process.env,ORCAROUTER_API_KEY:''} });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.plannedCalls, 18);
  assert.deepEqual(plan.inputs, await comparisonInputs());
});
