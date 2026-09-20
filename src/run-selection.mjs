import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { filterCandidates } from './constraints.mjs';
import { selectWithOrca, SelectionError } from './orcarouter.mjs';

export async function runSelection({ employees, vacancy, outputDir, apiKey, model = 'orcarouter/auto', fetchImpl, timeoutMs }) {
  const started = Date.now();
  const filtering = filterCandidates(employees, vacancy);
  await mkdir(outputDir, { recursive: true });
  const record = {
    schemaVersion: 1, id: randomUUID(), createdAt: new Date().toISOString(), dataSource: 'synthetic_seed',
    vacancy, filtering, status: 'no_candidates', selection: null, requestedModel: model,
    requestId: null, actualModel: null, tokens: { prompt: null, completion: null, total: null },
    estimatedCostUsd: null, costSource: 'not_called', currency: 'USD', error: null,
  };
  if (filtering.candidates.length) {
    try {
      const result = await selectWithOrca({ vacancy, candidates: filtering.candidates, apiKey, model, fetchImpl, timeoutMs });
      Object.assign(record, result.telemetry, { status: 'selected', selection: result.selection });
    } catch (error) {
      if (!(error instanceof SelectionError)) throw error;
      Object.assign(record, { costSource: 'unavailable' }, error.telemetry, { status: 'failed', error: { code: error.code, message: error.message } });
    }
  }
  record.durationMs = Date.now() - started;
  const path = resolve(join(outputDir, `${record.id}.json`));
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return { record, path };
}
