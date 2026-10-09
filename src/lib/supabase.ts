import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

/**
 * True only for the local development server (`vite dev`).
 * Vite inlines this flag at build time, so it is permanently `false` in any
 * production bundle (`vite build` / `vite preview`). It is used to isolate
 * developer conveniences that must never reach production.
 */
export const isDevelopment = import.meta.env.DEV === true;
export const isDemoMode = isDevelopment || (typeof window !== 'undefined' && window.location.hostname.includes('streamlit.app'));

/** Detects template / placeholder values so they can never count as configured. */
const isPlaceholderValue = (value: string): boolean =>
  !value ||
  value.includes('your-project-ref') ||
  value.includes('your-supabase-anon-key') ||
  value.includes('placeholder.supabase.co');

/** The project URL must be a real absolute http(s) URL. */
const isValidProjectUrl = (value: string): boolean => {
  if (isPlaceholderValue(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

/**
 * Accepts either a legacy JWT anon key (three base64url segments) or the newer
 * publishable key format (`sb_publishable_...`). Anything else - including
 * empty strings and template placeholders - is treated as not configured.
 */
const looksLikeSupabaseKey = (value: string): boolean => {
  if (isPlaceholderValue(value) || value.length < 20) return false;
  return (value.startsWith('eyJ') && value.split('.').length === 3) || value.startsWith('sb_publishable_');
};

/**
 * Configuration gate for the whole client.
 *
 * When this is `false` the platform MUST fail closed in production:
 * `ProtectedRoute` refuses to render protected workspaces and no privileged
 * request is attempted. Development builds get an explicitly labelled
 * mock-data mode instead (see `isDevelopment`).
 */
export const isSupabaseConfigured =
  isValidProjectUrl(supabaseUrl) && looksLikeSupabaseKey(supabaseAnonKey);

/** Human-readable reason shown to operators when configuration is unusable. */
export const supabaseConfigurationIssue: string | null = isSupabaseConfigured
  ? null
  : !supabaseUrl || !supabaseAnonKey
    ? 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not both set.'
    : !isValidProjectUrl(supabaseUrl)
      ? 'VITE_SUPABASE_URL is not a valid absolute project URL.'
      : 'VITE_SUPABASE_ANON_KEY is not a valid Supabase anon / publishable key.';

if (!isSupabaseConfigured) {
  console.warn(
    `[HackBridge] Supabase is not configured (${supabaseConfigurationIssue}) ` +
      'Protected workspaces are disabled in production builds; ' +
      'set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

// Create Supabase client (dummy fallback values to avoid constructor throwing if missing)
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
