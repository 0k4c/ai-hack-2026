import test from 'node:test';
import assert from 'node:assert/strict';
import { readResponse } from './read-response.mjs';
test('旧保存先などの承認APIの説明を失わず表示側へ渡す',async()=>{
 const message='旧形式の承認記録があります。保存先を確認してください。';
 await assert.rejects(readResponse(new Response(JSON.stringify({error:message,code:'legacy_approvals'}),{status:409})),{message});
});
test('JSONでない応答や内部の短いコードは利用者向けの取得エラーにする',async()=>{
 for(const body of ['<html>proxy error</html>',JSON.stringify({error:'unreadable_record'})]) {
  await assert.rejects(readResponse(new Response(body,{status:500})),/一覧を更新/);
 }
});
test('成功した記録はそのまま返す',async()=>{
 assert.deepEqual(await readResponse(new Response(JSON.stringify({record:{status:'filled'}}))),{record:{status:'filled'}});
});
