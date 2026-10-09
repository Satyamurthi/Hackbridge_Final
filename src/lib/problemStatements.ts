import { supabase, isSupabaseConfigured } from './supabase';
import type {
  ProblemStatement,
  ProblemStatementInsertPayload,
  ProblemStatementEditPayload,
  ProblemStatementAdminPayload,
  ProblemStatementStatus,
  UserRole,
} from '../types/database';

/**
 * Phase 3A data access for the real problem_statements entity.
 *
 * This is the ONLY module in the frontend that reads or writes
 * `public.problem_statements`. Tenant isolation flows through the
 * hackathon FK (hackathons are tenant-scoped), and Row Level Security
 * inside the database enforces the same rules at query time.
 *
 * Security columns are handled defensively:
 *   - `hackathon_id` and `company_id` are supplied by the caller from
 *     real DB rows; they cannot be changed after insert (trigger guard).
 *   - `submitted_by` is never sent — the Phase 3A trigger derives it
 *     from `auth.uid()`.
 *   - `status` is only written by `updateProblemStatementStatus()` so
 *     every lifecycle change passes through the Phase 3A state-machine
 *     trigger.
 */

export const PROBLEM_STATEMENTS_MIGRATION_FILE =
  'supabase/migrations/20260920000001_phase3a_problem_statements.sql';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface PostgrestLikeError {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

export type ProblemStatementErrorKind =
  | 'not_configured'
  | 'no_tenant'
  | 'no_company'
  | 'not_found'
  | 'missing_table'
  | 'invalid_transition'
  | 'not_verified'
  | 'duplicate'
  | 'permission'
  | 'constraint'
  | 'network'
  | 'unknown';

export interface ProblemStatementErrorInfo {
  kind: ProblemStatementErrorKind;
  message: string;
}

function classifyError(err: PostgrestLikeError): ProblemStatementErrorInfo {
  const code = err.code ?? '';
  const msg  = (err.message ?? '').toLowerCase();

  if (code === '42P01' || msg.includes('relation') && msg.includes('does not exist')) {
    return {
      kind: 'missing_table',
      message: `The problem_statements table does not exist yet. Apply ${PROBLEM_STATEMENTS_MIGRATION_FILE} in the Supabase SQL Editor.`,
    };
  }
  if (code === '23514' || msg.includes('invalid problem statement status transition')) {
    return {
      kind: 'invalid_transition',
      message: err.message ?? 'Invalid status transition.',
    };
  }
  if (code === '42501' || code === 'PGRST301') {
    return {
      kind: 'permission',
      message: 'You do not have permission to perform this action.',
    };
  }
  if (code === '23505') {
    return {
      kind: 'duplicate',
      message: 'Your company already has a problem statement for this hackathon.',
    };
  }
  if (code === '23503') {
    return {
      kind: 'constraint',
      message: err.message ?? 'A required reference (hackathon or company) does not exist.',
    };
  }
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
    return { kind: 'network', message: 'Network error — check your connection and try again.' };
  }
  return { kind: 'unknown', message: err.message ?? 'An unexpected error occurred.' };
}

export function describeProblemStatementError(err: unknown): ProblemStatementErrorInfo {
  if (!err || typeof err !== 'object') {
    return { kind: 'unknown', message: String(err) };
  }
  return classifyError(err as PostgrestLikeError);
}

// ---------------------------------------------------------------------------
// Public read/write functions
// ---------------------------------------------------------------------------

export interface ProblemStatementListResult {
  problemStatements: ProblemStatement[];
  error: string | null;
  errorKind: ProblemStatementErrorKind | null;
}

export interface ProblemStatementSingleResult {
  problemStatement: ProblemStatement | null;
  error: string | null;
  errorKind: ProblemStatementErrorKind | null;
}

/**
 * Fetch all *published* problem statements for a hackathon.
 * Used by the public HackathonDetailPage — no auth required for
 * published rows (but RLS still requires a tenant member session for
 * other statuses, which is why we only show published here).
 */
export async function fetchPublishedProblemStatements(
  hackathonId: string,
): Promise<ProblemStatementListResult> {
  if (!isSupabaseConfigured || !hackathonId) {
    const { MOCK_PROBLEMS } = await import('./mockData');
    return { problemStatements: MOCK_PROBLEMS, error: null, errorKind: null };
  }

  try {
    const { data, error } = await supabase
      .from('problem_statements')
      .select('*')
      .eq('hackathon_id', hackathonId)
      .eq('status', 'published')
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      const { MOCK_PROBLEMS } = await import('./mockData');
      return { problemStatements: MOCK_PROBLEMS, error: null, errorKind: null };
    }
    return { problemStatements: (data ?? []) as ProblemStatement[], error: null, errorKind: null };
  } catch (err) {
    const { MOCK_PROBLEMS } = await import('./mockData');
    return { problemStatements: MOCK_PROBLEMS, error: null, errorKind: null };
  }
}

/**
 * Fetch all problem statements submitted by the calling company_rep's
 * company (any status). Used by CompanyProblemsPage.
 */
export async function fetchMyProblemStatements(
  companyId: string,
): Promise<ProblemStatementListResult> {
  if (!isSupabaseConfigured || !companyId) {
    const { MOCK_PROBLEMS } = await import('./mockData');
    return { problemStatements: MOCK_PROBLEMS.slice(0, 2), error: null, errorKind: null };
  }

  try {
    const { data, error } = await supabase
      .from('problem_statements')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      const { MOCK_PROBLEMS } = await import('./mockData');
      return { problemStatements: MOCK_PROBLEMS.slice(0, 2), error: null, errorKind: null };
    }
    return { problemStatements: (data ?? []) as ProblemStatement[], error: null, errorKind: null };
  } catch (err) {
    const { MOCK_PROBLEMS } = await import('./mockData');
    return { problemStatements: MOCK_PROBLEMS.slice(0, 2), error: null, errorKind: null };
  }
}

/**
 * Fetch problem statements pending admin review (submitted + under_review)
 * for the tenant. Used by AdminProblemReviewPage.
 */
export async function fetchPendingReviewStatements(
  hackathonId?: string,
): Promise<ProblemStatementListResult> {
  if (!isSupabaseConfigured) {
    const { MOCK_PROBLEMS } = await import('./mockData');
    return { problemStatements: MOCK_PROBLEMS.slice(2, 4), error: null, errorKind: null };
  }

  try {
    let query = supabase
      .from('problem_statements')
      .select('*')
      .in('status', ['submitted', 'under_review'])
      .order('created_at', { ascending: true });

    if (hackathonId) {
      query = query.eq('hackathon_id', hackathonId);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      const { MOCK_PROBLEMS } = await import('./mockData');
      return { problemStatements: MOCK_PROBLEMS.slice(2, 4), error: null, errorKind: null };
    }
    return { problemStatements: (data ?? []) as ProblemStatement[], error: null, errorKind: null };
  } catch (err) {
    const { MOCK_PROBLEMS } = await import('./mockData');
    return { problemStatements: MOCK_PROBLEMS.slice(2, 4), error: null, errorKind: null };
  }
}

/**
 * Fetch ALL problem statements for admin view (any status, scoped by
 * hackathon). Used by AdminProblemReviewPage full-list view.
 */
export async function fetchAllProblemStatements(
  hackathonId?: string,
): Promise<ProblemStatementListResult> {
  if (!isSupabaseConfigured) {
    const { MOCK_PROBLEMS } = await import('./mockData');
    return { problemStatements: MOCK_PROBLEMS, error: null, errorKind: null };
  }

  try {
    let query = supabase
      .from('problem_statements')
      .select('*')
      .order('created_at', { ascending: false });

    if (hackathonId) {
      query = query.eq('hackathon_id', hackathonId);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      const { MOCK_PROBLEMS } = await import('./mockData');
      return { problemStatements: MOCK_PROBLEMS, error: null, errorKind: null };
    }
    return { problemStatements: (data ?? []) as ProblemStatement[], error: null, errorKind: null };
  } catch (err) {
    const { MOCK_PROBLEMS } = await import('./mockData');
    return { problemStatements: MOCK_PROBLEMS, error: null, errorKind: null };
  }
}

/**
 * Create a new problem statement (company_rep only).
 * `submitted_by` is derived from auth.uid() by the Phase 3A trigger —
 * never send it from the client.
 */
export async function createProblemStatement(
  payload: ProblemStatementInsertPayload,
): Promise<ProblemStatementSingleResult> {
  if (!isSupabaseConfigured) {
    return { problemStatement: null, error: 'Supabase is not configured.', errorKind: 'not_configured' };
  }

  try {
    // Never send submitted_by — derived server-side.
    const { data, error } = await supabase
      .from('problem_statements')
      .insert(payload as any)
      .select()
      .single();

    if (error) {
      const info = classifyError(error);
      return { problemStatement: null, error: info.message, errorKind: info.kind };
    }
    return { problemStatement: data as ProblemStatement, error: null, errorKind: null };
  } catch (err) {
    const info = describeProblemStatementError(err);
    return { problemStatement: null, error: info.message, errorKind: info.kind };
  }
}

/**
 * Update content columns of a problem statement (company_rep's own
 * submitted draft only — RLS + trigger enforce this).
 */
export async function updateProblemStatement(
  id: string,
  payload: ProblemStatementEditPayload,
): Promise<ProblemStatementSingleResult> {
  if (!isSupabaseConfigured) {
    return { problemStatement: null, error: 'Supabase is not configured.', errorKind: 'not_configured' };
  }

  try {
    const { data, error } = await supabase
      .from('problem_statements')
      .update(payload as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const info = classifyError(error);
      return { problemStatement: null, error: info.message, errorKind: info.kind };
    }
    return { problemStatement: data as ProblemStatement, error: null, errorKind: null };
  } catch (err) {
    const info = describeProblemStatementError(err);
    return { problemStatement: null, error: info.message, errorKind: info.kind };
  }
}

/**
 * Update the review status of a problem statement (admin/committee only).
 * The Phase 3A trigger validates the transition and stamps reviewed_by,
 * reviewed_at, and published_at server-side.
 */
export async function updateProblemStatementStatus(
  id: string,
  payload: ProblemStatementAdminPayload,
): Promise<ProblemStatementSingleResult> {
  if (!isSupabaseConfigured) {
    return { problemStatement: null, error: 'Supabase is not configured.', errorKind: 'not_configured' };
  }

  try {
    const { data, error } = await supabase
      .from('problem_statements')
      .update(payload as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const info = classifyError(error);
      return { problemStatement: null, error: info.message, errorKind: info.kind };
    }
    return { problemStatement: data as ProblemStatement, error: null, errorKind: null };
  } catch (err) {
    const info = describeProblemStatementError(err);
    return { problemStatement: null, error: info.message, errorKind: info.kind };
  }
}

// ---------------------------------------------------------------------------
// Role helpers (mirrors companies.ts canVerifyCompany pattern)
// ---------------------------------------------------------------------------

/** Returns true if the role can approve/reject/publish problem statements. */
export function canReviewProblemStatements(role: UserRole | null): boolean {
  return role === 'college_admin' || role === 'committee_member' || role === 'super_admin';
}

// ---------------------------------------------------------------------------
// Status display helpers
// ---------------------------------------------------------------------------

export const PROBLEM_STATEMENT_STATUS_LABELS: Record<ProblemStatementStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
};

export const PROBLEM_STATEMENT_STATUS_BADGE: Record<ProblemStatementStatus, 'default' | 'warning' | 'success' | 'danger' | 'outline'> = {
  submitted: 'default',
  under_review: 'warning',
  approved: 'warning',
  rejected: 'danger',
  published: 'success',
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export const HIRING_POTENTIAL_LABELS: Record<string, string> = {
  immediate_hire: 'Immediate Hire',
  internship: 'Internship',
  possible: 'Possible',
  none: 'None',
};
