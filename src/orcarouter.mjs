export class InterpretationError extends Error {
  constructor(code, message, telemetry = {}) {
    super(message);
    this.code = code;
    this.telemetry = telemetry;
  }
}

const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

export function responseTelemetry(response, body) {
  const model = response.headers.get('x-orca-fallback-model') || response.headers.get('x-orca-resolved-model') || body?.model;
  const actualModel = typeof model === 'string' && model.trim() && !model.startsWith('orcarouter/') ? model : null;
  const usage = body?.usage;
  const cost = usage?.cost_usd;
  const estimatedCostUsd = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null;
  return {
    requestId: response.headers.get('x-orca-request-id'), actualModel,
    tokens: { prompt: count(usage?.prompt_tokens), completion: count(usage?.completion_tokens), total: count(usage?.total_tokens) },
    estimatedCostUsd, costSource: estimatedCostUsd === null ? 'unavailable' : 'orcarouter_inline_usage',
  };
}

// No retries: one user submission creates at most one inference request.
export async function requestInterpretation({ messages, apiKey, model = 'orcarouter/auto', fetchImpl = fetch, timeoutMs = 60_000 }) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new InterpretationError('configuration_error', 'ORCAROUTER_API_KEYを.envに設定してください。');
  if (typeof model !== 'string' || !model.trim()) throw new InterpretationError('configuration_error', 'ORCAROUTER_MODELが空です。');
  let telemetry = {};
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetchImpl('https://api.orcarouter.ai/v1/chat/completions', {
      method: 'POST', redirect: 'error', signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-OrcaRouter-Include-Cost': 'true' },
      body: JSON.stringify({ model, stream: false, max_tokens: 4096, messages }),
    });
    telemetry = responseTelemetry(response, null);
    if (!response.ok) throw new InterpretationError('api_error', `OrcaRouterへの接続に失敗しました（HTTP ${response.status}）。`, telemetry);
    let body;
    try { body = await response.json(); } catch {
      if (signal.aborted) throw signal.reason;
      throw new InterpretationError('invalid_response', 'APIの応答がJSONではありません。', telemetry);
    }
    telemetry = responseTelemetry(response, body);
    const choice = body?.choices?.[0];
    if (choice?.finish_reason === 'length') throw new InterpretationError('output_limit', 'AIの出力がトークン上限に達しました。モデルの変更を検討してください。', telemetry);
    if (choice?.finish_reason !== 'stop' || typeof choice?.message?.content !== 'string' || choice.message.refusal || choice.message.tool_calls?.length) {
      throw new InterpretationError('invalid_response', 'AIの応答が未完了、拒否、または解釈以外の操作でした。', telemetry);
    }
    let result;
    try { result = JSON.parse(choice.message.content); } catch { throw new InterpretationError('invalid_interpretation', 'AIの解釈がJSONではありません。', telemetry); }
    return { result, telemetry };
  } catch (error) {
    if (error instanceof InterpretationError) throw error;
    throw new InterpretationError(signal.aborted ? 'timeout' : 'network_error', signal.aborted ? 'OrcaRouterへの接続がタイムアウトしました。' : 'OrcaRouterへの通信に失敗しました。', telemetry);
  }
}
