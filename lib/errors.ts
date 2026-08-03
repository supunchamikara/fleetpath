/**
 * Supabase rejections are plain objects, not `Error`s, so `String(e)` yields
 * "[object Object]" and hides the actual problem. Pull the useful fields out
 * and translate the failures that mean "the schema is out of date".
 */
export function describeError(e: unknown): string {
  if (typeof e === 'string') return e;

  const err = e as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  } | null;

  const code = err?.code;
  const message = err?.message ?? (e instanceof Error ? e.message : '');

  // 42703 = undefined_column, 42P01 = undefined_table, PGRST205 = not in cache.
  if (code === '42703' || code === '42P01' || code === 'PGRST205') {
    return `${message || 'Missing table or column'} — re-run supabase/schema.sql in the Supabase SQL editor.`;
  }
  if (code === '23505' || message.includes('duplicate key')) {
    return 'That username is already taken.';
  }
  if (code === '42501' || message.includes('row-level security')) {
    return 'Blocked by row level security — check the policies in supabase/schema.sql.';
  }

  const parts = [message, err?.details, err?.hint].filter(Boolean);
  return parts.length ? parts.join(' · ') : JSON.stringify(e);
}
