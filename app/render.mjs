// All JSON strings are escaped at the rendering boundary, including AI output.
export const escapeHtml = value => String(value ?? '不明').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const text = escapeHtml;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const names = { e1:'田中', e2:'佐藤', e3:'鈴木', e4:'高橋', e5:'伊藤', e6:'渡辺' };
const person = id => `${names[id] ? `${names[id]} / ` : ''}${id ?? '不明'}`;
const statuses = { filled:'店長の承認待ち', pending:'処理途中の記録', escalated:'店長へ引き継ぎ', failed:'処理に失敗' };
const kinds = { accepted:'受諾', declined:'辞退', conditional:'条件付き' };
const actions = { hold:'仮押さえして承認を待つ', next_candidate:'次の候補へ打診', retry:'条件を変えて再打診', escalate:'店長へ引き継ぐ' };
const exclusions = { absent_employee:'欠勤者本人', requested_day_off:'希望休', shift_overlap:'既存勤務と重複', weekly_hours_limit:'週の労働時間上限を超過', consecutive_days_limit:'連勤上限を超過' };
const stops = { awaiting_approval:'受諾した候補を仮押さえしています。勤務はまだ確定していません。', round_limit:'打診回数の上限に達しました。', no_candidates:'打診できる候補がいません。', time_limit:'処理時間の上限に達しました。', ai_escalation:'AIが店長への引き継ぎを選びました。', partial_coverage:'一部の時間帯のみ受諾。残りの時間帯は店長の確認が必要です。', ineligible_candidate:'勤務条件を満たさないため停止しました。', missing_reply:'返事を取得できず停止しました。', api_failure:'AIとの通信または回答の検証に失敗しました。' };
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value.toLocaleString('ja-JP') : '不明';
const duration = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${(value / 1000).toFixed(2)} 秒` : '不明';
const cost = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
  ? value > 0 && value < 0.000001 ? '$0.000001 未満' : `$${value.toFixed(6)}`
  : '不明';
const unavailable = value => ['not_called','unavailable'].includes(value?.costSource);
const tokens = value => unavailable(value) ? '不明' : number(value?.tokens?.total);
const measuredCost = value => unavailable(value) ? '不明' : cost(value?.estimatedCostUsd);
const badge = (label, tone = '') => `<span class="badge ${tone}">${text(label)}</span>`;
const time = value => `${text(value?.date)} ${text(value?.start)}–${text(value?.end)}`;
const paragraph = value => `<p class="report-text">${text(value)}</p>`;

export function validateRecord(record) {
  if (!object(record) || record.schemaVersion !== 1) throw new Error('対応しているのは schemaVersion: 1 の手配JSONです。');
  if (typeof record.processId !== 'string' || !object(record.vacancy) || !Object.hasOwn(statuses, record.status)
      || !object(record.filtering) || !Array.isArray(record.filtering.evaluations)
      || !Array.isArray(record.rounds) || !object(record.limits)) {
    throw new Error('手配JSONの必須項目が不足しています。処理ID・欠員・候補判定・巡の記録・上限を確認してください。');
  }
  if (record.filtering.evaluations.some(entry => !object(entry) || !Array.isArray(entry.reasons))) throw new Error('候補の判定と除外理由を読み取れません。');
  if (record.rounds.some(round => !object(round) || !Number.isInteger(round.number) || round.number < 1)) throw new Error('巡の番号を読み取れません。');
  if (new Set(record.rounds.map(round => round.number)).size !== record.rounds.length) throw new Error('巡の番号が重複しています。');
  return record;
}

function measurements(value = {}) {
  return `<div class="metrics"><span>実モデル <strong>${text(value?.actualModel)}</strong></span><span>トークン <strong>${tokens(value)}</strong></span><span>概算USD <strong>${measuredCost(value)}</strong></span><span>所要時間 <strong>${duration(value?.durationMs)}</strong></span></div>
    <details class="technical"><summary>計測の詳細</summary><dl><dt>要求モデル</dt><dd>${text(value?.requestedModel)}</dd><dt>入力 / 出力</dt><dd>${unavailable(value) ? '不明 / 不明' : `${number(value?.tokens?.prompt)} / ${number(value?.tokens?.completion)}`}</dd><dt>API呼び出し</dt><dd>${value?.apiCalled === true ? 'あり' : value?.apiCalled === false ? 'なし' : '不明'}</dd><dt>費用の取得元</dt><dd>${text(value?.costSource)}</dd><dt>リクエストID</dt><dd>${text(value?.requestId)}</dd></dl></details>`;
}

function renderRound(round, maxRounds) {
  const kind = Object.hasOwn(kinds, round.interpretation?.kind) ? round.interpretation.kind : '';
  const action = round.action;
  const actionTone = action?.type === 'escalate' ? 'escalated' : kind;
  const delivery = round.channel === 'dryrun' ? '未送信（dryrun）' : round.delivered === false ? '未送信' : round.delivered === true ? '送信済み（記録上）' : '送信状態不明';
  return `<li class="round panel"><div class="round-header"><div><span class="round-count">${number(round.number)}巡目 / 最大${number(maxRounds)}巡</span><h3>${text(person(round.employeeId))}</h3></div>${badge(kinds[kind] ?? '解釈結果なし', kind)}</div>
    <div class="reason-label">この相手を選んだ理由</div>${paragraph(round.selectionReason)}
    <div class="exchange"><div><div class="reason-label">打診文 · ${delivery}</div><p class="muted">${time(round.offer)}</p><blockquote class="quote">${text(round.message)}</blockquote></div><div><div class="reason-label">返ってきた自由文</div><blockquote class="quote">${text(round.originalReply)}</blockquote></div></div>
    <div class="reason-label">AIによる返事の解釈</div>${paragraph(round.interpretation?.summary)}
    <div class="decision ${actionTone}"><strong>${text(actions[action?.type] ?? '次の行動は未記録')}${action?.employeeId ? `：${text(person(action.employeeId))}` : ''}</strong>${action?.start || action?.end ? `<p class="muted">${text(action.start)}–${text(action.end)}</p>` : ''}${paragraph(action?.reason)}</div>${measurements(round)}</li>`;
}

export function renderRecord(input, { sample = false, review = null } = {}) {
  const record = validateRecord(input);
  sample ||= record.isDisplaySample === true;
  const approval = !sample && review?.approval;
  const canApprove = !sample && review?.canApprove === true;
  const statusLabel = approval ? '承認済み（このPC）' : statuses[record.status];
  const approvalNote = approval ? `承認日時：${text(approval.approvedAt)}。このPCに承認した勤務を保存しました。`
    : canApprove ? '内容を確認して承認すると、このPCに承認した勤務を保存します。外部への送信はありません。'
    : text(review?.reason ?? 'ファイルを直接開いた場合と表示用サンプルは閲覧のみです。承認するには保存された手配記録を一覧から選んでください。');
  const rounds = [...record.rounds].sort((a,b) => a.number - b.number);
  const evaluations = record.filtering.evaluations;
  const candidates = evaluations.filter(entry => entry.eligible === true).length;
  const requests = [record.selectionRequest, ...rounds].filter(Boolean);
  const costUnknown = requests.some(unavailable);
  const totalCost = costUnknown ? '不明' : cost(record.totalEstimatedCostUsd);
  const totalTokens = costUnknown ? '不明' : number(record.totalTokens?.total);
  return `<section class="intro"><div><div class="muted ${sample ? 'sample-tag' : ''}">${sample ? '架空サンプル / 数値は表示確認用です' : record.dataSource === 'synthetic_seed' ? '架空の従業員データを使った手配記録' : '読み込んだ手配記録'}</div><h1>${time(record.vacancy)} の欠員</h1><p>欠勤者：${text(person(record.vacancy.absentEmployeeId))}</p><p class="meta">処理ID ${text(record.processId)}<br>記録日時 ${text(record.createdAt)}</p></div>${badge(statusLabel, record.status)}</section>
    <section class="summary-strip" aria-label="手配の合計"><div><span class="metric-label">打診回数 / 上限</span><span class="metric-value">${rounds.length} / ${number(record.limits.maxRounds)} 巡</span></div><div><span class="metric-label">合計トークン（初回選定を含む）</span><span class="metric-value">${totalTokens}</span></div><div><span class="metric-label">合計概算費用（USD）</span><span class="metric-value">${totalCost}</span></div><div><span class="metric-label">処理全体の所要時間</span><span class="metric-value">${duration(record.totalDurationMs)}</span></div></section>
    ${record.status === 'pending' ? '<p class="muted">処理途中、または中断された記録です。計数・費用は途中値で、未反映の通信がある可能性があります。一覧を更新して最新の記録を開いてください。</p>' : ''}
    <div class="layout"><aside class="panel"><h2>コードで候補を絞る</h2><p class="muted">${evaluations.length}人を確認し、${candidates}人が候補。<br>対象週の開始：${text(record.filtering.weekStart)}</p><div class="candidate-list">${evaluations.map(entry => `<div class="candidate"><div class="candidate-heading"><span class="candidate-name">${text(person(entry.employeeId))}</span><span class="muted">${entry.eligible === true ? '候補' : entry.eligible === false ? '除外' : '判定不明'}</span></div>${entry.reasons.map(reason => `<p>${text(exclusions[reason] ?? reason)}<br><code>${text(reason)}</code></p>`).join('')}<p class="muted">週 ${number(entry.weeklyHoursBefore)} → ${number(entry.weeklyHoursAfter)}h / 上限 ${number(entry.maxWeeklyHours)}h<br>追加後 ${number(entry.consecutiveDaysAfter)}連勤 / 上限 ${number(entry.maxConsecutiveDays)}日</p></div>`).join('') || '<p>候補判定の記録がありません。</p>'}</div></aside>
    <section aria-label="判断と打診の時系列"><h2>AIの判断をたどる</h2><div class="initial panel"><h3>最初の候補：${text(person(record.selection?.employeeId))}</h3>${paragraph(record.selection?.reason ?? '初回選定の記録がありません。')}${measurements(record.selectionRequest)}</div><ol class="timeline">${rounds.map(round => renderRound(round, record.limits.maxRounds)).join('')}</ol>${rounds.length === 0 ? '<p class="panel">打診の記録はありません。</p>' : ''}
    <section class="approval panel"><div class="approval-content"><div><h2>${text(statusLabel)}</h2>${paragraph(approval ? '店長の承認を保存しました。外部の勤務表・給与・勤怠システムへの反映は行いません。' : stops[record.stopReason] ?? record.stopReason ?? '停止理由は未記録です。')}${record.provisionalAssignment ? `<p>${approval ? '承認した勤務' : '仮押さえ'}：<strong>${text(person(record.provisionalAssignment.employeeId))}</strong><br>${time(record.provisionalAssignment)}</p>` : ''}</div><button id="approve" type="button" ${canApprove ? '' : 'disabled'} aria-describedby="approval-note">${approval ? '承認を保存済み' : '店長が承認して保存'}</button></div><p id="approval-note" class="muted">${approvalNote}</p><p id="approval-message" role="status" aria-live="polite"></p>${record.error ? `<p class="report-text failed">${text(record.error.code)} / HTTP ${text(record.error.httpStatus)}<br>${text(record.error.message)}</p>` : ''}</section>
    <p class="muted">費用は応答時点の概算USDで、確定請求額ではありません。取得できない計測値は「不明」と表示します。</p></section></div>`;
}
