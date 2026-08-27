import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase env vars are not set — copy apps/crm/.env.example to apps/crm/.env and fill in your project's values.",
  );
}

// createClient() throws synchronously on an empty URL, which would blank the
// whole app before any real project is wired up — fall back to a well-formed
// placeholder so the UI shell still renders; auth calls will just fail until
// real values are supplied.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
);
