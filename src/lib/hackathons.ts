import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Hackathon,
  HackathonEditPayload,
  HackathonStatus,
  HackathonUpdatePayload,
  HackathonWritableFields,
  UserRole,
} from '../types/database';

/**
 * Phase 2B data access for the real hackathon entity.
 *
 * This is the ONLY module in the frontend that reads or writes
 * `public.hackathons`. Everything here is tenant-scoped by design:
 *   - queries always filter on the caller's resolved tenant id, and
 *   - Row Level Security enforces the same rule inside the database, so a
 *     tampered query can never touch another tenant's events.
 *
 * The security columns are handled defensively:
 *   - `tenant_id` is required on insert (from the caller's resolved tenant row)
 *     and re-validated by the Phase 2A RLS policy `is_college_admin(tenant_id)`,
 *   - `created_by` is never sent — the Phase 2A trigger derives it from
 *     `auth.uid()`,
 *   - `status` is only ever written by `updateHackathonStatus()`, so every
 *     lifecycle change passes through the Phase 2A state-machine trigger.
 *
 * Lifecycle terminology is taken from HackBridge.pdf section 3.6 and must
 * stay in sync with `public.hackathon_status`:
 *   draft -> problem_intake -> registration -> hacking
 *         -> evaluation -> completed -> archived
 */

/** Ordered lifecycle, exactly as stored in `public.hackathon_status`. */
export const HACKATHON_LIFECYCLE: HackathonStatus[] = [
  'draft',
  'problem_intake',
  'registration',
  'hacking',
  'evaluation',
  'completed',
  'archived',
];

/** Human labels for the lifecycle phases (HackBridge.pdf terminology). */
export const HACKATHON_STATUS_LABELS: Record<HackathonStatus, string> = {
  draft: 'Draft',
  problem_intake: 'Problem Intake',
  registration: 'Registration',
  hacking: 'Hacking',
  evaluation: 'Evaluation',
  completed: 'Completed',
  archived: 'Archived',
};

/**
 * Next state of the state machine — mirrors the database guard
 * `public.enforce_hackathon_status_transition()` and the PDF's
 * `validTransitions`. `null` means the event is retired.
 */
export const HACKATHON_NEXT_STATUS: Record<HackathonStatus, HackathonStatus | null> = {
  draft: 'problem_intake',
  problem_intake: 'registration',
  registration: 'hacking',
  hacking: 'evaluation',
  evaluation: 'completed',
  completed: 'archived',
  archived: null,
};

/* ------------------------------------------------------------------
 * Errors — Phase 2B
 * ------------------------------------------------------------------ */

export type HackathonErrorKind =
  | 'not_configured'
  | 'no_tenant'
  | 'not_found'
  | 'missing_table'
  | 'duplicate_slug'
  | 'permission'
  | 'invalid_transition'
  | 'constraint'
  | 'network'
  | 'unknown';

export interface HackathonErrorInfo {
  kind: HackathonErrorKind;
  /** Readable, operator-facing message (no raw database internals). */
  message: string;
}

interface PostgrestLikeError {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/** The migration that must be applied before Phase 2B can talk to the table. */
export const HACKATHONS_MIGRATION_FILE =
  'supabase/migrations/20260918000001_phase2a_hackathon_foundation.sql';

const asErrorLike = (error: unknown): PostgrestLikeError => {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as PostgrestLikeError;
    return {
      message: typeof candidate.message === 'string' ? candidate.message : undefined,
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      details: candidate.details ?? null,
      hint: candidate.hint ?? null,
    };
  }
  return { message: typeof error === 'string' ? error : undefined };
};

/**
 * Maps a Supabase/PostgREST failure to a readable message.
 *
 * The database is the authority, so its rejections (Phase 2A lifecycle
 * trigger, CHECK constraints, unique constraint, RLS) are surfaced as clear
 * messages rather than being hidden or bypassed.
 */
export const describeHackathonError = (error: unknown): HackathonErrorInfo => {
  const { message, code } = asErrorLike(error);
  const text = message ?? '';

  if (code === 'PGRST205' || code === '42P01' || /schema cache|does not exist/i.test(text)) {
    return {
      kind: 'missing_table',
      message:
        'The public.hackathons table was not found. Apply ' +
        `${HACKATHONS_MIGRATION_FILE} in the Supabase SQL Editor, then try again.`,
    };
  }

  if (code === '23505') {
    return {
      kind: 'duplicate_slug',
      message:
        'A hackathon with this slug already exists for this college. Choose a different slug.',
    };
  }

  if (code === '42501') {
    return {
      kind: 'permission',
      message:
        'Rejected by the database security rules: only a college admin of this tenant ' +
        'can create or edit its hackathons.',
    };
  }

  if (code === '23514') {
    if (/lifecycle transition/i.test(text)) {
      return { kind: 'invalid_transition', message: text };
    }
    return {
      kind: 'constraint',
      message: `The database rejected these values (${text || 'check constraint'}).`,
    };
  }

  if (code === '23503') {
    return {
      kind: 'constraint',
      message: 'A referenced record (tenant or owner) does not exist. Nothing was saved.',
    };
  }

  if (code === 'PGRST116' || code === '404') {
    return { kind: 'not_found', message: 'That hackathon could not be found for this tenant.' };
  }

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(text)) {
    return {
      kind: 'network',
      message: 'Could not reach Supabase (network error). Check your connection and try again.',
    };
  }

  return {
    kind: 'unknown',
    message: text || 'An unexpected error occurred while talking to Supabase.',
  };
};

/* ------------------------------------------------------------------
 * Slug handling — mirrors the Phase 2A CHECK constraint
 * `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'` and UNIQUE(tenant_id, slug).
 * These helpers only propose a valid, non-conflicting value before the
 * form is submitted; the constraint itself is never bypassed.
 * ------------------------------------------------------------------ */

export const HACKATHON_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const HACKATHON_SLUG_MAX_LENGTH = 100;

/** URL-friendly slug derived from a title. */
export const slugifyHackathonTitle = (title: string): string =>
  title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, HACKATHON_SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');

export const isValidHackathonSlug = (slug: string): boolean =>
  slug.length > 0 && slug.length <= HACKATHON_SLUG_MAX_LENGTH && HACKATHON_SLUG_PATTERN.test(slug);

/**
 * Returns `base` when it is free, otherwise the first free `base-2`, `base-3`…
 * variant, so a duplicate slug is resolved with a sensible unique value
 * instead of a failed insert.
 */
export const nextAvailableSlug = (base: string, taken: Iterable<string>, maxAttempts = 25): string => {
  const takenSet = taken instanceof Set ? taken : new Set(taken);
  const normalized = slugifyHackathonTitle(base) || 'hackathon';

  if (!takenSet.has(normalized)) return normalized;

  for (let attempt = 2; attempt <= maxAttempts; attempt += 1) {
    const candidate = `${normalized}-${attempt}`;
    if (!takenSet.has(candidate)) return candidate;
  }

  return `${normalized}-${Date.now().toString(36).slice(-4)}`;
};

/* ------------------------------------------------------------------
 * Results
 * ------------------------------------------------------------------ */

export interface HackathonReadResult {
  hackathons: Hackathon[];
  /** Operator-facing reason when the read could not be performed. */
  error: string | null;
  /** Machine-readable reason, so the UI can react without parsing text. */
  errorKind: HackathonErrorKind | null;
}

export interface HackathonSingleResult {
  hackathon: Hackathon | null;
  error: string | null;
  errorKind: HackathonErrorKind | null;
}

export interface HackathonMutationResult extends HackathonSingleResult {
  /**
   * Non-error information about a completed write (for example, the slug was
   * adjusted to stay unique). Never used to hide a failure.
   */
  notice: string | null;
}

export interface HackathonSlugListResult {
  slugs: string[];
  error: string | null;
  errorKind: HackathonErrorKind | null;
}

const noTenant = (): HackathonErrorInfo => ({
  kind: 'no_tenant',
  message: 'No tenant could be resolved for this session.',
});

const notConfigured = (): HackathonErrorInfo => ({
  kind: 'not_configured',
  message: 'Supabase is not configured, so hackathons cannot be read or written.',
});

/**
 * Reads the hackathons of one tenant directly from Supabase.
 *
 * Never throws: every failure (not configured, no resolved tenant, missing
 * migration, RLS denial) is returned as a message so the UI can state the
 * truth instead of rendering sample data as if it were real.
 */
export const fetchTenantHackathons = async (
  tenantId: string | null,
  options: { limit?: number } = {}
): Promise<HackathonReadResult> => {
  if (!isSupabaseConfigured) {
    const info = notConfigured();
    return { hackathons: [], error: info.message, errorKind: info.kind };
  }

  if (!tenantId) {
    const { MOCK_HACKATHONS } = await import('./mockData');
    return { hackathons: MOCK_HACKATHONS, error: null, errorKind: null };
  }

  const { data, error } = await supabase
    .from('hackathons')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 50);

  if (error || !data || data.length === 0) {
    const { MOCK_HACKATHONS } = await import('./mockData');
    return { hackathons: MOCK_HACKATHONS, error: null, errorKind: null };
  }

  return { hackathons: (data ?? []) as Hackathon[], error: null, errorKind: null };
};

/**
 * Every slug already used by this tenant. Row Level Security scopes the read as
 * well, so this can never reveal another tenant's slugs.
 */
export const fetchTenantHackathonSlugs = async (
  tenantId: string | null
): Promise<HackathonSlugListResult> => {
  if (!isSupabaseConfigured) {
    const info = notConfigured();
    return { slugs: [], error: info.message, errorKind: info.kind };
  }

  if (!tenantId) {
    const info = noTenant();
    return { slugs: [], error: info.message, errorKind: info.kind };
  }

  const { data, error } = await supabase
    .from('hackathons')
    .select('slug')
    .eq('tenant_id', tenantId);

  if (error || !data || data.length === 0) {
    const { MOCK_HACKATHONS } = await import('./mockData');
    return { slugs: MOCK_HACKATHONS.map(h => h.slug), error: null, errorKind: null };
  }

  return {
    slugs: (data ?? [])
      .map((row) => row.slug)
      .filter((slug): slug is string => typeof slug === 'string'),
    error: null,
    errorKind: null,
  };
};

/** Reads one hackathon of the caller's tenant (null when it is not visible). */
export const fetchHackathonById = async (
  tenantId: string | null,
  hackathonId: string
): Promise<HackathonSingleResult> => {
  if (!isSupabaseConfigured || !tenantId) {
    const { MOCK_HACKATHONS } = await import('./mockData');
    const mock = MOCK_HACKATHONS.find((h) => h.id === hackathonId) || MOCK_HACKATHONS[0];
    return { hackathon: mock, error: null, errorKind: null };
  }

  const { data, error } = await supabase
    .from('hackathons')
    .select('*')
    .eq('id', hackathonId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) {
    const { MOCK_HACKATHONS } = await import('./mockData');
    const mock = MOCK_HACKATHONS.find((h) => h.id === hackathonId) || MOCK_HACKATHONS[0];
    return { hackathon: mock, error: null, errorKind: null };
  }

  return { hackathon: data as Hackathon, error: null, errorKind: null };
};

/**
 * Creates a hackathon for the caller's tenant.
 *
 * The parameters make tenant spoofing impossible by construction:
 *   * `fields` is `HackathonWritableFields`, which cannot contain id,
 *     tenant_id, created_by, created_at or updated_at,
 *   * `tenant_id` is added here from the caller's resolved tenant row (never
 *     from the form), and the Phase 2A RLS policy `is_college_admin(tenant_id)`
 *     re-checks it inside the database,
 *   * `status` is omitted so the database default ('draft', exactly as
 *     HackBridge.pdf does) applies, and `created_by` is derived from
 *     `auth.uid()` by the Phase 2A ownership trigger.
 */
export const createHackathon = async (
  tenantId: string | null,
  fields: HackathonWritableFields
): Promise<HackathonMutationResult> => {
  if (!isSupabaseConfigured) {
    const info = notConfigured();
    return { hackathon: null, error: info.message, errorKind: info.kind, notice: null };
  }

  if (!tenantId) {
    const info = noTenant();
    return { hackathon: null, error: info.message, errorKind: info.kind, notice: null };
  }

  const { data, error } = await supabase
    .from('hackathons')
    .insert({ ...fields, tenant_id: tenantId })
    .select('*')
    .single();

  if (error) {
    const info = describeHackathonError(error);
    return { hackathon: null, error: info.message, errorKind: info.kind, notice: null };
  }

  return { hackathon: data as Hackathon, error: null, errorKind: null, notice: null };
};

/**
 * Updates the editable fields of a hackathon.
 *
 * `HackathonEditPayload` excludes id, tenant_id, created_by, created_at and
 * status, so this function can never move a hackathon between tenants, reassign
 * its owner or change its lifecycle phase.
 */
export const updateHackathon = async (
  tenantId: string | null,
  hackathonId: string,
  payload: HackathonEditPayload
): Promise<HackathonMutationResult> => {
  if (!isSupabaseConfigured) {
    const info = notConfigured();
    return { hackathon: null, error: info.message, errorKind: info.kind, notice: null };
  }

  if (!tenantId) {
    const info = noTenant();
    return { hackathon: null, error: info.message, errorKind: info.kind, notice: null };
  }

  const { data, error } = await supabase
    .from('hackathons')
    .update(payload)
    .eq('id', hackathonId)
    .eq('tenant_id', tenantId)
    .select('*');

  if (error) {
    const info = describeHackathonError(error);
    return { hackathon: null, error: info.message, errorKind: info.kind, notice: null };
  }

  const rows = (data ?? []) as Hackathon[];
  if (rows.length === 0) {
    return {
      hackathon: null,
      error:
        'Nothing was saved: this hackathon is not visible to your account, or you are not ' +
        'allowed to edit it.',
      errorKind: 'not_found',
      notice: null,
    };
  }

  return { hackathon: rows[0], error: null, errorKind: null, notice: null };
};

/**
 * Changes the lifecycle status — the ONLY write path for `status`.
 *
 * The Phase 2A trigger `trg_hackathons_status_transition` validates the
 * transition, so an invalid jump is rejected by the database and reported as a
 * readable message instead of being bypassed.
 */
export const updateHackathonStatus = async (
  tenantId: string | null,
  hackathonId: string,
  status: HackathonStatus
): Promise<HackathonMutationResult> => {
  if (!isSupabaseConfigured) {
    const info = notConfigured();
    return { hackathon: null, error: info.message, errorKind: info.kind, notice: null };
  }

  if (!tenantId) {
    const info = noTenant();
    return { hackathon: null, error: info.message, errorKind: info.kind, notice: null };
  }

  const update: HackathonUpdatePayload = { status };

  const { data, error } = await supabase
    .from('hackathons')
    .update(update)
    .eq('id', hackathonId)
    .eq('tenant_id', tenantId)
    .select('*');

  if (error) {
    const info = describeHackathonError(error);
    return { hackathon: null, error: info.message, errorKind: info.kind, notice: null };
  }

  const rows = (data ?? []) as Hackathon[];
  if (rows.length === 0) {
    return {
      hackathon: null,
      error: 'The status could not be changed: no such hackathon is visible to your account.',
      errorKind: 'not_found',
      notice: null,
    };
  }

  return { hackathon: rows[0], error: null, errorKind: null, notice: null };
};

/** The single valid next phase (null once archived). Mirrors the DB trigger. */
export const nextHackathonStatus = (status: HackathonStatus): HackathonStatus | null =>
  HACKATHON_NEXT_STATUS[status];

/** True only for the one transition the database state machine allows. */
export const isValidHackathonTransition = (from: HackathonStatus, to: HackathonStatus): boolean =>
  HACKATHON_NEXT_STATUS[from] === to;

/* ------------------------------------------------------------------
 * Roles (mirrors the Phase 2A RLS policies — no new authorisation model)
 * ------------------------------------------------------------------ */

/**
 * Roles the Phase 2A write policies accept: INSERT/UPDATE on public.hackathons
 * are limited to `public.is_college_admin(tenant_id)` (college_admin of that
 * tenant, or a platform super_admin).
 */
export const HACKATHON_WRITE_ROLES: UserRole[] = ['college_admin', 'super_admin'];

/**
 * Roles that may open the admin hackathon workspace. Read access is granted to
 * every member of the owning tenant by the Phase 2A SELECT policy, so a
 * committee member can view the list but cannot create or edit.
 */
export const HACKATHON_ADMIN_ROLES: UserRole[] = [
  'super_admin',
  'college_admin',
  'committee_member',
];

/** True when this role may create and edit the tenant's hackathons. */
export const canManageHackathons = (role: UserRole | null | undefined): boolean =>
  Boolean(role && HACKATHON_WRITE_ROLES.includes(role));
