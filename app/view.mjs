import { renderRecord } from './render.mjs';

const report = document.querySelector('#report');
const notice = document.querySelector('#notice');
const select = document.querySelector('#records');
const maxSize = 2 * 1024 * 1024;
let generation = 0;
let activeReview = null;

function message(value, error = false) {
  notice.textContent = value;
  notice.classList.toggle('error-notice', error);
}

async function json(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('記録を取得できません。一覧を更新するか、JSONファイルを開いてください。');
  return response.json();
}

async function openRecord(load, label, sample = false, savedName = null) {
  const current = ++generation;
  activeReview = null;
  report.replaceChildren();
  message('記録を読み込んでいます。');
  try {
    const payload = await load();
    if (current !== generation) return;
    const record = savedName ? payload.record : payload;
    const review = savedName ? payload : null;
    report.innerHTML = renderRecord(record, { sample, review });
    if (savedName) activeReview = { name:savedName, review, generation:current };
    message(`${label}を表示しています。`);
  } catch (error) {
    if (current !== generation) return;
    message(error instanceof SyntaxError ? 'JSONを読み取れません。ファイルの形式を確認してください。' : error.message, true);
  }
}

async function refresh() {
  const current = ++generation;
  activeReview = null;
  report.replaceChildren();
  message('記録の一覧を読み込んでいます。');
  select.replaceChildren(new Option('記録を選んでください', ''));
  try {
    const { files } = await json('/api/arrangements');
    if (current !== generation) return;
    for (const file of files) select.add(new Option(file, file));
    if (files.length) {
      message(`${files.length}件の記録があります。表示する記録を選んでください。`);
    } else {
      message('保存された記録はまだありません。');
      report.innerHTML = '<section class="empty"><h1>手配の流れを、ここで確認できます。</h1><p>手配を実行して記録を保存するか、JSONファイルを開いてください。</p><p class="muted">架空サンプルで、辞退から次の候補への打診を確認できます。</p></section>';
    }
  } catch (error) {
    if (current === generation) message(error.message, true);
  }
}

select.addEventListener('change', () => {
  const name = select.value;
  if (name) openRecord(() => json(`/api/review/${encodeURIComponent(name)}`), name, false, name);
  else { ++generation; activeReview = null; report.replaceChildren(); message('表示する記録を選んでください。'); }
});
report.addEventListener('click', async event => {
  if (event.target.id !== 'approve' || !activeReview?.review.canApprove) return;
  const active = activeReview;
  const button = event.target;
  button.disabled = true;
  const feedback = document.querySelector('#approval-message');
  feedback.textContent = '承認を保存しています。';
  try {
    const { approvalToken } = await json('/api/session');
    const response = await fetch(`/api/approve/${encodeURIComponent(active.name)}`, {
      method:'POST', headers:{'Content-Type':'application/json','X-Approval-Token':approvalToken},
      body:JSON.stringify({ recordHash:active.review.recordHash }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? '承認を保存できませんでした。');
    if (active.generation !== generation) return;
    active.review = result;
    report.innerHTML = renderRecord(result.record, { review:result });
    document.querySelector('#approval-message').textContent = '承認を保存しました。';
    message(`${active.name}の承認を保存しました。`);
  } catch (error) {
    if (active.generation !== generation) return;
    feedback.textContent = `${error.message} 記録を開き直して状態を確認してください。`;
    feedback.classList.add('failed');
    // Do not blindly retry an uncertain write; reload the saved receipt first.
  }
});
document.querySelector('#sample').addEventListener('click', () => {
  select.value = '';
  openRecord(() => json('/sample-arrangement.json'), '架空サンプル', true);
});
document.querySelector('#refresh').addEventListener('click', refresh);
document.querySelector('#file').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  select.value = '';
  openRecord(async () => {
    if (file.size > maxSize) throw new Error('ファイルは2MB以内のJSONを選んでください。');
    return JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
  }, file.name);
  event.target.value = '';
});
refresh();
