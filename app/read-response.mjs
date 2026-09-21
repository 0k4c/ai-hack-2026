// Server error messages are displayed as text, never HTML.
export async function readResponse(response) {
  const fallback = '記録を取得できません。一覧を更新するか、保存した記録ファイルを開いてください。';
  let body;
  try { body = await response.json(); } catch { throw new Error(fallback); }
  if (!response.ok) {
    if (typeof body?.error === 'string' && typeof body?.code === 'string') throw new Error(body.error.slice(0, 500));
    throw new Error(fallback);
  }
  return body;
}
