const names = { e1:'田中', e2:'佐藤', e3:'鈴木', e4:'高橋', e5:'伊藤', e6:'渡辺' };
export const personName = id => Object.hasOwn(names, id) ? names[id] : '氏名未登録';
export function friendlyText(value) {
  return String(value ?? '不明').replace(/(?<![A-Za-z0-9_])e[1-6](?![A-Za-z0-9_])/g, id => names[id])
    .replace(/remainingCandidates/g, '残りの候補').replace(/remainingRounds/g, '残りの打診回数').replace(/eligible/g, '勤務条件を満たす');
}
export function recordLabel(record) {
  const vacancy = record?.vacancy;
  if (!vacancy?.date || !vacancy.start || !vacancy.end) return '内容を確認できない記録';
  return `${vacancy.date} ${vacancy.start}〜${vacancy.end} ${personName(vacancy.absentEmployeeId)}さんの欠勤対応`;
}
