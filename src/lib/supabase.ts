import "expo-sqlite/localStorage/install";
import { createClient } from "@supabase/supabase-js";

// The project URL is public configuration. The publishable key is supplied
// through the app environment and must never be replaced with a secret key.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://mvhvazypzikqoihznkka.supabase.co";
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: globalThis.localStorage
      }
    })
  : null;
