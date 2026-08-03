import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Browser client. The publishable key is meant to ship to clients — it names
 * the project and grants nothing by itself; Row Level Security decides what a
 * session may read. Never expose a service_role key through NEXT_PUBLIC_*.
 */
export const createClient = () => createBrowserClient(url!, key!);

export const isConfigured = Boolean(url && key);
