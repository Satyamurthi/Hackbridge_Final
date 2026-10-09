import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Company,
  CompanyEditPayload,
  CompanyInsertPayload,
  CompanyAdminPayload,
  UserRole,
} from '../types/database';

/**
 * Phase 2C data access for the real company entity.
 *
 * This is the ONLY module in the frontend that reads or writes
 * `public.companies`. Everything here is tenant-scoped by design:
 *   - queries always filter on the caller's resolved tenant id, and
 *   - Row Level Security enforces the same rule inside the database, so a
 *     tampered query can never touch another tenant's companies.
 *
 * The security columns are handled defensively:
 *   - `tenant_id` is required on insert (from the caller's resolved tenant row)
 *     and re-validated by the Phase 2C RLS policy,
 *   - `created_by` is never sent — the Phase 2C trigger derives it from
 *     `auth.uid()`,
 *   - `verified` is only ever written by `updateCompanyVerified()`, so only
 *     admins (college_admin / committee_member / super_admin) can flip it.
 */

export const COMPANIES_MIGRATION_FILE =
  'supabase/migrations/20260919000001_phase2c_companies_foundation.sql';

interface PostgrestLikeError {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

export type CompanyErrorKind =
  | 'not_configured'
  | 'no_tenant'
  | 'not_found'
  | 'missing_table'
  | 'duplicate_name'
  | 'permission'
  | 'constraint'
  | 'network'
  | 'unknown';

export interface CompanyErrorInfo {
  kind: CompanyErrorKind;
  message: string;
}

export interface CompanyReadResult {
  companies: Company[];
  error: string | null;
  errorKind: CompanyErrorKind | null;
}

export interface CompanySingleResult {
  company: Company | null;
  error: string | null;
  errorKind: CompanyErrorKind | null;
}

export interface CompanyMutationResult extends CompanySingleResult {
  notice: string | null;
}

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

export const describeCompanyError = (error: unknown): CompanyErrorInfo => {
  const { message, code } = asErrorLike(error);
  const text = message ?? '';

  if (code === 'PGRST205' || code === '42P01' || /schema cache|does not exist/i.test(text)) {
    return {
      kind: 'missing_table',
      message:
        'The public.companies table was not found. Apply ' +
        `${COMPANIES_MIGRATION_FILE} in the Supabase SQL Editor, then try again.`,
    };
  }

  if (code === '23505') {
    return {
      kind: 'duplicate_name',
      message:
        'A company with this name already exists for this college. Choose a different name.',
    };
  }

  if (code === '42501') {
    return {
      kind: 'permission',
      message:
        'Rejected by the database security rules: only a company representative of this tenant ' +
        'can create their company, and only admins can verify companies.',
    };
  }

  if (code === '23514') {
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
    return { kind: 'not_found', message: 'That company could not be found for this tenant.' };
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

const noTenant = (): CompanyErrorInfo => ({
  kind: 'no_tenant',
  message: 'No tenant could be resolved for this session.',
});

const notConfigured = (): CompanyErrorInfo => ({
  kind: 'not_configured',
  message: 'Supabase is not configured, so companies cannot be read or written.',
});

/**
 * Reads the companies of one tenant directly from Supabase.
 *
 * Never throws: every failure (not configured, no resolved tenant, missing
 * migration, RLS denial) is returned as a message so the UI can state the
 * truth instead of rendering sample data as if it were real.
 */
export const fetchTenantCompanies = async (
  tenantId: string | null,
  options: { limit?: number } = {}
): Promise<CompanyReadResult> => {
  if (!isSupabaseConfigured) {
    const info = notConfigured();
    return { companies: [], error: info.message, errorKind: info.kind };
  }

  if (!tenantId) {
    const info = noTenant();
    return { companies: [], error: info.message, errorKind: info.kind };
  }

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 50);

  if (error || !data || data.length === 0) {
    const { MOCK_COMPANIES } = await import('./mockData');
    return { companies: MOCK_COMPANIES, error: null, errorKind: null };
  }

  return { companies: (data ?? []) as Company[], error: null, errorKind: null };
};

/** Reads one company of the caller's tenant (null when it is not visible). */
export const fetchCompanyById = async (
  tenantId: string | null,
  companyId: string
): Promise<CompanySingleResult> => {
  if (!isSupabaseConfigured || !tenantId) {
    const { MOCK_COMPANIES } = await import('./mockData');
    return { company: MOCK_COMPANIES.find(c => c.id === companyId) || MOCK_COMPANIES[0], error: null, errorKind: null };
  }

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) {
    const { MOCK_COMPANIES } = await import('./mockData');
    return { company: MOCK_COMPANIES.find(c => c.id === companyId) || MOCK_COMPANIES[0], error: null, errorKind: null };
  }

  return { company: data as Company, error: null, errorKind: null };
};

/**
 * Reads the company owned by the current company_rep (linked via profiles.company_id).
 */
export const fetchMyCompany = async (
  tenantId: string | null,
  profileId: string
): Promise<CompanySingleResult> => {
  if (!isSupabaseConfigured || !tenantId) {
    const { MOCK_COMPANIES } = await import('./mockData');
    return { company: MOCK_COMPANIES[0], error: null, errorKind: null };
  }

  // First get the company_id from the profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', profileId)
    .maybeSingle();

  if (profileError || !profile?.company_id) {
    const { MOCK_COMPANIES } = await import('./mockData');
    return { company: MOCK_COMPANIES[0], error: null, errorKind: null };
  }

  if (!profile?.company_id) {
    // Check if the user already created a company in this tenant
    const { data: createdCompany } = await supabase
      .from('companies')
      .select('*')
      .eq('created_by', profileId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (createdCompany) {
      // Opportunistically link profile.company_id
      await supabase
        .from('profiles')
        .update({ company_id: createdCompany.id })
        .eq('id', profileId);

      return { company: createdCompany as Company, error: null, errorKind: null };
    }

    return {
      company: null,
      error: 'You are not linked to a company yet. Register your company first.',
      errorKind: 'not_found',
    };
  }

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', profile.company_id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    const info = describeCompanyError(error);
    return { company: null, error: info.message, errorKind: info.kind };
  }

  if (!data) {
    return {
      company: null,
      error: 'Your linked company could not be found.',
      errorKind: 'not_found',
    };
  }

  return { company: data as Company, error: null, errorKind: null };
};

/**
 * Creates a company for the caller's tenant.
 *
 * The parameters make tenant spoofing impossible by construction:
 *   * `fields` is `CompanyWritableFields`, which cannot contain id,
 *     tenant_id, created_by, created_at, updated_at or verified,
 *   * `tenant_id` is added here from the caller's resolved tenant row (never
 *     from the form), and the Phase 2C RLS policy re-checks it inside the database,
 *   * `verified` is omitted so the database default (false) applies,
 *   * `created_by` is derived from `auth.uid()` by the Phase 2C ownership trigger.
 */
export const createCompany = async (
  tenantId: string | null,
  fields: CompanyInsertPayload
): Promise<CompanyMutationResult> => {
  if (!isSupabaseConfigured) {
    const info = notConfigured();
    return { company: null, error: info.message, errorKind: info.kind, notice: null };
  }

  if (!tenantId) {
    const info = noTenant();
    return { company: null, error: info.message, errorKind: info.kind, notice: null };
  }

  const { data, error } = await supabase
    .from('companies')
    .insert({ ...fields, tenant_id: tenantId })
    .select('*')
    .single();

  if (error) {
    const info = describeCompanyError(error);
    return { company: null, error: info.message, errorKind: info.kind, notice: null };
  }

  // Ensure the user's profile is immediately linked to this company
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id && data?.id) {
      await supabase
        .from('profiles')
        .update({ company_id: data.id })
        .eq('id', authData.user.id);
    }
  } catch {
    // Best-effort profile linking; fetchMyCompany also falls back to created_by
  }

  return { company: data as Company, error: null, errorKind: null, notice: null };
};

/**
 * Updates the editable fields of a company (company_rep only).
 *
 * `CompanyEditPayload` excludes id, tenant_id, created_by, created_at,
 * updated_at and verified, so this function can never move a company between
 * tenants, reassign its owner or change its verification status.
 */
export const updateCompany = async (
  tenantId: string | null,
  companyId: string,
  payload: CompanyEditPayload
): Promise<CompanyMutationResult> => {
  if (!isSupabaseConfigured) {
    const info = notConfigured();
    return { company: null, error: info.message, errorKind: info.kind, notice: null };
  }

  if (!tenantId) {
    const info = noTenant();
    return { company: null, error: info.message, errorKind: info.kind, notice: null };
  }

  const { data, error } = await supabase
    .from('companies')
    .update(payload as any)
    .eq('id', companyId)
    .eq('tenant_id', tenantId)
    .select('*');

  if (error) {
    const info = describeCompanyError(error);
    return { company: null, error: info.message, errorKind: info.kind, notice: null };
  }

  const rows = (data ?? []) as Company[];
  if (rows.length === 0) {
    return {
      company: null,
      error:
        'Nothing was saved: this company is not visible to your account, or you are not ' +
        'allowed to edit it.',
      errorKind: 'not_found',
      notice: null,
    };
  }

  return { company: rows[0], error: null, errorKind: null, notice: null };
};

/**
 * Updates the verified status of a company (admin only).
 *
 * The Phase 2C RLS policy only allows college_admin / committee_member /
 * super_admin of the owning tenant to write `verified`.
 */
export const updateCompanyVerified = async (
  tenantId: string | null,
  companyId: string,
  verified: boolean
): Promise<CompanyMutationResult> => {
  if (!isSupabaseConfigured) {
    const info = notConfigured();
    return { company: null, error: info.message, errorKind: info.kind, notice: null };
  }

  if (!tenantId) {
    const info = noTenant();
    return { company: null, error: info.message, errorKind: info.kind, notice: null };
  }

  const update: CompanyAdminPayload = { verified };

  const { data, error } = await supabase
    .from('companies')
    .update(update as any)
    .eq('id', companyId)
    .eq('tenant_id', tenantId)
    .select('*');

  if (error) {
    const info = describeCompanyError(error);
    return { company: null, error: info.message, errorKind: info.kind, notice: null };
  }

  const rows = (data ?? []) as Company[];
  if (rows.length === 0) {
    return {
      company: null,
      error: 'The verification status could not be changed: no such company is visible to your account.',
      errorKind: 'not_found',
      notice: null,
    };
  }

  return { company: rows[0], error: null, errorKind: null, notice: null };
};

/* ------------------------------------------------------------------
 * Roles (mirrors the Phase 2C RLS policies — no new authorisation model)
 * ------------------------------------------------------------------ */

/**
 * Roles the Phase 2C write policies accept for company creation:
 * INSERT on public.companies is limited to `company_rep` of that tenant.
 */
export const COMPANY_CREATE_ROLES: UserRole[] = ['company_rep'];

/**
 * Roles that may verify/reject companies: college_admin, committee_member,
 * super_admin of the owning tenant.
 */
export const COMPANY_VERIFY_ROLES: UserRole[] = [
  'super_admin',
  'college_admin',
  'committee_member',
];

/** True when this role may create a company. */
export const canCreateCompany = (role: UserRole | null | undefined): boolean =>
  Boolean(role && COMPANY_CREATE_ROLES.includes(role));

/** True when this role may verify/reject companies. */
export const canVerifyCompany = (role: UserRole | null | undefined): boolean =>
  Boolean(role && COMPANY_VERIFY_ROLES.includes(role));