import { escapeHtml as h } from './render.mjs';
let state;
let preview = null;
let busy = false;
const $ = selector => document.querySelector(selector);
const money = value => `${value.toLocaleString('ja-JP')}円`;
const hours = value => `${Math.floor(value / 60)}時間${value % 60}分`;
const notice = (message, error = false) => { $('#notice').textContent = message; $('#notice').classList.toggle('error', error); };
const name = id => state.employees.find(row => row.id === id)?.name ?? '氏名未登録';
const table = (headers, rows, empty) => rows.length ? `<div class="table-wrap"><table><thead><tr>${headers.map(item => `<th scope="col">${h(item)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : `<p class="empty">${h(empty)}</p>`;
const row = cells => `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
async function request(url, options) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  let body;
  try { body = await response.json(); } catch { throw new Error('応答を読み取れません。画面を再読み込みしてください。'); }
  if (!response.ok) throw new Error(body.error ?? '処理できませんでした。再読み込みして確認してください。');
  return body;
}
async function task(action) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(button => button.disabled = true);
  try { await action(); } catch (error) { notice(error.message, true); }
  finally { busy = false; document.querySelectorAll('button').forEach(button => button.disabled = button.dataset.unavailable === 'true'); }
}
function draw() {
  $('#organization').textContent = `団体：${state.organization === 'demo' ? 'サンプル店舗' : state.organization}`;
  for (const select of document.querySelectorAll('select[name="employeeId"]')) {
    const before = select.value;
    select.innerHTML = '<option value="">メンバーを選択</option>' + state.employees.map(person => `<option value="${h(person.id)}">${h(person.name)}</option>`).join('');
    select.value = before;
  }
  $('#shift-table').innerHTML = table(['勤務日', 'メンバー', '予定', '状態'], [...state.shifts].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)).map(item => row([h(item.date), h(name(item.employeeId)), `${h(item.start)}〜${h(item.end)}`, '確定済み'])), '勤務予定はまだありません。予定を追加するか、承認済みの欠勤対応を取り込んでください。');
  $('#attendance-table').innerHTML = table(['勤務日・メンバー', '出退勤・休憩', '実働', '状態・時給', '操作'], [...state.attendance].sort((a,b)=>a.date.localeCompare(b.date)).map(item => {
    const locked = state.payslips.some(slip => slip.employeeId === item.employeeId && slip.month === item.date.slice(0,7));
    const rate = state.employees.find(person => person.id === item.employeeId)?.hourlyRate;
    const buttons = locked ? '明細作成済み' : item.status === 'approved' ? `<button class="secondary" data-command="return" data-id="${h(item.id)}">承認を取り消す</button>` : `<button data-command="approve" data-id="${h(item.id)}" ${!rate ? 'disabled data-unavailable="true"' : ''}>${rate ? `${money(rate)}で承認` : '時給を設定してください'}</button><button class="secondary" data-command="remove-attendance" data-id="${h(item.id)}">取り下げて再入力</button>`;
    return row([`${h(item.date)}<br>${h(name(item.employeeId))}`, `${h(item.start)}〜${h(item.end)}<br>休憩 ${item.breakMinutes}分`, hours(item.workMinutes), item.status === 'approved' ? `承認済み<br>${money(item.hourlyRate)}` : '承認待ち', buttons]);
  }), '勤怠はまだありません。勤務後に実際の時間を入力してください。');
  $('#rates').innerHTML = table(['メンバー', '時給'], state.employees.map(person=>row([h(person.name), person.hourlyRate ? money(person.hourlyRate) : '未設定'])), '');
  $('#payslips').innerHTML = state.payslips.map(slip=>`<article class="slip"><h4>${h(slip.month)} 給与明細（基本給）／${h(slip.employeeName)}</h4><p>団体：${h(state.organization === 'demo' ? 'サンプル店舗' : state.organization)}</p><p>実働 ${hours(slip.minutes)}・${slip.lines.length}件の承認済み勤怠</p><p class="amount">基本給 ${money(slip.grossYen)}</p><p>割増・手当・控除を含まない集計です。振込額ではありません。</p>${table(['勤務日','実働','時給'], slip.lines.map(line=>row([h(line.date),hours(line.workMinutes),money(line.hourlyRate)])), '')}<p>月合計の1円未満を切り上げ。作成日：${h(slip.createdAt.slice(0,10))}</p></article>`).join('') || '<p class="empty">作成済みの明細はありません。</p>';
  if (state.payslips.length) $('#payslips').insertAdjacentHTML('afterbegin', '<button id="print" class="secondary">給与明細を印刷・PDFに保存</button>');
  preview = null; $('#preview').replaceChildren();
}
async function command(operation, input) {
  const { approvalToken } = await request('/api/session');
  state = await request(`/api/workforce/${operation}`, { method:'POST', headers:{'Content-Type':'application/json','X-Approval-Token':approvalToken}, body:JSON.stringify({ revision:state.revision, input }) });
  draw(); notice('保存しました。');
}
for (const [id, operation, numbers] of [['shift-form','shift',[]], ['attendance-form','attendance',['breakMinutes']], ['rate-form','rate',['hourlyRate']], ['import-form','import',[]]]) {
  $(`#${id}`).addEventListener('submit', event => {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    for (const key of numbers) input[key] = Number(input[key]);
    task(()=>command(operation, input));
  });
}
$('#attendance-table').addEventListener('click', event => {
  const button = event.target.closest('button[data-command]');
  if (!button) return;
  const item = state.attendance.find(row => row.id === button.dataset.id);
  if (button.dataset.command === 'remove-attendance' && item) {
    const form = $('#attendance-form');
    for (const key of ['employeeId','date','start','end','breakMinutes']) form.elements[key].value = item[key];
  }
  task(()=>command(button.dataset.command, { id:button.dataset.id }));
});
$('#preview-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(event.currentTarget));
  task(async()=>{
    const result = await request(`/api/workforce/preview?${new URLSearchParams(input)}`);
    // The subsequent save checks the loaded revision, so a newer set of entries cannot be finalized silently.
    preview = { input, result };
    const unavailable = result.pendingCount > 0 || result.lines.length === 0 || state.payslips.some(slip=>slip.employeeId === input.employeeId && slip.month === input.month);
    $('#preview').innerHTML = `<h3>${h(result.employeeName)}さん・${h(result.month)}</h3><p>承認済み ${result.lines.length}件／実働 ${hours(result.minutes)}／未承認 ${result.pendingCount}件</p><p class="amount">基本給 ${money(result.grossYen)}</p><p>作成すると、このメンバーの対象月の勤怠を固定します。勤務時間・時給・入力漏れを確認してください。</p><button id="create-slip" ${unavailable ? 'disabled data-unavailable="true"' : ''}>内容を確認して明細を作成</button>`;
    notice('承認済みの勤怠で集計しました。');
  });
});
$('#preview').addEventListener('click', event=>{
  if (event.target.id === 'create-slip' && preview) { const input = preview.input; task(()=>command('payslip', input)); }
});
$('#payslips').addEventListener('click', event=>{ if (event.target.id === 'print') window.print(); });
async function refresh() {
  state = await request('/api/workforce'); draw();
  const { records = [] } = await request('/api/arrangements');
  const approved = [];
  for (const record of records) {
    try { const review = await request(`/api/review/${encodeURIComponent(record.file)}`); if (review.approval) approved.push(record); } catch { /* Unreadable records stay in the review screen. */ }
  }
  $('#import-form select').innerHTML = '<option value="">記録を選択</option>' + approved.map(item=>`<option value="${h(item.file.slice(0,-5))}">${h(item.label)}</option>`).join('');
  notice('最新の内容を表示しています。');
}
$('#refresh').addEventListener('click', ()=>task(refresh));
task(refresh);
