import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createWorkforceStore, payrollPreview } from '../src/workforce.mjs';
import { createViewServer } from '../app/serve.mjs';
import { personName, recordLabel, friendlyText } from '../app/labels.mjs';
async function setup(t) {
 const recordsDir = await mkdtemp(join(tmpdir(),'workforce-'));
 t.after(()=>rm(recordsDir,{recursive:true,force:true}));
 const store = createWorkforceStore({recordsDir});
 const command = async (op,input)=>store.command(op,input,(await store.read()).revision);
 return {recordsDir,store,command};
}
const attendance = {employeeId:'e2',date:'2026-01-12',start:'09:00',end:'17:00',breakMinutes:60};
test('勤務予定→勤怠提出→承認→明細、再読込でも金額と根拠を維持する',async t=>{
 const {store,command,recordsDir}=await setup(t);
 await command('shift',((({breakMinutes,...rest})=>rest)(attendance)));
 assert.equal(payrollPreview(await store.read(),'e2','2026-01').grossYen,0);
 await command('rate',{employeeId:'e2',hourlyRate:1200});
 const pending=await command('attendance',attendance);
 assert.equal(payrollPreview(pending,'e2','2026-01').grossYen,0);
 await assert.rejects(command('payslip',{employeeId:'e2',month:'2026-01'}),/未承認/);
 await command('approve',{id:pending.attendance[0].id});
 await command('rate',{employeeId:'e2',hourlyRate:2000});
 const saved=await command('payslip',{employeeId:'e2',month:'2026-01'});
 assert.equal(saved.payslips[0].grossYen,8400);
 assert.equal(saved.payslips[0].lines[0].hourlyRate,1200);
 assert.deepEqual((await createWorkforceStore({recordsDir}).read()).payslips,saved.payslips);
 await assert.rejects(command('payslip',{employeeId:'e2',month:'2026-01'}),/作成済み/);
 await assert.rejects(command('return',{id:pending.attendance[0].id}),/変更できません/);
 await assert.rejects(command('attendance',{...attendance,date:'2026-01-13'}),/変更できません/);
});
test('月合計の分単位計算、端数は1回だけ切り上げる',async t=>{
 const {store,command}=await setup(t);
 await command('rate',{employeeId:'e2',hourlyRate:1001});
 for(const day of ['2026-01-10','2026-01-11']) {
  const s=await command('attendance',{...attendance,date:day,start:'09:00',end:'09:01',breakMinutes:0});
  await command('approve',{id:s.attendance.at(-1).id});
 }
 assert.equal(payrollPreview(await store.read(),'e2','2026-01').grossYen,34);
});
test('不正日時・休憩・未来・重複を拒否し、保存済み勤怠を壊さない',async t=>{
 const {store,command}=await setup(t);
 for(const invalid of [{date:'2026-02-30'},{start:'23:00'},{end:'24:00'},{breakMinutes:-1},{breakMinutes:480},{breakMinutes:1.5},{date:'2099-01-01'},{employeeId:'e99'}]) await assert.rejects(command('attendance',{...attendance,...invalid}));
 assert.equal((await store.read()).attendance.length,0);
 const s=await command('attendance',attendance);
 await assert.rejects(command('attendance',attendance),/重複/);
 await assert.rejects(command('approve',{id:s.attendance[0].id}),/時給/);
 await command('remove-attendance',{id:s.attendance[0].id});
 assert.equal((await store.read()).corrections.length,1);
});
test('古い画面・同時保存・団体を跨ぐID操作を拒否する',async t=>{
 const {store,command,recordsDir}=await setup(t);
 const results=await Promise.allSettled([store.command('attendance',attendance,0),store.command('attendance',attendance,0)]);
 assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
 const other=createWorkforceStore({recordsDir,organization:'other'});
 assert.equal((await other.read()).attendance.length,0);
 const id=(await store.read()).attendance[0].id;
 await assert.rejects(other.command('approve',{id},0),/見つかりません/);
 await assert.rejects(command('rate',{employeeId:'e2',hourlyRate:1000,organization:'other'}),/入力項目/);
 assert.throws(()=>createWorkforceStore({recordsDir,organization:'../other'}));
});
test('表示は勤務日時・氏名で、AI説明文中のIDも氏名にする',()=>{
 assert.equal(personName('e2'),'佐藤'); assert.equal(personName('unknown'),'氏名未登録');
 assert.match(recordLabel({vacancy:{date:'2026-01-12',start:'09:00',end:'17:00',absentEmployeeId:'e1'}}),/田中さんの欠勤対応/);
 assert.equal(friendlyText('e2とe3はeligible。remainingRoundsもある。'),'佐藤と鈴木は勤務条件を満たす。残りの打診回数もある。');
});
test('勤務管理HTTPはtoken・originを必須にし、保存ファイルを公開しない',async t=>{
 const {recordsDir}=await setup(t); const server=createViewServer({recordsDir});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const base=`http://127.0.0.1:${server.address().port}`;
 const {approvalToken}=await (await fetch(base+'/api/session')).json();
 const payload={revision:0,input:attendance};
 assert.equal((await fetch(base+'/api/workforce/attendance',{method:'POST',body:JSON.stringify(payload)})).status,403);
 const headers={Origin:base,'Content-Type':'application/json','X-Approval-Token':approvalToken};
 assert.equal((await fetch(base+'/api/workforce/attendance',{method:'POST',headers,body:JSON.stringify(payload)})).status,200);
 assert.equal((await fetch(base+'/api/workforce/attendance',{method:'POST',headers,body:JSON.stringify(payload)})).status,409);
 assert.equal((await fetch(base+'/workforce')).status,200);
 assert.equal((await fetch(base+'/workforce/demo/state.json')).status,404);
 const saved=JSON.parse(await readFile(join(recordsDir,'workforce/demo/state.json'),'utf8'));
 assert.equal(saved.attendance.length,1);
});
test('承認した代打だけを一度取り込み、別団体には取り込まない',async t=>{
 const {store,command,recordsDir}=await setup(t);
 const {runArrangement}=await import('../src/run-arrangement.mjs');
 const {createSeed}=await import('../src/seed.mjs');
 const {approveArrangement}=await import('../src/approve-arrangement.mjs');
 const vacancy={absentEmployeeId:'e1',date:'2099-09-21',start:'18:00',end:'22:00'};
 const outputs=[{employeeId:'e2',reason:'候補です。'},{interpretation:{kind:'accepted',summary:'全時間受諾。'},action:{type:'hold',employeeId:'e2',start:'18:00',end:'22:00',reason:'承認待ち。'}}];
 const {record}=await runArrangement({employees:await createSeed(vacancy.date),vacancy,replies:[{employeeId:'e2',text:'全部入れます。'}],outputDir:recordsDir,apiKey:'test-only',fetchImpl:async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(outputs.shift())}}]}))});
 await assert.rejects(command('import',{processId:record.processId}),/先に/);
 const review=await (await import('../src/approve-arrangement.mjs')).inspectArrangement({recordsDir,processId:record.processId});
 await approveArrangement({recordsDir,processId:record.processId,expectedRecordHash:review.recordHash});
 await command('import',{processId:record.processId});
 await assert.rejects(command('import',{processId:record.processId}),/取り込み済み/);
 assert.equal((await store.read()).shifts.length,1);
 const other=createWorkforceStore({recordsDir,organization:'other'});
 await assert.rejects(other.command('import',{processId:record.processId},0),/別の団体/);
});
