import { createHash, randomUUID } from 'node:crypto';
import { open, lstat, mkdir, link, unlink, readdir, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createSeed } from './seed.mjs';
import { filterCandidates, dateNumber } from './constraints.mjs';

const HASH = /^[a-f0-9]{64}$/;
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
const MAX_BYTES = 2 * 1024 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => object(value) && Object.keys(value).sort().join(',') === names.split(',').sort().join(',');
const hash = value => createHash('sha256').update(value).digest('hex');
const sameAssignment = (a, b) => a && b && ['employeeId', 'date', 'start', 'end'].every(key => a[key] === b[key]);

export class ApprovalError extends Error {
  constructor(code, message) { super(message); this.name = 'ApprovalError'; this.code = code; }
}
const fail = (code, message) => { throw new ApprovalError(code, message); };
const safe = async operation => {
  try { return await operation(); }
  catch (error) {
    if (error instanceof ApprovalError) throw error;
    fail('storage_error', '記録の読み書きに失敗しました。保存先と権限を確認してください。');
  }
};

function paths({ recordsDir = 'output/arrangements', processId }) {
  if (typeof processId !== 'string' || !HASH.test(processId) || typeof recordsDir !== 'string' || !recordsDir.trim()) {
    fail('invalid_input', '保存先と64桁の処理IDを指定してください。');
  }
  const root = resolve(recordsDir);
  return { root, legacy: join(root, '_approvals'), source: join(root, `${processId}.json`), directory: join(root, 'approvals'),
    approval: join(root, 'approvals', `${processId}.json`) };
}

async function readJson(path, code, missing = false) {
  let stat;
  try { stat = await lstat(path); }
  catch (error) {
    if (error.code === 'ENOENT') {
      if (missing) return null;
      fail('not_found', '指定した手配記録がありません。');
    }
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) fail(code, '通常の2MB以内のJSONファイルが必要です。');
  const file = await open(path, 'r');
  try {
    const current = await file.stat();
    if (!current.isFile() || current.size > MAX_BYTES || current.ino !== stat.ino || current.dev !== stat.dev) fail(code, '読み込み中に記録が変更されました。');
    const bytes = await file.readFile();
    if (bytes.length > MAX_BYTES) fail(code, '記録のサイズが上限を超えています。');
    let value;
    try { value = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')); }
    catch { fail(code, '記録のJSONを読み取れません。'); }
    if (!object(value)) fail(code, '記録はJSONオブジェクトで保存してください。');
    return { value, digest: hash(bytes) };
  } finally { await file.close(); }
}

async function approvalDirectory(directory, create = false) {
  if (create) {
    try { await mkdir(directory, { mode: 0o700 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  try {
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('storage_error', '承認保存先には通常のディレクトリを指定してください。');
    return true;
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function eligible(record, processId) {
  if (record.isDisplaySample || record.schemaVersion !== 1 || record.processId !== processId || record.dataSource !== 'synthetic_seed') return false;
  if (record.status !== 'filled' || record.stopReason !== 'awaiting_approval' || record.approvalStatus !== 'pending' || record.error !== null) return false;
  const vacancy = record.vacancy;
  const assignment = record.provisionalAssignment;
  if (!keys(vacancy, 'absentEmployeeId,date,start,end') || !keys(assignment, 'employeeId,date,start,end')) return false;
  const canonicalVacancy = { absentEmployeeId: vacancy.absentEmployeeId, date: vacancy.date, start: vacancy.start, end: vacancy.end };
  if (hash(JSON.stringify(canonicalVacancy)) !== processId || assignment.employeeId === vacancy.absentEmployeeId ||
      !['date', 'start', 'end'].every(key => assignment[key] === vacancy[key])) return false;
  const rounds = record.rounds;
  if (!Array.isArray(rounds) || rounds.length < 1 || rounds.length > 3 || record.limits?.maxRounds !== 3 ||
      rounds.some((round, index) => !object(round) || round.number !== index + 1 || round.channel !== 'dryrun' || round.delivered !== false)) return false;
  const last = rounds.at(-1);
  if (last.interpretation?.kind !== 'accepted' || last.action?.type !== 'hold' || last.employeeId !== assignment.employeeId ||
      !sameAssignment({ ...last.offer, employeeId: last.employeeId }, assignment) ||
      !sameAssignment({ ...last.action, date: last.offer.date }, assignment)) return false;
  // The local demo uses the same synthetic seed as the producer. Recheck the
  // actual rules; never trust a serialized eligible:true flag by itself.
  try {
    dateNumber(vacancy.date);
    const { candidates } = filterCandidates(await createSeed(vacancy.date), vacancy);
    return candidates.some(candidate => candidate.employeeId === assignment.employeeId);
  } catch { return false; }
}

async function savedApproval(locations, processId, recordHash, assignment) {
  if (!await approvalDirectory(locations.directory)) return null;
  const saved = await readJson(locations.approval, 'invalid_approval', true);
  if (!saved) return null;
  const value = saved.value;
  if (!keys(value, 'schemaVersion,status,mode,processId,sourceRecordHash,approvedAt,assignment') || value.schemaVersion !== 1 ||
      value.status !== 'approved' || value.mode !== 'local_demo' || value.processId !== processId ||
      typeof value.sourceRecordHash !== 'string' || !HASH.test(value.sourceRecordHash) ||
      typeof value.approvedAt !== 'string' || !Number.isFinite(Date.parse(value.approvedAt)) ||
      new Date(value.approvedAt).toISOString() !== value.approvedAt || !keys(value.assignment, 'employeeId,date,start,end')) {
    fail('invalid_approval', '保存済みの承認記録が不正です。上書きせず確認してください。');
  }
  if (value.sourceRecordHash !== recordHash) fail('record_changed', '承認後に元記録が変更されています。記録を確認してください。');
  if (!sameAssignment(value.assignment, assignment)) fail('invalid_approval', '承認済みの割当が元記録と一致しません。');
  return value;
}

// Never silently ignore receipts produced by the old independent web writer.
async function rejectLegacy(locations) {
  if (await approvalDirectory(locations.legacy) && (await readdir(locations.legacy)).length) {
    fail('legacy_approvals', '旧保存先 _approvals に記録があります。新規承認を止め、既存の承認内容を確認してください。');
  }
}

async function eligibleWithApprovals(record, locations) {
  const employees = await createSeed(record.vacancy.date);
  if (await approvalDirectory(locations.directory)) {
    for (const filename of await readdir(locations.directory)) {
      if (!/^[a-f0-9]{64}\.json$/.test(filename)) continue;
      const processId = filename.slice(0, -5);
      // A concurrent writer may publish this receipt after our first read.
      // Its idempotent result is checked again under the lock.
      if (processId === record.processId) continue;
      const other = paths({ recordsDir: locations.root, processId });
      const source = await readJson(other.source, 'invalid_record');
      const receipt = await savedApproval(other, processId, source.digest, source.value.provisionalAssignment);
      if (!receipt || !await eligible(source.value, processId)) fail('invalid_approval', '既存の承認と元記録を照合できません。');
      const employee = employees.find(value => value.id === receipt.assignment.employeeId);
      if (!employee) fail('invalid_approval', '既存の承認に不明な従業員が含まれています。');
      employee.shifts.push({ date: receipt.assignment.date, start: receipt.assignment.start, end: receipt.assignment.end });
    }
  }
  try {
    return filterCandidates(employees, record.vacancy).candidates.some(candidate => candidate.employeeId === record.provisionalAssignment.employeeId);
  } catch { fail('invalid_approval', '既存勤務と承認記録を照合できません。勤務条件を確認してください。'); }
}

export async function inspectArrangement(options = {}) {
  return safe(async () => {
    const locations = paths(options);
    await rejectLegacy(locations);
    const { value: record, digest: recordHash } = await readJson(locations.source, 'invalid_record');
    const valid = await eligible(record, options.processId);
    const assignment = valid ? record.provisionalAssignment : null;
    const approval = await savedApproval(locations, options.processId, recordHash, assignment);
    // Existing receipts remain readable after their work date. Only NEW approvals
    // are rejected for past dates; do not re-count a receipt against itself.
    const canApprove = valid && !approval && record.vacancy.date >= today() && await eligibleWithApprovals(record, locations);
    return { record, processId: options.processId, recordHash, canApprove,
      reason: approval ? 'already_approved' : canApprove ? null : 'not_approvable', assignment, approval };
  });
}

async function acquireLock(directory) {
  const lock = join(directory, '.lock');
  for (let attempt = 0; attempt < 80; attempt++) {
    try { await mkdir(lock, { mode: 0o700 }); return lock; }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  fail('approval_busy', '別の承認を処理中です。中断したロックが残る場合は稼働中の処理がないことを確認してください。');
}

export async function approveArrangement(options = {}) {
  return safe(async () => {
    const locations = paths(options);
    if (typeof options.expectedRecordHash !== 'string' || !HASH.test(options.expectedRecordHash)) fail('invalid_input', '表示時に取得した記録ハッシュが必要です。');
    const initial = await inspectArrangement(options);
    if (initial.recordHash !== options.expectedRecordHash) fail('record_changed', '表示後に記録が変更されました。再読込して確認してください。');
    if (initial.approval) return { approval: initial.approval, created: false };
    if (!initial.canApprove) fail('not_approvable', '承認待ち・日付・勤務条件を確認してください。');
    await approvalDirectory(locations.directory, true);
    const lock = await acquireLock(locations.directory);
    try {
      // Serialize ALL assignments, not just a single processId, then recheck
      // receipts inside the lock so overlapping vacancies cannot both win.
      const state = await inspectArrangement(options);
      if (state.recordHash !== options.expectedRecordHash) fail('record_changed', '表示後に記録が変更されました。再読込して確認してください。');
      if (state.approval) return { approval: state.approval, created: false };
      if (!state.canApprove) fail('not_approvable', '承認済み勤務を含めると勤務条件を満たしません。');
      const approval = { schemaVersion: 1, status: 'approved', mode: 'local_demo', processId: options.processId,
        sourceRecordHash: state.recordHash, approvedAt: new Date().toISOString(), assignment: state.assignment };
      const temporary = join(locations.directory, `.${randomUUID()}.tmp`);
      try {
        const file = await open(temporary, 'wx', 0o600);
        try { await file.writeFile(JSON.stringify(approval, null, 2) + '\n'); await file.sync(); }
        finally { await file.close(); }
        const latest = await readJson(locations.source, 'invalid_record');
        if (latest.digest !== state.recordHash) fail('record_changed', '保存前に記録が変更されました。再読込して確認してください。');
        // Keep atomic no-replace publication even while holding the global lock.
        try { await link(temporary, locations.approval); }
        catch (error) {
          if (error.code !== 'EEXIST') throw error;
          const existing = await savedApproval(locations, options.processId, state.recordHash, state.assignment);
          if (!existing) fail('storage_error', '同時承認の結果を取得できません。再読込してください。');
          return { approval: existing, created: false };
        }
        return { approval, created: true };
      } finally { await unlink(temporary).catch(() => {}); }
    } finally { await rmdir(lock); }
  });
}
