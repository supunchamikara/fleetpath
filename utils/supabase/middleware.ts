import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isConfigured } from './env';

/**
 * Refreshes the auth cookie on every request and gates the dashboard.
 *
 * The `getUser()` call below is the whole point: creating the client alone
 * refreshes nothing. It revalidates the token with Supabase and, through the
 * cookie handlers, writes the rotated session back onto the response. Drop it
 * and sessions silently expire mid-session.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Only reachable in dev — a production build with these unset fails in
  // `env.ts`. Passing through lets /login render its "Not configured" notice
  // instead of every route dying on a client that cannot be constructed.
  if (!isConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && path.startsWith('/dashboard')) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/login';
    return NextResponse.redirect(redirect);
  }

  if (user && path === '/login') {
    const redirect = request.nextUrl.clone();
    redirect.pathname = '/dashboard';
    return NextResponse.redirect(redirect);
  }

  return response;
}
