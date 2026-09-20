import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rmdir, writeFile, realpath, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createSeed } from '../src/seed.mjs';
import { filterCandidates } from '../src/constraints.mjs';

export class ApprovalError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}
export const recordHash = record => createHash('sha256').update(JSON.stringify(record)).digest('hex');
const assignmentEqual = (a, b) => a && b && ['employeeId','date','start','end'].every(key => a[key] === b[key]);
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());

export function approvalReason(record, currentDate = today()) {
  if (record.schemaVersion !== 1 || record.dataSource !== 'synthetic_seed' || record.isDisplaySample) return 'この記録は承認対象ではありません。';
  const vacancy = record.vacancy;
  if (!vacancy || recordHash({ absentEmployeeId: vacancy.absentEmployeeId, date: vacancy.date, start: vacancy.start, end: vacancy.end }) !== record.processId) return '処理IDと欠員の内容が一致しません。';
  if (record.status !== 'filled' || record.stopReason !== 'awaiting_approval' || record.approvalStatus !== 'pending' || record.error) return '全時間帯の受諾と承認待ちが必要です。';
  if (vacancy.date < currentDate) return '過去日の勤務は承認できません。';
  const assignment = record.provisionalAssignment;
  if (!assignment || !['date','start','end'].every(key => assignment[key] === vacancy[key])) return '欠員の全時間帯と仮押さえが一致しません。';
  if (!Array.isArray(record.rounds) || record.rounds.length < 1 || record.rounds.length > 3 || record.rounds.some((round,index) => round?.number !== index + 1)) return '巡の記録が不正です。';
  const last = record.rounds.at(-1);
  if (last.interpretation?.kind !== 'accepted' || last.action?.type !== 'hold' || last.employeeId !== assignment.employeeId ||
      !assignmentEqual({ employeeId:last.employeeId, ...last.offer }, assignment) ||
      !assignmentEqual({ ...last.action, date:vacancy.date }, assignment)) return '受諾・仮押さえの記録が一致しません。';
  return null;
}

async function approvalDirectory(recordsDir, create = false) {
  const root = await realpath(recordsDir);
  const directory = join(root, '_approvals');
  if (create) await mkdir(directory, { recursive: true });
  try {
    if ((await lstat(directory)).isSymbolicLink() || await realpath(directory) !== directory) throw new ApprovalError('承認保存先を確認してください。');
  } catch (error) { if (error.code === 'ENOENT' && !create) return null; throw error; }
  return directory;
}

async function readReceipt(directory, id) {
  const path = join(directory, id + '.json');
  try {
    if ((await lstat(path)).isSymbolicLink()) throw new ApprovalError('承認記録を確認してください。');
    const value = JSON.parse(await readFile(path, 'utf8'));
    if (value.schemaVersion !== 1 || value.processId !== id || value.status !== 'approved' || !value.assignment || typeof value.approvedAt !== 'string' || !/^[a-f0-9]{64}$/.test(value.recordHash)) throw new Error('invalid_receipt');
    return value;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new ApprovalError('承認記録が壊れているため処理を停止しました。');
  }
}

export async function reviewRecord(record, recordsDir) {
  const hash = recordHash(record);
  const directory = await approvalDirectory(recordsDir);
  const approval = directory && /^[a-f0-9]{64}$/.test(record.processId) ? await readReceipt(directory, record.processId) : null;
  if (approval && (approval.recordHash !== hash || !assignmentEqual(approval.assignment, record.provisionalAssignment))) throw new ApprovalError('承認後に元の記録が変わっています。承認記録と照合してください。');
  const reason = approvalReason(record);
  return { record, recordHash:hash, approval, canApprove:!approval && !reason, reason };
}

export async function approveRecord({ recordsDir, expectedHash, loadRecord }) {
  const directory = await approvalDirectory(recordsDir, true);
  const lock = join(directory, '.lock');
  try { await mkdir(lock); }
  catch (error) { if (error.code === 'EEXIST') throw new ApprovalError('別の承認を処理中です。完了後に記録を開き直してください。'); throw error; }
  try {
    const record = await loadRecord();
    const review = await reviewRecord(record, recordsDir);
    if (review.recordHash !== expectedHash) throw new ApprovalError('記録が更新されています。開き直して内容を確認してください。');
    if (review.approval) return { ...review, alreadyApproved:true };
    if (review.reason) throw new ApprovalError(review.reason);
    const employees = await createSeed(record.vacancy.date);
    const files = await readdir(directory);
    for (const filename of files.filter(name => /^[a-f0-9]{64}\.json$/.test(name))) {
      const receipt = await readReceipt(directory, filename.slice(0, -5));
      const employee = employees.find(value => value.id === receipt.assignment.employeeId);
      if (!employee) throw new ApprovalError('既存の承認記録に不明な従業員が含まれています。');
      employee.shifts.push({ date:receipt.assignment.date, start:receipt.assignment.start, end:receipt.assignment.end });
    }
    let eligible;
    try { eligible = filterCandidates(employees, record.vacancy).candidates.some(value => value.employeeId === record.provisionalAssignment.employeeId); }
    catch { throw new ApprovalError('既存勤務と承認記録を照合できません。勤務条件を確認してください。'); }
    if (!eligible) throw new ApprovalError('承認済み勤務を含めると勤務条件を満たしません。店長による見直しが必要です。');
    const approval = { schemaVersion:1, processId:record.processId, recordHash:review.recordHash,
      status:'approved', approvedAt:new Date().toISOString(), source:'local_manager_button',
      assignment:record.provisionalAssignment };
    const temporary = join(directory, randomUUID() + '.tmp');
    await writeFile(temporary, JSON.stringify(approval, null, 2) + '\n', { flag:'wx', mode:0o600 });
    await rename(temporary, join(directory, record.processId + '.json'));
    return { ...review, approval, canApprove:false, alreadyApproved:false };
  } finally { await rmdir(lock); }
}
