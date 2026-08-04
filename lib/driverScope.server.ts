import { cookies } from 'next/headers';
import { DRIVER_COOKIE, parseScope } from './driverScope';

/**
 * The driver the dashboard is scoped to, for server components.
 *
 * Split from `driverScope.ts` so the client-side picker can share the cookie
 * name without dragging `next/headers` into the browser bundle.
 */
export async function driverScope(): Promise<string | null> {
  return parseScope((await cookies()).get(DRIVER_COOKIE)?.value);
}
