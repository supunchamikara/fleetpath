import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

/**
 * Browser client. The publishable key is meant to ship to clients — it names
 * the project and grants nothing by itself; Row Level Security decides what a
 * session may read. Never expose a service_role key through NEXT_PUBLIC_*.
 */
export const createClient = () =>
  createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export { isConfigured } from './env';
