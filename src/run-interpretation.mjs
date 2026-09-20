import { randomUUID } from 'node:crypto';
import { mkdir, open, writeFile, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { validateInput, redactNames, SYSTEM_PROMPT, validateInterpretation } from './preferences.mjs';
import { requestInterpretation, InterpretationError } from './orcarouter.mjs';

export async function runInterpretation({ input, outputDir, apiKey, model = 'orcarouter/auto', fetchImpl, timeoutMs }) {
  const normalized = validateInput(input);
  const started = Date.now();
  const record = {
    schemaVersion: 1, id: randomUUID(), createdAt: new Date().toISOString(),
    employeeId: normalized.employeeId, originalText: normalized.text,
    context: { referenceDate: normalized.referenceDate, timeZone: 'Asia/Tokyo', weekStartsOn: 'monday' },
    status: 'pending', interpretation: null, ambiguities: null, requiresClarification: null,
    requestedModel: model, actualModel: null, requestId: null,
    tokens: { prompt: null, completion: null, total: null }, estimatedCostUsd: null,
    costSource: 'not_called', currency: 'USD', error: null,
  };
  await mkdir(outputDir, { recursive: true });
  const path = resolve(join(outputDir, `${record.id}.json`));
  // Confirm the destination is writable and retain the submitted text before a paid request.
  const file = await open(path, 'wx', 0o600);
  try { await file.writeFile(`${JSON.stringify(record, null, 2)}\n`); } finally { await file.close(); }
  try {
    const maskedText = redactNames(normalized.text);
    const { result, telemetry } = await requestInterpretation({
      apiKey, model, fetchImpl, timeoutMs,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ employeeId: normalized.employeeId, text: maskedText, ...record.context }) },
      ],
    });
    Object.assign(record, telemetry);
    try { validateInterpretation(result, maskedText); } catch {
      throw new InterpretationError('invalid_interpretation', 'AIの解釈の形式や未確定理由が不正です。', telemetry);
    }
    Object.assign(record, { status: 'interpreted', interpretation: result.interpretation, ambiguities: result.ambiguities, requiresClarification: result.ambiguities.length > 0 });
  } catch (error) {
    if (!(error instanceof InterpretationError)) throw error;
    Object.assign(record, { costSource: 'unavailable' }, error.telemetry, { status: 'failed', error: { code: error.code, message: error.message } });
  }
  record.durationMs = Date.now() - started;
  // Stage the final JSON before replacing the pending record; interruption leaves a valid pending JSON.
  await writeFile(`${path}.tmp`, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await rename(`${path}.tmp`, path);
  return { record, path };
}
