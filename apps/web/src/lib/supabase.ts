import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// We don't throw if these are missing — the app still renders, but any
// auth call will fail with a clear Supabase error. This keeps the UI
// loadable for review even before the reviewer has wired their own
// Supabase credentials into .env.local.
if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are not set in apps/web/.env.local — auth calls will fail.',
  );
}

export const supabase: SupabaseClient = createClient(
  url ?? 'https://missing.supabase.co',
  anonKey ?? 'missing-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
