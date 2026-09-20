import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approveRecord, approvalReason, recordHash, reviewRecord } from './approval.mjs';
import { createViewServer } from './serve.mjs';
import { renderRecord } from './render.mjs';

const sample = JSON.parse(await readFile(new URL('./sample-arrangement.json', import.meta.url), 'utf8'));
function fixture(absentEmployeeId = 'e1', employeeId = 'e3') {
  const record = structuredClone(sample);
  delete record.isDisplaySample;
  record.vacancy = { absentEmployeeId, date:'2099-09-21', start:'18:00', end:'22:00' };
  record.processId = recordHash(record.vacancy);
  record.provisionalAssignment = { employeeId, date:'2099-09-21', start:'18:00', end:'22:00' };
  record.rounds.forEach(round => { round.offer.date = '2099-09-21'; });
  record.rounds.at(-1).employeeId = employeeId;
  record.rounds.at(-1).action.employeeId = employeeId;
  return record;
}
async function setup(t, record = fixture()) {
  const recordsDir = await mkdtemp(join(tmpdir(), 'approval-test-'));
  t.after(() => rm(recordsDir, { recursive:true, force:true }));
  const path = join(recordsDir, record.processId + '.json');
  await writeFile(path, JSON.stringify(record));
  return { recordsDir, record, path, expectedHash:recordHash(record), loadRecord:async () => JSON.parse(await readFile(path, 'utf8')) };
}

test('承認を別JSONへ永続保存し、再読込と二重承認でも同じ記録を返す', async t => {
  const options = await setup(t);
  const before = await readFile(options.path, 'utf8');
  const initial = await reviewRecord(options.record, options.recordsDir);
  assert.equal(initial.canApprove, true);
  assert.ok(renderRecord(options.record, {review:initial}).includes('id="approve" type="button"  aria'));
  const saved = await approveRecord(options);
  assert.equal(saved.approval.status, 'approved');
  assert.equal(saved.alreadyApproved, false);
  assert.equal(saved.canApprove, false);
  const reloaded = await reviewRecord(options.record, options.recordsDir);
  assert.deepEqual(reloaded.approval, saved.approval);
  assert.ok(renderRecord(options.record, {review:reloaded}).includes('承認済み（このPC）'));
  assert.equal((await approveRecord(options)).alreadyApproved, true);
  assert.equal(await readFile(options.path, 'utf8'), before);
  assert.deepEqual(await readdir(join(options.recordsDir, '_approvals')), [options.record.processId + '.json']);
});

test('同時承認でも承認記録は1件だけで、途中の書き込みを上書きしない', async t => {
  const options = await setup(t);
  const results = await Promise.allSettled([approveRecord(options), approveRecord(options)]);
  assert.ok(results.some(result => result.status === 'fulfilled'));
  assert.equal(results.filter(result => result.status === 'fulfilled' && !result.value.alreadyApproved).length, 1);
  assert.deepEqual(await readdir(join(options.recordsDir, '_approvals')), [options.record.processId + '.json']);
  assert.equal((await approveRecord(options)).alreadyApproved, true);
});

test('表示後の変更、部分受諾、過去日、偽の処理ID、サンプル、失敗記録を拒否する', async t => {
  const options = await setup(t);
  await assert.rejects(approveRecord({...options,expectedHash:'0'.repeat(64)}), /更新/);
  for (const mutate of [
    record => { record.status = 'failed'; },
    record => { record.isDisplaySample = true; },
    record => { record.processId = '0'.repeat(64); },
    record => { record.provisionalAssignment.end = '20:00'; },
    record => { record.rounds.at(-1).interpretation.kind = 'conditional'; },
    record => { record.vacancy.date = '2020-01-01'; record.processId = recordHash(record.vacancy); },
  ]) {
    const record = fixture(); mutate(record);
    assert.ok(approvalReason(record));
    await assert.rejects(approveRecord({...options,expectedHash:recordHash(record),loadRecord:async () => record}));
  }
  assert.deepEqual(await readdir(join(options.recordsDir, '_approvals')), []);
});

test('コードで制約を再確認し、同一人物の別欠員への重複勤務を拒否する', async t => {
  const options = await setup(t);
  const ineligible = fixture('e1','e4');
  await assert.rejects(approveRecord({...options,expectedHash:recordHash(ineligible),loadRecord:async () => ineligible}), /勤務条件/);
  await approveRecord(options);
  const overlapping = fixture('e2','e3');
  await assert.rejects(approveRecord({...options,expectedHash:recordHash(overlapping),loadRecord:async () => overlapping}), /勤務条件/);
});

test('承認後の改変・破損・中断後のロックは自動で承認扱いにしない', async t => {
  const options = await setup(t);
  await approveRecord(options);
  const changed = fixture(); changed.selection.reason = 'changed';
  await assert.rejects(reviewRecord(changed, options.recordsDir), /元の記録/);
  await writeFile(join(options.recordsDir,'_approvals',options.record.processId+'.json'), '{broken');
  await assert.rejects(reviewRecord(options.record, options.recordsDir), /壊れて/);
  await mkdir(join(options.recordsDir,'_approvals','.lock'));
  await assert.rejects(approveRecord(options), /処理中/);
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
