import { parseArgs } from 'node:util';
import { addDays, dateNumber } from './constraints.mjs';
import { createSeed } from './seed.mjs';
import { runSelection } from './run-selection.mjs';

try {
  const { values } = parseArgs({ options: {
    date: { type: 'string' }, output: { type: 'string', default: 'output/selections' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('npm run select -- [--date YYYY-MM-DD] [--output directory]\n架空の6人から、指定日（既定: 日本時間の翌日）18:00–22:00の田中(e1)の代打を1人選びます。');
  } else {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const date = values.date ?? addDays(today, 1);
    dateNumber(date);
    if (date < today) throw new Error('過去の日付は指定できません。');
    const vacancy = { absentEmployeeId: 'e1', date, start: '18:00', end: '22:00' };
    const employees = await createSeed(date);
    const { record, path } = await runSelection({ employees, vacancy, outputDir: values.output,
      apiKey: process.env.ORCAROUTER_API_KEY, model: process.env.ORCAROUTER_MODEL || 'orcarouter/auto' });
    if (record.selection) {
      const employee = employees.find(e => e.id === record.selection.employeeId);
      console.log(`選定: ${employee.name} (${employee.id})\n理由: ${record.selection.reason}`);
      console.log(`実モデル: ${record.actualModel ?? '不明'}\nトークン: ${record.tokens.total ?? '不明'}\n概算費用(USD): ${record.estimatedCostUsd ?? '不明'}`);
    } else {
      console.log(record.error?.message ?? '候補がいません。店長の確認が必要です。');
    }
    console.log(`記録: ${path}`);
    if (record.status === 'failed') process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
