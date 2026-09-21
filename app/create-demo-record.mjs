// Offline rehearsal only: run the real arrangement code with fixed HTTP replies.
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { addDays, dateNumber } from '../src/constraints.mjs';
import { createSeed } from '../src/seed.mjs';
import { runArrangement } from '../src/run-arrangement.mjs';

export async function createDemoRecord({ date, outputDir }) {
  dateNumber(date);
  const vacancy = { absentEmployeeId: 'e1', date, start: '18:00', end: '22:00' };
  const replies = [
    { employeeId: 'e2', text: 'その日は用事があって無理です。' },
    { employeeId: 'e3', text: '18時から22時まで、全部入れます。' },
  ];
  const responses = [
    { employeeId: 'e2', reason: '【通信モック】追加後の週時間が4時間で、鈴木の8時間より少ないため佐藤を選びます。' },
    { interpretation: { kind: 'declined', summary: '【通信モック】佐藤は提示日の勤務を辞退しています。' },
      action: { type: 'next_candidate', employeeId: 'e3', start: '18:00', end: '22:00', reason: '【通信モック】佐藤が辞退したため、勤務条件を満たす鈴木へ打診します。' } },
    { interpretation: { kind: 'accepted', summary: '【通信モック】鈴木は提示された全時間帯を受諾しています。' },
      action: { type: 'hold', employeeId: 'e3', start: '18:00', end: '22:00', reason: '【通信モック】全時間帯を受諾したため仮押さえし、店長の承認を待ちます。' } },
  ];
  let calls = 0;
  const result = await runArrangement({ vacancy, replies, employees: await createSeed(date), outputDir,
    apiKey: 'offline-demo-placeholder', model: 'mock/offline-rehearsal',
    fetchImpl: async () => {
      if (calls >= responses.length) throw new Error('予定外のモック呼び出し');
      return new Response(JSON.stringify({ model: 'mock/offline-rehearsal',
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(responses[calls++]) } }],
      }));
    },
  });
  if (result.record.status !== 'filled') throw new Error('撮影用の承認待ち記録を作れませんでした。');
  return { ...result, mockCalls: calls };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { date: { type: 'string' }, output: { type: 'string' } } });
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
    const date = values.date ?? addDays(today, 1);
    if (date < today) throw new Error('承認操作の撮影には当日以降の日付を指定してください。');
    const outputDir = values.output ?? `output/playwright/demo-${randomUUID()}`;
    const result = await createDemoRecord({ date, outputDir });
    console.log('通信モックによる架空データのデモ。実API・外部送信・課金はありません。');
    console.log(`欠員: ${date} 18:00–22:00 / 田中（架空）`);
    console.log(`状態: ${result.record.status} / ${result.record.rounds.length}巡 / モック呼出し: ${result.mockCalls}`);
    console.log('費用・トークンは実測していないため不明です。所要時間はローカル処理時間です。');
    console.log(`記録フォルダ: ${outputDir}\n処理ID: ${result.record.processId}`);
    console.log(`表示: node app/serve.mjs --records "${outputDir}"`);
    if (result.duplicate) console.log('既存記録を再利用しました。承認済みの場合は新しい出力フォルダを使ってください。');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
