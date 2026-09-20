import { renderRecord } from './render.mjs';

const report = document.querySelector('#report');
const notice = document.querySelector('#notice');
const select = document.querySelector('#records');
const maxSize = 2 * 1024 * 1024;
let generation = 0;

function message(value, error = false) {
  notice.textContent = value;
  notice.classList.toggle('error-notice', error);
}

async function json(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('記録を取得できません。一覧を更新するか、JSONファイルを開いてください。');
  return response.json();
}

async function openRecord(load, label, sample = false) {
  const current = ++generation;
  report.replaceChildren();
  message('記録を読み込んでいます。');
  try {
    const record = await load();
    if (current !== generation) return;
    report.innerHTML = renderRecord(record, { sample });
    message(`${label}を表示しています。`);
  } catch (error) {
    if (current !== generation) return;
    message(error instanceof SyntaxError ? 'JSONを読み取れません。ファイルの形式を確認してください。' : error.message, true);
  }
}

async function refresh() {
  const current = ++generation;
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
  if (select.value) openRecord(() => json(`/api/arrangements/${encodeURIComponent(select.value)}`), select.value);
  else { ++generation; report.replaceChildren(); message('表示する記録を選んでください。'); }
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
