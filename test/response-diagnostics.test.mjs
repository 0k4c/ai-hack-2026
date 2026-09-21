import test from 'node:test';
import assert from 'node:assert/strict';
import { requestInterpretation, selectWithOrca } from '../src/orcarouter.mjs';
const response = (content, finish_reason = 'stop') => new Response(JSON.stringify({model:'test/model',choices:[{finish_reason,message:{content}}]}));
test('不正な本文は内容を保存せず構造・終了理由・長さを記録する', async () => {
 const content='田中 secret@example.com sk-orca-SECRET\n```json\n{"reason":"秘密"}\n``` trailing';
 await assert.rejects(requestInterpretation({apiKey:'dummy',messages:[],fetchImpl:async()=>response(content)}), error=>{
  assert.equal(error.code,'invalid_interpretation');
  const d=error.telemetry.responseDiagnostics;
  assert.equal(d.finishReason,'stop'); assert.equal(d.contentLength,content.length);
  assert.match(d.contentShape,/```/); assert.doesNotMatch(JSON.stringify(d),/田中|secret@|sk-orca|SECRET|秘密/);
  return true;
 });
});
test('途中終了の形式診断も保存し、本文抜粋は2000文字以内', async()=>{
 await assert.rejects(requestInterpretation({apiKey:'dummy',messages:[],fetchImpl:async()=>response('a'.repeat(9000),'length')}),error=>{
  assert.equal(error.code,'output_limit'); assert.equal(error.telemetry.responseDiagnostics.contentShape.length,2000);
  assert.equal(error.telemetry.responseDiagnostics.truncated,true); return true;
 });
});
test('選定エラーにも同じ形式診断を保存する',async()=>{
 await assert.rejects(selectWithOrca({apiKey:'dummy',vacancy:{},candidates:[],fetchImpl:async()=>response('not JSON')}),error=>{
  assert.equal(error.code,'invalid_selection'); assert.equal(error.telemetry.responseDiagnostics.jsonValid,false); return true;
 });
});
