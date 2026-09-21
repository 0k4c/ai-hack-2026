import { mkdir, readFile, writeFile, rename, rmdir, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { dateNumber } from './constraints.mjs';
import { inspectArrangement } from './approve-arrangement.mjs';

export class WorkforceError extends Error {}
const fail = message => { throw new WorkforceError(message); };
const employeeNames = ['田中', '佐藤', '鈴木', '高橋', '伊藤', '渡辺'];
const blank = organization => ({ schemaVersion: 1, organization, revision: 0,
  employees: employeeNames.map((name, i) => ({ id: `e${i + 1}`, name, hourlyRate: null })), shifts: [], attendance: [], payslips: [] });
const minute = value => {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail('時刻は00:00〜23:59で入力してください。');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
};
const date = value => { try { dateNumber(value); } catch { fail('実在する日付を指定してください。'); } };
const employee = (state, id) => state.employees.find(row => row.id === id) ?? fail('メンバーを選んでください。');
const interval = input => {
  date(input.date);
  const minutes = minute(input.end) - minute(input.start);
  if (minutes <= 0) fail('終了は開始より後にしてください。日をまたぐ勤務は日ごとに分けてください。');
  return minutes;
};
const overlaps = (a, b) => a.employeeId === b.employeeId && a.date === b.date && a.start < b.end && b.start < a.end;
const month = value => { if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) fail('対象月を選んでください。'); date(`${value}-01`); };
const closed = (state, id, target) => state.payslips.some(row => row.employeeId === id && row.month === target);
const unlocked = (state, id, day) => { if (closed(state, id, day.slice(0, 7))) fail('明細を確定した月の勤怠は変更できません。'); };
const exact = (input, fields) => {
  if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).sort().join(',') !== fields.split(',').sort().join(',')) fail('入力項目が不正です。画面を開き直してください。');
};

// Basic-pay estimate: integer minute × integer yen; round UP once per monthly slip.
// No deduction, premium or statutory payroll calculation is implied.
export function payrollPreview(state, employeeId, targetMonth) {
  employee(state, employeeId); month(targetMonth);
  const rows = state.attendance.filter(row => row.employeeId === employeeId && row.date.startsWith(`${targetMonth}-`));
  const approved = rows.filter(row => row.status === 'approved');
  const weightedMinutes = approved.reduce((sum, row) => sum + row.workMinutes * row.hourlyRate, 0);
  return { employeeId, employeeName: employee(state, employeeId).name, month: targetMonth,
    pendingCount: rows.length - approved.length, minutes: approved.reduce((sum, row) => sum + row.workMinutes, 0),
    grossYen: Math.ceil(weightedMinutes / 60), lines: structuredClone(approved),
    calculation: 'approved-minutes-times-snapshotted-rate-monthly-ceil-v1' };
}

export function createWorkforceStore({ recordsDir, organization = 'demo' }) {
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(organization)) throw new Error('団体の識別名は英小文字・数字・ハイフンで指定してください。');
  const base = resolve(recordsDir, 'workforce');
  const root = join(base, organization);
  const path = join(root, 'state.json');
  const guard = async () => {
    for (const directory of [base, root]) {
      await mkdir(directory, { recursive: true });
      if ((await lstat(directory)).isSymbolicLink()) fail('保存先を確認してください。');
    }
    try { if (!(await lstat(path)).isFile() || (await lstat(path)).isSymbolicLink()) fail('保存ファイルを確認してください。'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  };
  const read = async () => {
    await guard();
    let state;
    try { state = JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return blank(organization); fail('勤務管理の保存内容を読み取れません。管理者が保存ファイルを確認してください。'); }
    if (state.schemaVersion !== 1 || state.organization !== organization || !Number.isSafeInteger(state.revision) ||
        !['employees', 'shifts', 'attendance', 'payslips'].every(key => Array.isArray(state[key]))) fail('勤務管理の保存形式を確認してください。');
    return state;
  };
  const mutate = async (revision, operation) => {
    await guard();
    const lock = join(root, '.lock');
    try { await mkdir(lock); } catch (error) { if (error.code === 'EEXIST') fail('ほかの保存処理中です。少し待って再読み込みしてください。'); throw error; }
    try {
      const state = await read();
      if (revision !== state.revision) fail('別の操作で内容が更新されました。再読み込みして確認してください。');
      await operation(state);
      state.revision++;
      const temporary = join(root, `${randomUUID()}.tmp`);
      await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      await rename(temporary, path);
      return state;
    } finally { await rmdir(lock); }
  };
  const command = async (operation, input, revision) => mutate(revision, async state => {
    if (operation === 'rate') {
      exact(input, 'employeeId,hourlyRate');
      if (!Number.isSafeInteger(input.hourlyRate) || input.hourlyRate < 1 || input.hourlyRate > 100000) fail('時給は1〜100,000円の整数で入力してください。');
      employee(state, input.employeeId).hourlyRate = input.hourlyRate;
    } else if (operation === 'shift') {
      exact(input, 'employeeId,date,start,end'); employee(state, input.employeeId); interval(input);
      if (state.shifts.some(row => overlaps(row, input))) fail('同じメンバーの勤務予定と重複しています。');
      state.shifts.push({ ...input, id: randomUUID(), source: 'manual', status: 'confirmed' });
    } else if (operation === 'import') {
      exact(input, 'processId');
      const review = await inspectArrangement({ recordsDir, processId: input.processId });
      if ((review.record.organization ?? 'demo') !== organization) fail('別の団体の手配記録は取り込めません。');
      if (!review.approval) fail('先に欠勤対応の記録を承認してください。');
      const assignment = review.record.provisionalAssignment;
      employee(state, assignment.employeeId); interval(assignment);
      if (state.shifts.some(row => row.sourceId === input.processId)) fail('この承認は取り込み済みです。');
      if (state.shifts.some(row => overlaps(row, assignment))) fail('勤務予定が重複しています。勤務表を確認してください。');
      state.shifts.push({ ...assignment, id: randomUUID(), source: 'arrangement', sourceId: input.processId, status: 'confirmed' });
    } else if (operation === 'attendance') {
      exact(input, 'employeeId,date,start,end,breakMinutes'); employee(state, input.employeeId);
      const duration = interval(input);
      if (!Number.isSafeInteger(input.breakMinutes) || input.breakMinutes < 0 || input.breakMinutes >= duration) fail('休憩は勤務時間より短い、0分以上の整数にしてください。');
      if (new Date(`${input.date}T${input.end}:00+09:00`).getTime() > Date.now()) fail('まだ終了していない勤務を実績として保存できません。');
      unlocked(state, input.employeeId, input.date);
      if (state.attendance.some(row => overlaps(row, input))) fail('同じメンバーの勤怠と重複しています。');
      state.attendance.push({ ...input, id: randomUUID(), workMinutes: duration - input.breakMinutes, status: 'pending', hourlyRate: null });
    } else if (operation === 'approve' || operation === 'return') {
      exact(input, 'id');
      const row = state.attendance.find(row => row.id === input.id) ?? fail('勤怠が見つかりません。');
      unlocked(state, row.employeeId, row.date);
      if (operation === 'approve') {
        if (row.status !== 'pending') fail('この勤怠は承認済みです。');
        const rate = employee(state, row.employeeId).hourlyRate;
        if (!rate) fail('先にこのメンバーの時給を設定してください。');
        Object.assign(row, { status: 'approved', hourlyRate: rate, approvedAt: new Date().toISOString() });
      } else {
        if (row.status !== 'approved') fail('承認した勤怠を選んでください。');
        Object.assign(row, { status: 'pending', hourlyRate: null, approvedAt: null });
      }
    } else if (operation === 'remove-attendance') {
      exact(input, 'id');
      const row = state.attendance.find(row => row.id === input.id) ?? fail('勤怠が見つかりません。');
      unlocked(state, row.employeeId, row.date);
      if (row.status !== 'pending') fail('承認を取り消してから修正してください。');
      // Keep an audit trail instead of silently discarding entered time.
      state.attendance = state.attendance.filter(item => item !== row);
      state.corrections ??= []; state.corrections.push({ ...row, removedAt: new Date().toISOString() });
    } else if (operation === 'payslip') {
      exact(input, 'employeeId,month');
      if (closed(state, input.employeeId, input.month)) fail('この月の明細は作成済みです。');
      const preview = payrollPreview(state, input.employeeId, input.month);
      if (preview.pendingCount) fail('未承認の勤怠があります。すべて確認してから明細を作成してください。');
      if (!preview.lines.length) fail('対象月に承認済みの勤怠がありません。');
      state.payslips.push({ ...preview, id: randomUUID(), createdAt: new Date().toISOString() });
    } else fail('この操作には対応していません。');
  });
  return { read, command };
}
