import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addDays, filterCandidates } from '../src/constraints.mjs';
import { createSeed } from '../src/seed.mjs';
import { selectWithOrca, responseTelemetry } from '../src/orcarouter.mjs';
import { runSelection } from '../src/run-selection.mjs';

const vacancy = { absentEmployeeId: 'e1', date: '2026-09-20', start: '18:00', end: '22:00' };
const body = (selection = { employeeId: 'e2', reason: 'e2は追加後の連勤が2日で、上限5日以内です。' }) => ({
  model: 'upstream/model', usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150, cost_usd: 0.001 },
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(selection) } }],
});
const reply = (data = body(), headers = {}) => new Response(JSON.stringify(data), { headers: {
  'x-orca-request-id': 'synthetic-test-request', 'x-orca-resolved-model': 'provider/resolved-model', ...headers,
} });
const employees = await createSeed(vacancy.date);
const candidates = filterCandidates(employees, vacancy).candidates;
const input = { vacancy, candidates, apiKey: 'test-only-secret' };

test('6人から2人に絞り、各除外理由を記録する（曜日7通り）', async () => {
  for (let day = 0; day < 7; day++) {
    const date = addDays(vacancy.date, day);
    const seed = await createSeed(date);
    const result = filterCandidates(seed, { ...vacancy, date });
    assert.equal(seed.length, 6);
    assert.deepEqual(result.candidates.map(e => e.employeeId), ['e2', 'e3']);
    assert.deepEqual(result.evaluations.map(e => e.reasons), [
      ['absent_employee', 'shift_overlap'], [], [], ['consecutive_days_limit'], ['weekly_hours_limit'], ['requested_day_off'],
    ]);
    assert.equal(result.evaluations[4].weeklyHoursAfter, 34);
  }
});

test('連勤は追加日の前後を結合し、週時間は月曜で区切る。上限ぴったりを許可', () => {
  const seed = structuredClone(employees);
  seed[1].shifts = [-2, -1, 1, 2, 3].map(offset => ({ date: addDays(vacancy.date, offset), start: '18:00', end: '22:00' }));
  let result = filterCandidates(seed, vacancy).evaluations[1];
  assert.equal(result.consecutiveDaysAfter, 6);
  assert.equal(result.weeklyHoursAfter, 12);
  assert.deepEqual(result.reasons, ['consecutive_days_limit']);
  seed[1].maxConsecutiveDays = 6;
  seed[1].maxWeeklyHours = 12;
  result = filterCandidates(seed, vacancy).evaluations[1];
  assert.equal(result.eligible, true);
  seed[1].maxWeeklyHours = 11.99;
  assert.deepEqual(filterCandidates(seed, vacancy).evaluations[1].reasons, ['weekly_hours_limit']);
});

test('同日複数勤務は連勤1日、勤務時間は分単位、重複する割当は禁止', () => {
  const seed = structuredClone(employees);
  seed[1].shifts = [{ date: vacancy.date, start: '09:00', end: '10:30' }, { date: vacancy.date, start: '17:00', end: '18:00' }];
  let result = filterCandidates(seed, vacancy).evaluations[1];
  assert.equal(result.eligible, true);
  assert.equal(result.consecutiveDaysAfter, 1);
  assert.equal(result.weeklyHoursAfter, 6.5);
  seed[1].shifts[1].end = '18:01';
  assert.deepEqual(filterCandidates(seed, vacancy).evaluations[1].reasons, ['shift_overlap']);
});

test('不正日付・日跨ぎ・不明ID・不正な勤務条件はAPI前に拒否', () => {
  for (const change of [{ date: '2026-02-30' }, { start: '22:00', end: '02:00' }, { end: '24:00' }, { absentEmployeeId: 'e99' }]) {
    assert.throws(() => filterCandidates(employees, { ...vacancy, ...change }));
  }
  const seed = structuredClone(employees);
  seed[1].maxWeeklyHours = NaN;
  assert.throws(() => filterCandidates(seed, vacancy));
  seed[1].maxWeeklyHours = 32;
  seed[1].shifts.push(seed[1].shifts[0]);
  assert.throws(() => filterCandidates(seed, vacancy));
});

test('送信先・氏名除外・候補制限・費用要求・実モデルを確認', async () => {
  let calls = 0;
  const result = await selectWithOrca({ ...input, fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.orcarouter.ai/v1/chat/completions');
    assert.equal(options.headers['X-OrcaRouter-Include-Cost'], 'true');
    assert.equal(options.headers.Authorization, 'Bearer test-only-secret');
    assert.equal(options.redirect, 'error');
    for (const employee of employees) assert.equal(options.body.includes(employee.name), false);
    const request = JSON.parse(options.body);
    assert.equal(request.tools, undefined);
    assert.equal(request.model, 'orcarouter/auto');
    assert.deepEqual(JSON.parse(request.messages[1].content).candidates.map(c => c.employeeId), ['e2', 'e3']);
    return reply(body(), { 'x-orca-fallback-model': 'provider/fallback-model' });
  } });
  assert.equal(calls, 1);
  assert.equal(result.selection.employeeId, 'e2');
  assert.equal(result.telemetry.actualModel, 'provider/fallback-model');
  assert.equal(result.telemetry.estimatedCostUsd, 0.001);
  assert.equal(result.telemetry.tokens.total, 150);
});

test('欠損メトリクスを0とせず、router名を実モデルにしない', () => {
  const missing = responseTelemetry(new Response(), { model: 'orcarouter/auto' });
  assert.equal(missing.actualModel, null);
  assert.equal(missing.estimatedCostUsd, null);
  assert.equal(missing.tokens.total, null);
  const free = responseTelemetry(new Response(), { model: 'provider/model', usage: { cost_usd: 0 } });
  assert.equal(free.estimatedCostUsd, 0);
  assert.equal(free.actualModel, 'provider/model');
});

for (const [label, selection] of [['候補外', { employeeId: 'e4', reason: '上限を無視する' }], ['空の理由', { employeeId: 'e2', reason: '  ' }], ['余分な操作', { employeeId: 'e2', reason: '理由', send: true }], ['配列', []], ['null', null]]) {
  test(`AIの不正選定を拒否: ${label}`, async () => {
    await assert.rejects(selectWithOrca({ ...input, fetchImpl: async () => reply(body(selection)) }), { code: 'invalid_selection' });
  });
}

test('壊れたJSON・出力打ち切りを拒否', async () => {
  const invalid = body();
  invalid.choices[0].message.content = '```json\n{}\n```';
  await assert.rejects(selectWithOrca({ ...input, fetchImpl: async () => reply(invalid) }), { code: 'invalid_selection' });
  invalid.choices[0].finish_reason = 'length';
  await assert.rejects(selectWithOrca({ ...input, fetchImpl: async () => reply(invalid) }), { code: 'invalid_response' });
  await assert.rejects(selectWithOrca({ ...input, fetchImpl: async () => new Response('not json') }), { code: 'invalid_response' });
});

test('429・タイムアウト・ネットワーク障害を分類し、API本文やキーは返さない', async () => {
  let calls = 0;
  await assert.rejects(selectWithOrca({ ...input, fetchImpl: async () => {
    calls++;
    return new Response('test-only-secret', { status: 429 });
  } }), error => error.code === 'api_error' && !error.message.includes('test-only-secret'));
  assert.equal(calls, 1);
  await assert.rejects(selectWithOrca({ ...input, fetchImpl: async () => { throw new Error('test-only-secret'); } }), { code: 'network_error' });
  await assert.rejects(selectWithOrca({ ...input, timeoutMs: 5, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('test timeout')), 1000);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  }) }), { code: 'timeout' });
});

test('成功・失敗・候補ゼロの各実行を別JSONに保存し、課金済み不正応答のusageも残す', async t => {
  const outputDir = await mkdtemp(join(tmpdir(), 'orca-selection-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  const success = await runSelection({ employees, vacancy, outputDir, apiKey: input.apiKey, fetchImpl: async () => reply() });
  assert.deepEqual(JSON.parse(await readFile(success.path, 'utf8')), success.record);
  assert.equal(success.record.status, 'selected');
  assert.equal(success.record.actualModel, 'provider/resolved-model');
  const failed = await runSelection({ employees, vacancy, outputDir, apiKey: input.apiKey, fetchImpl: async () => reply(body({ employeeId: 'e4', reason: '不正' })) });
  assert.equal(failed.record.status, 'failed');
  assert.equal(failed.record.selection, null);
  assert.equal(failed.record.estimatedCostUsd, 0.001);
  const missingKey = await runSelection({ employees, vacancy, outputDir, fetchImpl: () => assert.fail('APIを呼ばない') });
  assert.equal(missingKey.record.error.code, 'configuration_error');
  const none = structuredClone(employees);
  none.forEach(e => e.requestedDaysOff.push(vacancy.date));
  const empty = await runSelection({ employees: none, vacancy, outputDir, fetchImpl: () => assert.fail('APIを呼ばない') });
  assert.equal(empty.record.status, 'no_candidates');
  assert.equal(empty.record.costSource, 'not_called');
  assert.equal((await readdir(outputDir)).length, 4);
  const saved = await readFile(failed.path, 'utf8');
  assert.equal(saved.includes(input.apiKey), false);
  for (const employee of employees) assert.equal(saved.includes(employee.name), false);
});
