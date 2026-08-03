/**
 * PIN hashing, byte-for-byte compatible with the Flutter app.
 *
 * The app computes `sha256("<salt>::<pin>")` and stores the lowercase hex
 * digest plus the salt verbatim (see lib/data/user_repository.dart). Anything
 * created here must verify there, so this must not drift.
 *
 * A 4-digit PIN is 10,000 combinations; the salt stops two users with the same
 * PIN sharing a digest, but it is not a barrier to an offline search if these
 * rows ever leak. RLS is the real protection.
 */

const PIN_RE = /^\d{4}$/;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,20}$/;

export const isValidPin = (pin: string) => PIN_RE.test(pin);
export const isValidUsername = (name: string) => USERNAME_RE.test(name.trim());

/** 16 random bytes, base64 — matches the app's `base64Url.encode`. */
export function newSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_');
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}::${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** RFC-4122 v4, the same shape the app mints for new rows. */
export function newUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = (s: number, e: number) =>
    [...b.slice(s, e)].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}`;
}
