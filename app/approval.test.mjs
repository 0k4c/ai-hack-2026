import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approveArrangement, inspectArrangement } from '../src/approve-arrangement.mjs';
import { createViewServer } from './serve.mjs';
import { renderRecord } from './render.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const sample = JSON.parse(await readFile(new URL('./sample-arrangement.json', import.meta.url), 'utf8'));
function fixture(absentEmployeeId = 'e1', employeeId = 'e3', date = '2099-09-21', start = '18:00', end = '22:00') {
  const record = structuredClone(sample);
  delete record.isDisplaySample;
  record.vacancy = { absentEmployeeId, date, start, end };
  record.processId = digest(JSON.stringify(record.vacancy));
  record.provisionalAssignment = { employeeId, date, start, end };
  record.rounds.forEach(round => { round.offer = { date, start, end }; });
  record.rounds.at(-1).employeeId = employeeId;
  Object.assign(record.rounds.at(-1).action, { employeeId, start, end });
  return record;
}
async function save(recordsDir, record) {
  const path = join(recordsDir, record.processId + '.json');
  const bytes = JSON.stringify(record, null, 2) + '\n';
  await writeFile(path, bytes);
  return { recordsDir, record, path, processId: record.processId, expectedRecordHash: digest(bytes) };
}
async function setup(t, record = fixture()) {
  const recordsDir = await mkdtemp(join(tmpdir(), 'approval-test-'));
  t.after(() => rm(recordsDir, { recursive: true, force: true }));
  return save(recordsDir, record);
}

test('共通承認を画面表示でき、再読込と再承認で同じ記録を返す', async t => {
  const options = await setup(t);
  const before = await readFile(options.path);
  const initial = await inspectArrangement(options);
  assert.equal(initial.canApprove, true);
  assert.ok(renderRecord(options.record, { review: initial }).includes('id="approve" type="button"  aria'));
  const saved = await approveArrangement(options);
  const reloaded = await inspectArrangement(options);
  assert.deepEqual(reloaded.approval, saved.approval);
  assert.ok(renderRecord(options.record, { review: reloaded }).includes('承認済み（このPC）'));
  assert.equal((await approveArrangement(options)).created, false);
  assert.deepEqual(await readFile(options.path), before);
});

test('過去日・表示サンプルは共通処理で拒否する', async t => {
  const past = fixture('e1', 'e3', '2020-01-01');
  const sampleRecord = fixture(); sampleRecord.isDisplaySample = true;
  for (const record of [past, sampleRecord]) {
    const options = await setup(t, record);
    assert.equal((await inspectArrangement(options)).canApprove, false);
    await assert.rejects(approveArrangement(options), { code: 'not_approvable' });
  }
});

test('別の欠員への重複承認を、同時に要求しても1件しか保存しない', async t => {
  const a = await setup(t);
  const b = await save(a.recordsDir, fixture('e2', 'e3'));
  const results = await Promise.allSettled([approveArrangement(a), approveArrangement(b)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === 'not_approvable').length, 1);
  assert.equal((await readdir(join(a.recordsDir, 'approvals'))).length, 1);
});

test('既存承認を含めて週の労働時間を再判定する', async t => {
  const a = await setup(t, fixture('e1', 'e3', '2099-09-21', '00:00', '18:00'));
  await approveArrangement(a);
  const b = await save(a.recordsDir, fixture('e1', 'e3', '2099-09-22', '00:00', '18:00'));
  assert.equal((await inspectArrangement(b)).canApprove, false);
  await assert.rejects(approveArrangement(b), { code: 'not_approvable' });
});

test('既存承認を含めて連勤を再判定する', async t => {
  const a = await setup(t, fixture('e1', 'e3', '2099-09-18', '10:00', '11:00'));
  await approveArrangement(a);
  const b = await save(a.recordsDir, fixture('e1', 'e3', '2099-09-20', '10:00', '11:00'));
  await approveArrangement(b);
  const c = await save(a.recordsDir, fixture('e1', 'e3', '2099-09-21', '10:00', '11:00'));
  assert.equal((await inspectArrangement(c)).canApprove, false);
});

test('旧保存先の承認を無視して新しい承認を作らない', async t => {
  const options = await setup(t);
  await mkdir(join(options.recordsDir, '_approvals'));
  await writeFile(join(options.recordsDir, '_approvals', options.processId + '.json'), '{}');
  await assert.rejects(inspectArrangement(options), { code: 'legacy_approvals' });
  await assert.rejects(approveArrangement(options), { code: 'legacy_approvals' });
});

test('中断したロックを自動削除せず、古い承認・破損を拒否する', async t => {
  const options = await setup(t);
  await mkdir(join(options.recordsDir, 'approvals'));
  await mkdir(join(options.recordsDir, 'approvals', '.lock'));
  await assert.rejects(approveArrangement(options), { code: 'approval_busy' });
  await rm(join(options.recordsDir, 'approvals', '.lock'), { recursive: true });
  await approveArrangement(options);
  const other = await save(options.recordsDir, fixture('e2', 'e3'));
  await writeFile(join(options.recordsDir, 'approvals', options.processId + '.json'), '{broken');
  await assert.rejects(inspectArrangement(other), { code: 'invalid_approval' });
});

test('HTTP承認は同一Origin・セッショントークン・表示時のハッシュを要求する', async t => {
  const options = await setup(t);
  const server = createViewServer({recordsDir:options.recordsDir});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const filename = options.record.processId+'.json';
  const review = await (await fetch(base+'/api/review/'+filename)).json();
  const {approvalToken} = await (await fetch(base+'/api/session')).json();
  const body = JSON.stringify({recordHash:review.recordHash});
  const headers = {Origin:base,'Content-Type':'application/json','X-Approval-Token':approvalToken};
  const url = base+'/api/approve/'+filename;
  assert.equal((await fetch(url,{method:'POST',body})).status,403);
  assert.equal((await fetch(url,{method:'POST',body,headers:{...headers,Origin:'https://untrusted.example'}})).status,403);
  assert.equal((await fetch(url,{method:'POST',body,headers:{...headers,'X-Approval-Token':'wrong'}})).status,403);
  assert.equal((await fetch(url,{method:'POST',body:JSON.stringify({recordHash:'0'.repeat(64)}),headers})).status,409);
  assert.equal((await fetch(url,{method:'POST',body:JSON.stringify({recordHash:review.recordHash,employeeId:'e4'}),headers})).status,400);
  const result = await fetch(url,{method:'POST',body,headers});
  assert.equal(result.status,200);
  assert.equal((await result.json()).approval.status,'approved');
  const replay = await (await fetch(url,{method:'POST',body,headers})).json();
  assert.equal(replay.alreadyApproved,true);
  assert.equal((await (await fetch(base+'/api/review/'+filename)).json()).canApprove,false);
});
