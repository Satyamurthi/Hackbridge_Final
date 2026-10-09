/// <reference types="vite/client" />

// Ambient types for the HackBridge frontend.
// This file provides the Vite client typings that were missing from the
// project (import.meta.env, CSS side-effect imports, asset imports). Without
// it, `import.meta.env` and `import './index.css'` fail type-checking under
// the strict tsconfig used here.

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://<project-ref>.supabase.co */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon/publishable key used by the browser client. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Fallback tenant slug used when a hostname cannot be resolved. */
  readonly VITE_DEFAULT_TENANT_SLUG?: string;
}

// Note: `ImportMeta` itself (including `import.meta.env` and the DEV/PROD/MODE
// flags) is declared by the `vite/client` reference above, so it is intentionally
// not redeclared here. This block only augments `ImportMetaEnv` with the
// HackBridge-specific variables.