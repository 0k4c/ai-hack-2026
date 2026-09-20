import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSeed } from './seed.mjs';
import { filterCandidates } from './constraints.mjs';
import { selectWithOrca, requestInterpretation, SelectionError, InterpretationError } from './orcarouter.mjs';
import { SYSTEM_PROMPT, redactNames, validateInput, validateInterpretation } from './preferences.mjs';

export const DEFAULT_MODELS = ['orcarouter/auto', 'orcarouter/free', 'google/gemini-2.5-flash'];
const DEFAULT_OUTPUT = 'output/selections/model-comparisons'; // Already excluded by .gitignore.
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const metric = values => {
  const known = values.filter(value => typeof value === 'number' && Number.isFinite(value));
  return { count: values.length, knownCount: known.length,
    mean: known.length === values.length && known.length ? known.reduce((a,b) => a+b,0) / known.length : null,
    min: known.length === values.length && known.length ? Math.min(...known) : null,
    max: known.length === values.length && known.length ? Math.max(...known) : null };
};

export async function comparisonInputs() {
  const vacancy = { absentEmployeeId: 'e1', date: '2026-09-21', start: '18:00', end: '22:00' };
  const { candidates } = filterCandidates(await createSeed(vacancy.date), vacancy);
  const input = validateInput({ employeeId: 'e2', text: '2026年9月21日は18時から22時まで入れます。', referenceDate: '2026-09-20' });
  const source = redactNames(input.text);
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: JSON.stringify({
    employeeId: input.employeeId, text: source, referenceDate: input.referenceDate, timeZone: 'Asia/Tokyo', weekStartsOn: 'monday',
  }) }];
  return { selection: { vacancy, candidates }, interpretation: { source, messages } };
}

export function validateOptions({ models, repeats }) {
  if (!Array.isArray(models) || !models.length || models.length > 4 || new Set(models).size !== models.length ||
      models.some(model => typeof model !== 'string' || !/^[a-zA-Z0-9._:/-]+$/.test(model) || model.length > 200)) {
    throw new Error('モデルは重複なしの1〜4個のモデルIDを指定してください。');
  }
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3) throw new Error('繰り返し回数は1〜3を指定してください。');
}

export function summarize(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.task, row.requestedModel]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].map(group => ({ task: group[0].task, requestedModel: group[0].requestedModel,
    attempts: group.length, httpAttempts: group.filter(row => row.apiCalled).length,
    validResults: group.filter(row => row.status === 'succeeded').length,
    failedResults: group.filter(row => row.status === 'failed').length,
    actualModels: [...new Set(group.map(row => row.actualModel).filter(Boolean))],
    durationMs: metric(group.map(row => row.durationMs)), tokens: metric(group.map(row => row.tokens.total)),
    estimatedCostUsd: metric(group.map(row => row.estimatedCostUsd)),
  }));
}

const cell = value => String(value ?? '不明').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;').replace(/[\r\n]+/g, ' ');
const cost = value => value == null ? '不明' : Number(value.toPrecision(10)).toString();
export function comparisonMarkdown(report) {
  const rows = report.rows.map(row => `| ${row.task} | ${cell(row.requestedModel)} | ${row.repeat} | ${cell(row.actualModel)} | ${row.status} | ${cell(row.durationMs)} | ${cell(row.tokens.total)} | ${cost(row.estimatedCostUsd)} | 未記入 |`).join('\n');
  const summary = report.summary.map(group => `| ${group.task} | ${cell(group.requestedModel)} | ${group.validResults}/${group.attempts} | ${cell(group.durationMs.mean)} | ${cell(group.durationMs.min)}–${cell(group.durationMs.max)} | ${cell(group.tokens.mean)} | ${cost(group.estimatedCostUsd.mean)} |`).join('\n');
  return `# モデル比較 ${report.id}\n\n状態: ${report.status} / 実行日時: ${report.createdAt}\n入力SHA-256: ${report.inputHash}\n\nsucceededは形式検証の成功であり、品質の採点ではありません。所見は人が記入します。費用は応答時点の概算USDで、確定請求ではありません。欠損は不明とし、失敗した呼び出しも集計に含めます。\n\n| 機能 | 要求モデル | 回 | 実モデル | 状態 | 時間ms | 総トークン | 概算USD | 人の所見 |\n| --- | --- | ---: | --- | --- | ---: | ---: | ---: | --- |\n${rows}\n\n## 集計\n\n平均・最小・最大は全試行で値を取得できた場合だけ表示します。JSONには項目ごとの取得件数も保存します。\n\n| 機能 | 要求モデル | 形式検証成功/試行 | 平均ms | 最小–最大ms | 平均トークン | 平均概算USD |\n| --- | --- | ---: | ---: | --- | ---: | ---: |\n${summary}\n\n回答の全文、要求入力、HTTP状態、Fallbackヘッダー、人の所見用の空欄は同名のJSONを参照してください。\n`;
}

export async function runComparison({ models = DEFAULT_MODELS, repeats = 3, apiKey, outputDir = DEFAULT_OUTPUT,
  fetchImpl = fetch, onProgress = () => {} } = {}) {
  validateOptions({ models, repeats });
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('ORCAROUTER_API_KEYを.envに設定してください。キー未設定のため通信していません。');
  const inputs = await comparisonInputs();
  const report = { schemaVersion: 1, id: randomUUID(), createdAt: new Date().toISOString(), status: 'running',
    dataSource: 'synthetic_seed', models: [...models], repeats, plannedCalls: models.length * repeats * 2,
    inputHash: digest(inputs), inputs, rows: [], summary: [], currency: 'USD',
    qualityReview: '人が回答と入力を比較する。AIは採点しない。',
  };
  await mkdir(outputDir, { recursive: true });
  const path = resolve(outputDir, report.id + '.json');
  await writeFile(path, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const save = async () => {
    report.summary = summarize(report.rows);
    const temporary = path + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(temporary, path);
  };
  // Rotate model order each repeat to reduce always-first ordering effects.
  for (let repeat = 1; repeat <= repeats; repeat++) {
    const offset = (repeat - 1) % models.length;
    const order = [...models.slice(offset), ...models.slice(0, offset)];
    for (const model of order) for (const task of ['selection', 'interpretation']) {
      const row = { task, repeat, requestedModel: model, inputHash: digest(inputs[task]), status: 'pending', apiCalled: false,
        actualModel: null, requestId: null, tokens: { prompt: null, completion: null, total: null },
        estimatedCostUsd: null, costSource: 'not_called', durationMs: null, httpStatus: null,
        fallbackModel: null, result: null, error: null, humanReview: { reviewer: null, verdict: null, notes: null } };
      report.rows.push(row);
      // Save intent before the paid request. An interrupted pending row is never silently retried.
      await save();
      const started = performance.now();
      const trackedFetch = async (...args) => {
        row.apiCalled = true;
        const response = await fetchImpl(...args);
        row.httpStatus = response.status;
        row.fallbackModel = response.headers.get('x-orca-fallback-model');
        return response;
      };
      try {
        if (task === 'selection') {
          const value = await selectWithOrca({ ...inputs.selection, apiKey, model, fetchImpl: trackedFetch });
          Object.assign(row, value.telemetry, { result: value.selection });
        } else {
          const value = await requestInterpretation({ messages: inputs.interpretation.messages, apiKey, model, fetchImpl: trackedFetch });
          Object.assign(row, value.telemetry, { result: value.result });
          try { validateInterpretation(value.result, inputs.interpretation.source); }
          catch { throw new InterpretationError('invalid_interpretation', '希望文の解釈が形式検証に失敗しました。', value.telemetry); }
        }
        row.status = 'succeeded';
      } catch (error) {
        row.costSource = row.apiCalled ? 'unavailable' : 'not_called';
        if (error instanceof SelectionError || error instanceof InterpretationError) {
          Object.assign(row, error.telemetry);
          row.error = { code: error.code, message: error.message };
        } else row.error = { code: 'unexpected_error', message: '比較処理で予期しないエラーが発生しました。' };
        row.status = 'failed';
      }
      row.durationMs = Math.round(performance.now() - started);
      await save();
      onProgress({ completed: report.rows.length, total: report.plannedCalls, task, model, status: row.status });
      // A rejected key is common to the entire matrix: stop, rather than spend 18 failed calls.
      if ([401,403].includes(row.httpStatus)) {
        report.status = 'stopped_authentication';
        await save();
        const markdownPath = path.replace(/\.json$/, '.md');
        await writeFile(markdownPath, comparisonMarkdown(report), { flag: 'wx', mode: 0o600 });
        return { report, path, markdownPath };
      }
    }
  }
  report.status = report.rows.some(row => row.status === 'failed') ? 'completed_with_errors' : 'completed';
  report.finishedAt = new Date().toISOString();
  await save();
  const markdownPath = path.replace(/\.json$/, '.md');
  await writeFile(markdownPath, comparisonMarkdown(report), { flag: 'wx', mode: 0o600 });
  return { report, path, markdownPath };
}

export function parseArgs(args, env = process.env) {
  const options = { models: [...DEFAULT_MODELS], repeats: 3, outputDir: DEFAULT_OUTPUT, plan: false, help: false };
  let configured = false;
  let explicitModels = false;
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (seen.has(arg)) throw new Error('同じオプションは1回だけ指定してください。');
    seen.add(arg);
    if (arg === '--help') options.help = true;
    else if (arg === '--plan') options.plan = true;
    else if (arg === '--configured') configured = true;
    else if (['--models', '--repeats', '--output'].includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('オプションの値が不足しています。');
      if (arg === '--models') { options.models = value.split(','); explicitModels = true; }
      if (arg === '--repeats') options.repeats = Number(value);
      if (arg === '--output') options.outputDir = value;
    } else throw new Error('不明なオプションです。--helpで使い方を確認してください。');
  }
  if (configured && explicitModels) throw new Error('--configuredと--modelsは併用できません。');
  if (configured) {
    if (!env.ORCAROUTER_MODEL?.trim()) throw new Error('--configuredにはORCAROUTER_MODELの設定が必要です。');
    options.models = [env.ORCAROUTER_MODEL.trim()];
  }
  validateOptions(options);
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log('使い方: node --env-file-if-exists=.env src/compare-models.mjs [--plan] [--models ID,ID | --configured] [--repeats 1〜3] [--output DIR]\n既定は3モデル×3回×2機能=18回。--planは通信なし。--configuredはORCAROUTER_MODELだけを使用。');
    else if (options.plan) console.log(JSON.stringify({ ...options, plannedCalls: options.models.length * options.repeats * 2, inputs: await comparisonInputs() }, null, 2));
    else {
      const result = await runComparison({ ...options, apiKey: process.env.ORCAROUTER_API_KEY,
        onProgress: info => console.log(`${info.completed}/${info.total} ${info.task} ${info.model}: ${info.status}`) });
      console.log(`状態: ${result.report.status}\nJSON: ${result.path}\n表: ${result.markdownPath}`);
      if (result.report.status !== 'completed') process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
