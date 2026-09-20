import { readFile } from 'node:fs/promises';
import { addDays, monday } from './constraints.mjs';

// Relative dates keep the synthetic demo reproducible on any day of the week.
export async function createSeed(date) {
  const templates = JSON.parse(await readFile(new URL('../data/employees.seed.json', import.meta.url), 'utf8'));
  return templates.map(({ workDayOffsets, requestedDayOffsets, workWeekExceptTarget, ...employee }) => ({
    ...employee,
    requestedDaysOff: requestedDayOffsets.map(offset => addDays(date, offset)),
    shifts: workWeekExceptTarget
      ? Array.from({ length: 7 }, (_, offset) => addDays(monday(date), offset))
        .filter(day => day !== date).map(day => ({ date: day, start: '09:00', end: '14:00' }))
      : workDayOffsets.map(offset => ({ date: addDays(date, offset), start: '18:00', end: '22:00' })),
  }));
}
