import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { renderRecord } from './render.mjs';
import { createViewServer } from './serve.mjs';

// Before #21 is merged, point this at its isolated worktree. After merge the
// default is this repository's own src/. No copied implementation is tested.
const source = process.env.ARRANGEMENT_SOURCE_DIR
  ? resolve(process.env.ARRANGEMENT_SOURCE_DIR)
  : fileURLToPath(new URL('../src/', import.meta.url));
const modulePath = join(source, 'run-arrangement.mjs');
const available = await access(modulePath).then(() => true, () => false);

test('手配の実装が保存したJSONをHTTP経由で取得し画面へ表示する（通信のみモック）', {
  skip: available ? false : '#21未統合。ARRANGEMENT_SOURCE_DIRに検証対象のsrcを指定してください。',
}, async t => {
  const { runArrangement } = await import(pathToFileURL(modulePath).href);
  const { createSeed } = await import(pathToFileURL(join(source, 'seed.mjs')).href);
  const root = await mkdtemp(join(tmpdir(), 'arrangement-view-integration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const vacancy = { absentEmployeeId: 'e1', date: '2099-09-21', start: '18:00', end: '22:00' };
  const selection = { employeeId: 'e2', reason: '勤務時間に余裕があります。' };
  const decision = (kind, type, id = 'e2', start = '18:00', end = '22:00') => ({
    interpretation: { kind, summary: '架空の返事を解釈しました。' },
    action: { type, employeeId: id, start, end, reason: '勤務条件を確認しました。' },
  });
  const cases = [
    { name: '辞退から受諾', responses: [selection, decision('declined', 'next_candidate', 'e3'), decision('accepted', 'hold', 'e3')], status: 'filled', expected: ['2巡目 / 最大3巡', '店長の承認待ち', '次の候補へ打診', '未送信（dryrun）', '$0.000300'] },
    { name: '3巡停止', responses: [selection, decision('conditional', 'retry', 'e2', '18:00', '20:00'), decision('conditional', 'retry', 'e2', '19:00', '20:00'), decision('conditional', 'retry', 'e2', '19:00', '21:00')], status: 'escalated', expected: ['3巡目 / 最大3巡', '打診回数の上限', '条件付き'] },
    { name: '利用情報欠損', responses: [selection, decision('accepted', 'hold')], status: 'filled', noUsage: true, expected: ['トークン <strong>不明', '概算USD <strong>不明'] },
    { name: 'API失敗', responses: [selection], status: 'failed', fail: true, expected: ['処理に失敗', 'HTTP 429'] },
  ];
  for (const [index, fixture] of cases.entries()) await t.test(fixture.name, async sub => {
    const outputDir = join(root, String(index));
    let calls = 0;
    const run = await runArrangement({
      vacancy, employees: await createSeed(vacancy.date), outputDir, apiKey: 'test-only',
      replies: [{ employeeId: 'e2', text: '条件付きです。' }, { employeeId: 'e2', text: '条件付きです。' }, { employeeId: 'e2', text: '条件付きです。' }, { employeeId: 'e3', text: '全部入れます。' }],
      fetchImpl: async () => {
        if (fixture.fail && calls++ > 0) return new Response('untrusted error', { status: 429 });
        const result = fixture.responses.shift();
        assert.ok(result, '予定外の通信');
        return new Response(JSON.stringify({ model: 'mock/model',
          usage: fixture.noUsage ? undefined : { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30, cost_usd: 0.0001 },
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result) } }],
        }));
      },
    });
    assert.equal(run.record.status, fixture.status);
    const server = createViewServer({ recordsDir: outputDir });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    sub.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = `http://127.0.0.1:${server.address().port}`;
    const { files } = await (await fetch(base + '/api/arrangements')).json();
    assert.deepEqual(files, [run.record.processId + '.json']);
    const record = await (await fetch(base + '/api/arrangements/' + files[0])).json();
    assert.deepEqual(record, JSON.parse(await readFile(run.path, 'utf8')));
    const html = renderRecord(record);
    for (const expected of fixture.expected) assert.ok(html.includes(expected), expected);
    assert.ok(html.includes('disabled'));
    assert.ok(html.includes('weekly_hours_limit'));
    assert.equal(html.includes('確定済み'), false);
    const review = await (await fetch(base + '/api/review/' + files[0])).json();
    assert.equal(review.canApprove, fixture.status === 'filled');
    if (fixture.status === 'filled') {
      const { approvalToken } = await (await fetch(base + '/api/session')).json();
      const response = await fetch(base + '/api/approve/' + files[0], {
        method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'X-Approval-Token': approvalToken },
        body: JSON.stringify({ recordHash: review.recordHash }),
      });
      assert.equal(response.status, 200);
      const approved = await response.json();
      assert.equal(approved.approval.status, 'approved');
      assert.deepEqual(approved.approval.assignment, record.provisionalAssignment);
      assert.ok(renderRecord(record, { review: approved }).includes('承認済み（このPC）'));
      assert.deepEqual(JSON.parse(await readFile(run.path, 'utf8')), record);
    }
  });
});
