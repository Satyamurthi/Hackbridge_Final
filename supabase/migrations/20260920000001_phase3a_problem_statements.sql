-- ============================================================
-- HACKBRIDGE PHASE 3A — PROBLEM STATEMENTS FOUNDATION
-- Migration: 20260920000001_phase3a_problem_statements.sql
--
-- Source of truth: HackBridge.pdf
--   * section "2. Database Schema" -> "PROBLEM STATEMENTS"
--     (table, columns, tenant isolation, review workflow, RLS)
--   * section "3.6 Hackathon Module" -> hackathon lifecycle
--     (problem_intake phase is when companies submit)
--
-- Scope (Phase 3A only):
--   1. problem_statement_status enum (submitted → under_review →
--      approved | rejected → published)
--   2. public.problem_statements table — exact column set from spec.
--      Attachments (JSONB/Storage) are deferred; datasets_info and
--      tech_preferences are stored as text for now.
--   3. Indexes for tenant/hackathon/company/status lookups.
--   4. Integrity guards:
--        updated_at maintenance (reuses public.set_updated_at())
--        submitted_by derived from auth.uid() on INSERT
--        hackathon_id + company_id immutable after insert
--        status state-machine (submitted→under_review→approved/
--          rejected, approved→published; super admins may bypass)
--   5. Row Level Security — strict tenant isolation:
--        all tenant members can SELECT published rows
--        company_rep can INSERT/UPDATE their own draft (submitted)
--        committee/admin can SELECT all + UPDATE status/review cols
--        super_admin global oversight
--
-- Explicitly OUT of scope (later phases): teams, team invitations,
-- student registration to a problem, submissions, evaluations,
-- scoring, leaderboards, talent pool/hiring, AI pre-screening,
-- notifications, audit-log persistence, Supabase Storage buckets.
--
-- Safety guarantees:
--   * Idempotent — CREATE ... IF NOT EXISTS / CREATE OR REPLACE /
--     DROP ... IF EXISTS only; re-running is harmless.
--   * Additive and non-destructive — no existing table, column,
--     policy, trigger, or function is dropped or modified.
--   * No seed data — zero rows inserted.
--   * References Phase 2C: public.companies must exist.
--     Run AFTER 20260919000001_phase2c_companies_foundation.sql.
--
-- Run order (cumulative):
--   1. 20260915000001_initial_foundation.sql
--   2. 20260916000001_phase1_5_security_hardening.sql
--   3. 20260917000001_pilot_tenant_mitt.sql
--   4. 20260918000001_phase2a_hackathon_foundation.sql
--   5. 20260919000001_phase2c_companies_foundation.sql  ← must be applied first
--   6. THIS FILE
-- ============================================================

-- ============================================================
-- 1. PROBLEM STATEMENT STATUS ENUM
-- ============================================================
-- Five-state lifecycle matching the spec:
--   submitted     — company_rep submits; visible only to admin/company
--   under_review  — committee has opened the record for review
--   approved      — approved by committee; not yet visible to students
--   rejected      — rejected with review_notes; company can see reason
--   published     — explicitly published; visible to all tenant members

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'problem_statement_status'
  ) THEN
    CREATE TYPE public.problem_statement_status AS ENUM (
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'published'
    );
  END IF;
END $$;

COMMENT ON TYPE public.problem_statement_status IS
  'HackBridge.pdf review lifecycle for problem statements. Phase 3A.';

-- ============================================================
-- 2. PROBLEM STATEMENTS TABLE
-- ============================================================
-- Column set from HackBridge.pdf "PROBLEM STATEMENTS":
--   * tenant isolation flows through hackathon_id (hackathons are
--     tenant-scoped; a direct tenant_id column would be redundant
--     and could drift from the parent hackathon's tenant).
--   * attachments JSONB is deferred (requires Supabase Storage).
--   * datasets_info stored as TEXT for Phase 3A (no file upload).
--   * tech_preferences stored as TEXT[] (plain strings, not enum).
--   * UNIQUE(hackathon_id, company_id) — one problem statement per
--     company per hackathon (relaxable in a later additive migration).

CREATE TABLE IF NOT EXISTS public.problem_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent entities
  hackathon_id UUID NOT NULL REFERENCES public.hackathons(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
  submitted_by UUID          REFERENCES public.profiles(id)   ON DELETE SET NULL,

  -- Core content
  title               VARCHAR(500) NOT NULL,
  domain              VARCHAR(100),
  -- 'fintech' | 'healthtech' | 'edtech' | 'sustainability' | 'logistics' | ...

  difficulty          VARCHAR(20) NOT NULL DEFAULT 'medium',
  -- easy | medium | hard

  problem_description TEXT NOT NULL,
  expected_outcome    TEXT,
  constraints         TEXT,

  -- Dataset information (file attachments deferred to later phase)
  datasets_provided   BOOLEAN NOT NULL DEFAULT false,
  datasets_info       TEXT,

  -- Technical preferences
  tech_preferences    TEXT[] NOT NULL DEFAULT '{}',

  -- Evaluation guidance
  evaluation_criteria TEXT,

  -- Hiring intent (spec columns)
  hiring_potential    VARCHAR(50),
  -- 'immediate_hire' | 'internship' | 'possible' | 'none'
  open_positions      INT NOT NULL DEFAULT 0,
  position_description TEXT,

  -- Review workflow
  status              public.problem_statement_status NOT NULL DEFAULT 'submitted',
  review_notes        TEXT,
  reviewed_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  published_at        TIMESTAMPTZ,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT problem_statements_hackathon_company_key
    UNIQUE (hackathon_id, company_id),
  CONSTRAINT problem_statements_title_not_blank_check
    CHECK (btrim(title) <> ''),
  CONSTRAINT problem_statements_description_not_blank_check
    CHECK (btrim(problem_description) <> ''),
  CONSTRAINT problem_statements_difficulty_check
    CHECK (difficulty IN ('easy', 'medium', 'hard')),
  CONSTRAINT problem_statements_hiring_potential_check
    CHECK (hiring_potential IS NULL OR hiring_potential IN ('immediate_hire', 'internship', 'possible', 'none')),
  CONSTRAINT problem_statements_open_positions_check
    CHECK (open_positions >= 0)
);

COMMENT ON TABLE public.problem_statements IS
  'HackBridge.pdf: industry problem statements submitted by companies for a specific hackathon. Phase 3A.';
COMMENT ON COLUMN public.problem_statements.status IS
  'Review lifecycle: submitted→under_review→approved/rejected→published. State machine enforced by trigger.';
COMMENT ON COLUMN public.problem_statements.datasets_info IS
  'Phase 3A: stored as plain text. File attachments require Supabase Storage (deferred to later phase).';

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_problem_statements_hackathon
  ON public.problem_statements(hackathon_id);

CREATE INDEX IF NOT EXISTS idx_problem_statements_company
  ON public.problem_statements(company_id);

CREATE INDEX IF NOT EXISTS idx_problem_statements_status
  ON public.problem_statements(hackathon_id, status);

CREATE INDEX IF NOT EXISTS idx_problem_statements_submitted_by
  ON public.problem_statements(submitted_by);

-- ============================================================
-- 4. INTEGRITY GUARDS
-- ============================================================

-- 4a. updated_at is always maintained by the database.
--     public.set_updated_at() was created in Phase 2C; reuse it.
DROP TRIGGER IF EXISTS trg_problem_statements_set_updated_at ON public.problem_statements;
CREATE TRIGGER trg_problem_statements_set_updated_at
  BEFORE UPDATE ON public.problem_statements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4b. Ownership, tenancy, and parent linkage are immutable.
--     submitted_by is derived from auth.uid() on INSERT (same
--     pattern as companies.created_by in Phase 2C).
--     hackathon_id and company_id can never change after insert —
--     a problem statement belongs to exactly one hackathon and one
--     company forever, preventing cross-tenant or cross-event leaks.
CREATE OR REPLACE FUNCTION public.enforce_problem_statement_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
BEGIN
  IF caller IS NULL THEN
    -- Trusted context (SQL editor / service role / table owner)
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Server-derived submitter: overwrite any client-supplied value.
    NEW.submitted_by := caller;
    RETURN NEW;
  END IF;

  -- UPDATE: parent linkage is immutable for everyone.
  IF NEW.hackathon_id IS DISTINCT FROM OLD.hackathon_id THEN
    RAISE EXCEPTION 'A problem statement cannot be moved to another hackathon'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'A problem statement cannot be reassigned to another company'
      USING ERRCODE = '42501';
  END IF;

  -- Super admins have full administrative override on all other fields.
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- submitted_by is immutable after insert for non-super-admins.
  IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by THEN
    RAISE EXCEPTION 'The submitter of a problem statement cannot be reassigned'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_problem_statements_ownership ON public.problem_statements;
CREATE TRIGGER trg_problem_statements_ownership
  BEFORE INSERT OR UPDATE ON public.problem_statements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_problem_statement_ownership();

-- 4c. Status state machine — prevents illegal lifecycle jumps.
--     Valid transitions:
--       submitted     → under_review
--       under_review  → approved | rejected
--       approved      → published | rejected
--       rejected      → submitted  (company can re-submit after edits)
--       published     → (terminal — no transitions for non-super-admins)
--     Super admins may correct a stuck event (same as hackathons).
CREATE OR REPLACE FUNCTION public.enforce_problem_statement_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
BEGIN
  -- Trusted context or no status change: skip validation.
  IF caller IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Super admins may correct any stuck record.
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- Validate transition.
  IF NOT (
    (OLD.status = 'submitted'    AND NEW.status IN ('under_review'))
    OR (OLD.status = 'under_review' AND NEW.status IN ('approved', 'rejected'))
    OR (OLD.status = 'approved'   AND NEW.status IN ('published', 'rejected'))
    OR (OLD.status = 'rejected'   AND NEW.status IN ('submitted'))
  ) THEN
    RAISE EXCEPTION
      'Invalid problem statement status transition: % → %. '
      'Allowed next states: %',
      OLD.status,
      NEW.status,
      CASE OLD.status
        WHEN 'submitted'    THEN 'under_review'
        WHEN 'under_review' THEN 'approved, rejected'
        WHEN 'approved'     THEN 'published, rejected'
        WHEN 'rejected'     THEN 'submitted'
        WHEN 'published'    THEN '(none — terminal state)'
      END
      USING ERRCODE = '23514';
  END IF;

  -- Stamp review metadata when moving through the review flow.
  IF NEW.status IN ('approved', 'rejected', 'under_review') THEN
    NEW.reviewed_by  := caller;
    NEW.reviewed_at  := NOW();
  END IF;

  IF NEW.status = 'published' THEN
    NEW.published_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_problem_statements_status_transition ON public.problem_statements;
CREATE TRIGGER trg_problem_statements_status_transition
  BEFORE UPDATE ON public.problem_statements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_problem_statement_status_transition();

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================
-- Tenant isolation flows through the hackathon FK:
--   get_current_user_tenant_id() is matched against the parent
--   hackathon's tenant_id via a subquery, so a problem statement
--   is always read/written inside the correct tenant boundary.
--
-- Read rules:
--   5a. All tenant members can read *published* rows.
--   5b. Company_rep can read their *own* rows (any status).
--   5c. College admin / committee / super_admin can read all rows
--       in their tenant.
--
-- Write rules:
--   5d. Company_rep can INSERT their own problem statement into a
--       hackathon that belongs to their tenant.
--   5e. Company_rep can UPDATE *only their own submitted row*
--       (content columns only — status is managed by 5f).
--   5f. College admin / committee_member can UPDATE the review
--       columns (status, review_notes, reviewed_by, reviewed_at,
--       published_at) on any row in their tenant.
--   5g. Super_admin has global oversight (read + write).

ALTER TABLE public.problem_statements ENABLE ROW LEVEL SECURITY;

-- 5a. Published rows are visible to all tenant members.
DROP POLICY IF EXISTS "Tenant members can view published problem statements" ON public.problem_statements;
CREATE POLICY "Tenant members can view published problem statements"
  ON public.problem_statements
  FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND h.tenant_id = public.get_current_user_tenant_id()
    )
  );

-- 5b. Company_rep can view their own submissions at any status.
DROP POLICY IF EXISTS "Company rep can view own problem statements" ON public.problem_statements;
CREATE POLICY "Company rep can view own problem statements"
  ON public.problem_statements
  FOR SELECT
  USING (
    public.get_current_user_role() = 'company_rep'
    AND submitted_by = auth.uid()
  );

-- 5c. Admins and committee members can view all in their tenant.
DROP POLICY IF EXISTS "Admins can view all problem statements in their tenant" ON public.problem_statements;
CREATE POLICY "Admins can view all problem statements in their tenant"
  ON public.problem_statements
  FOR SELECT
  USING (
    public.get_current_user_role() IN ('college_admin', 'committee_member')
    AND EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND h.tenant_id = public.get_current_user_tenant_id()
    )
  );

-- 5d-super. Super admin global read.
DROP POLICY IF EXISTS "Super admins can view all problem statements" ON public.problem_statements;
CREATE POLICY "Super admins can view all problem statements"
  ON public.problem_statements
  FOR SELECT
  USING (public.is_super_admin());

-- 5d. Company_rep can insert a problem statement into a hackathon
--     that belongs to their tenant.
DROP POLICY IF EXISTS "Company rep can submit problem statements" ON public.problem_statements;
CREATE POLICY "Company rep can submit problem statements"
  ON public.problem_statements
  FOR INSERT
  WITH CHECK (
    public.get_current_user_role() = 'company_rep'
    AND EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND h.tenant_id = public.get_current_user_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_id
        AND c.tenant_id = public.get_current_user_tenant_id()
        AND c.verified = true
    )
  );

-- 5e. Company_rep can update content of their own submitted draft.
--     They cannot change status (that goes through 5f) or parent IDs.
DROP POLICY IF EXISTS "Company rep can edit own submitted draft" ON public.problem_statements;
CREATE POLICY "Company rep can edit own submitted draft"
  ON public.problem_statements
  FOR UPDATE
  USING (
    public.get_current_user_role() = 'company_rep'
    AND submitted_by = auth.uid()
    AND status = 'submitted'
  )
  WITH CHECK (
    public.get_current_user_role() = 'company_rep'
    AND submitted_by = auth.uid()
    -- Status must remain submitted through this policy (state machine trigger handles transitions)
    AND status = 'submitted'
  );

-- 5f. Admins and committee can update review columns on any row
--     in their tenant. The state machine trigger validates the
--     transition and stamps reviewed_by / reviewed_at / published_at.
DROP POLICY IF EXISTS "Admins can review problem statements in their tenant" ON public.problem_statements;
CREATE POLICY "Admins can review problem statements in their tenant"
  ON public.problem_statements
  FOR UPDATE
  USING (
    public.is_college_admin(
      (SELECT h.tenant_id FROM public.hackathons h WHERE h.id = hackathon_id)
    )
  )
  WITH CHECK (
    public.is_college_admin(
      (SELECT h.tenant_id FROM public.hackathons h WHERE h.id = hackathon_id)
    )
  );

-- 5g. Super admin global update.
DROP POLICY IF EXISTS "Super admins can update any problem statement" ON public.problem_statements;
CREATE POLICY "Super admins can update any problem statement"
  ON public.problem_statements
  FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================
-- 6. POST-CONDITION VERIFICATION
-- ============================================================

DO $$
DECLARE
  rls_enabled   BOOLEAN;
  policy_count  INT;
  index_count   INT;
  trigger_count INT;
  enum_exists   BOOLEAN;
BEGIN
  -- Enum exists
  SELECT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'problem_statement_status'
  ) INTO enum_exists;

  IF enum_exists IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Phase 3A verification failed: problem_statement_status enum not found.';
  END IF;

  -- RLS enabled
  SELECT c.relrowsecurity
    INTO rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'problem_statements';

  IF rls_enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Phase 3A verification failed: RLS is not enabled on public.problem_statements.';
  END IF;

  -- Policies (8 policies expected)
  SELECT count(*)
    INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'problem_statements';

  IF policy_count <> 8 THEN
    RAISE EXCEPTION 'Phase 3A verification failed: expected 8 RLS policies on public.problem_statements, found %.',
      policy_count;
  END IF;

  -- Indexes (4 expected)
  SELECT count(*)
    INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'problem_statements'
    AND indexname IN (
      'idx_problem_statements_hackathon',
      'idx_problem_statements_company',
      'idx_problem_statements_status',
      'idx_problem_statements_submitted_by'
    );

  IF index_count <> 4 THEN
    RAISE EXCEPTION 'Phase 3A verification failed: expected 4 indexes on public.problem_statements, found %.',
      index_count;
  END IF;

  -- Triggers (3 expected)
  SELECT count(*)
    INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'public.problem_statements'::regclass
    AND NOT tgisinternal;

  IF trigger_count <> 3 THEN
    RAISE EXCEPTION 'Phase 3A verification failed: expected 3 guards on public.problem_statements, found %.',
      trigger_count;
  END IF;

  RAISE NOTICE
    'Phase 3A verified: public.problem_statements — enum created, RLS enabled, % policies, 4 indexes, 3 guards.',
    policy_count;
END $$;

-- ============================================================
-- END OF PHASE 3A PROBLEM STATEMENTS FOUNDATION MIGRATION
-- ============================================================
