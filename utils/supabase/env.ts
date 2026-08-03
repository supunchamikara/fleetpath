/**
 * Supabase connection details, resolved once for every client in this folder.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so a variable missing on
 * the host is baked into the bundle as `undefined` and only shows up at
 * runtime — as an opaque MIDDLEWARE_INVOCATION_FAILED 500 on *every* route,
 * because the middleware matcher covers the whole site. Failing the production
 * build instead turns that into a deploy error naming the missing variable.
 *
 * Dev deliberately keeps degrading instead of throwing: a fresh clone with no
 * `.env.local` should still render /login and its "Not configured" notice.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isConfigured = Boolean(url && key);

if (!isConfigured && process.env.NODE_ENV === 'production') {
  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !key && 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ]
    .filter(Boolean)
    .join(', ');

  throw new Error(
    `Missing required environment variable(s): ${missing}. ` +
      'Set them under Vercel → Settings → Environment Variables for every ' +
      'environment, then redeploy: NEXT_PUBLIC_* values are read at build ' +
      'time, so adding them without a fresh build changes nothing.',
  );
}

export const SUPABASE_URL = url as string;
export const SUPABASE_PUBLISHABLE_KEY = key as string;
