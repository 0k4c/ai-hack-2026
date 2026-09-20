import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { runInterpretation } from './run-interpretation.mjs';

try {
  const { values } = parseArgs({ options: {
    text: { type: 'string' }, employee: { type: 'string' }, 'reference-date': { type: 'string' },
    input: { type: 'string' }, output: { type: 'string', default: 'output/interpretations' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('npm run interpret -- [--text "希望文" --employee e1 --reference-date YYYY-MM-DD | --input file.json] [--output directory]\n指定なし: data/preference.example.jsonを1件解釈。基準日なしの場合、相対日付は未確定として扱います。');
  } else {
    if (values.input !== undefined && (values.text !== undefined || values.employee !== undefined || values['reference-date'] !== undefined)) throw new Error('--inputと--text/--employee/--reference-dateは同時に指定できません。');
    if (values.text === undefined && (values.employee !== undefined || values['reference-date'] !== undefined)) throw new Error('--employee/--reference-dateには--textも指定してください。');
    const input = values.text !== undefined
      ? { employeeId: values.employee ?? 'e1', text: values.text, referenceDate: values['reference-date'] ?? null }
      : JSON.parse((await readFile(values.input ?? new URL('../data/preference.example.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
    const { record, path } = await runInterpretation({ input, outputDir: values.output,
      apiKey: process.env.ORCAROUTER_API_KEY, model: process.env.ORCAROUTER_MODEL || 'orcarouter/auto' });
    if (record.status === 'interpreted') {
      console.log(`解釈: ${record.interpretation.summary}`);
      console.log(`あいまい箇所: ${record.ambiguities.length}件`);
      for (const ambiguity of record.ambiguities) console.log(`- ${ambiguity.sourceText}: ${ambiguity.reason}`);
      console.log(`実モデル: ${record.actualModel ?? '不明'}\nトークン: ${record.tokens.total ?? '不明'}\n概算費用(USD): ${record.estimatedCostUsd ?? '不明'}`);
    } else {
      console.error(record.error.message);
      process.exitCode = 1;
    }
    console.log(`記録: ${path}`);
  }
} catch (error) {
  // JSON parsing errors can include the original text; keep raw input out of diagnostics.
  console.error(error instanceof SyntaxError ? '入力ファイルは有効なJSONにしてください。' : error.message);
  process.exitCode = 1;
}
