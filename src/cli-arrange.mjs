import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { addDays, dateNumber } from './constraints.mjs';
import { createSeed } from './seed.mjs';
import { runArrangement } from './run-arrangement.mjs';

try {
  const { values } = parseArgs({ options: {
    date: { type: 'string' }, absent: { type: 'string', default: 'e1' },
    start: { type: 'string', default: '18:00' }, end: { type: 'string', default: '22:00' },
    replies: { type: 'string' }, output: { type: 'string', default: 'output/arrangements' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('npm run arrange -- [--date YYYY-MM-DD] [--absent e1] [--start HH:MM] [--end HH:MM] [--replies file.json] [--output directory]\n架空の欠員を最大3巡で手配。送信はdryrun、受諾後も店長承認待ちです。既定は日本時間の翌日18〜22時。');
  } else {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const date = values.date ?? addDays(today, 1);
    dateNumber(date);
    if (date < today) throw new Error('過去の日付は指定できません。');
    const replies = JSON.parse((await readFile(values.replies ?? new URL('../data/replies.example.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
    const { record, path, duplicate } = await runArrangement({ employees: await createSeed(date),
      vacancy: { absentEmployeeId: values.absent, date, start: values.start, end: values.end }, replies,
      outputDir: values.output, apiKey: process.env.ORCAROUTER_API_KEY, model: process.env.ORCAROUTER_MODEL || 'orcarouter/auto' });
    if (duplicate) console.log('同じ欠員の記録があるため再実行・再打診しません。');
    console.log(`結果: ${record.status} (${record.stopReason ?? '処理中'})\n承認状態: ${record.approvalStatus}（勤務確定は行いません）\n打診: dryrun / ${record.rounds.length}巡`);
    console.log(`合計トークン: ${record.totalTokens.total ?? '不明'}\n概算費用(USD): ${record.totalEstimatedCostUsd ?? '不明'}\n所要時間(ms): ${record.totalDurationMs}\n記録: ${path}`);
    if (record.error) console.error(record.error.message);
    if (record.status === 'failed' || record.status === 'pending') process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
