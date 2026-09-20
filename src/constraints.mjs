const DAY = 86_400_000;

export function dateNumber(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日付はYYYY-MM-DDで指定してください。');
  const value = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) throw new Error('存在しない日付です。');
  return value;
}

export function addDays(date, days) {
  return new Date(dateNumber(date) + days * DAY).toISOString().slice(0, 10);
}

export function monday(date) {
  return addDays(date, -((new Date(dateNumber(date)).getUTCDay() + 6) % 7));
}

function minutes(time) {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('時刻はHH:MMで指定してください。');
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

function shiftMinutes(shift) {
  dateNumber(shift.date);
  const duration = minutes(shift.end) - minutes(shift.start);
  if (duration <= 0) throw new Error('勤務終了は開始より後にしてください（日跨ぎは未対応）。');
  return duration;
}

export function filterCandidates(employees, vacancy) {
  const duration = shiftMinutes(vacancy);
  if (!Array.isArray(employees) || employees.length === 0) throw new Error('従業員が必要です。');
  const ids = new Set();
  for (const employee of employees) {
    if (!/^e\d+$/.test(employee.id) || ids.has(employee.id)) throw new Error('従業員IDが不正または重複しています。');
    ids.add(employee.id);
    if (!Number.isInteger(employee.maxConsecutiveDays) || employee.maxConsecutiveDays < 1 ||
        !Number.isFinite(employee.maxWeeklyHours) || employee.maxWeeklyHours <= 0 ||
        !Array.isArray(employee.shifts) || !Array.isArray(employee.requestedDaysOff)) throw new Error('従業員の勤務条件が不正です。');
    employee.requestedDaysOff.forEach(dateNumber);
    employee.shifts.forEach(shiftMinutes);
    const sorted = [...employee.shifts].sort((a, b) => a.date.localeCompare(b.date) || minutes(a.start) - minutes(b.start));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].date === sorted[i - 1].date && minutes(sorted[i].start) < minutes(sorted[i - 1].end)) throw new Error('登録済み勤務が重複しています。');
    }
  }
  if (!ids.has(vacancy.absentEmployeeId)) throw new Error('欠勤者IDが存在しません。');
  const weekStart = monday(vacancy.date);
  const weekEnd = addDays(weekStart, 7);
  const evaluations = employees.map(employee => {
    const reasons = [];
    if (employee.id === vacancy.absentEmployeeId) reasons.push('absent_employee');
    if (employee.requestedDaysOff.includes(vacancy.date)) reasons.push('requested_day_off');
    if (employee.shifts.some(s => s.date === vacancy.date && minutes(s.start) < minutes(vacancy.end) && minutes(s.end) > minutes(vacancy.start))) reasons.push('shift_overlap');
    const weeklyMinutesBefore = employee.shifts.filter(s => s.date >= weekStart && s.date < weekEnd).reduce((sum, s) => sum + shiftMinutes(s), 0);
    const weeklyMinutesAfter = weeklyMinutesBefore + duration;
    if (weeklyMinutesAfter > employee.maxWeeklyHours * 60) reasons.push('weekly_hours_limit');
    const days = new Set(employee.shifts.map(s => s.date));
    let consecutiveDaysAfter = 1;
    for (const direction of [-1, 1]) {
      for (let offset = direction; days.has(addDays(vacancy.date, offset)); offset += direction) consecutiveDaysAfter++;
    }
    if (consecutiveDaysAfter > employee.maxConsecutiveDays) reasons.push('consecutive_days_limit');
    return {
      employeeId: employee.id, eligible: reasons.length === 0, reasons,
      weeklyHoursBefore: weeklyMinutesBefore / 60, weeklyHoursAfter: weeklyMinutesAfter / 60,
      maxWeeklyHours: employee.maxWeeklyHours, consecutiveDaysAfter,
      maxConsecutiveDays: employee.maxConsecutiveDays,
    };
  });
  return { weekStart, evaluations, candidates: evaluations.filter(e => e.eligible) };
}
