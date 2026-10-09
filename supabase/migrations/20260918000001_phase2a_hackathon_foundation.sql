-- ============================================================
-- HACKBRIDGE PHASE 2A — HACKATHON DATABASE + LIFECYCLE FOUNDATION
-- Migration: 20260918000001_phase2a_hackathon_foundation.sql
--
-- Source of truth: HackBridge.pdf
--   * section "2. Database Schema" -> "HACKATHONS (Core entity)"
--     (table, columns, indexes, UNIQUE(tenant_id, slug))
--   * section "3.6 Hackathon Module" -> hackathonService.updateStatus()
--     (lifecycle state machine, `validTransitions`)
--   * section "3.9 Routes" -> Roles.ADMIN / Roles.COMMITTEE
--     (who is allowed to create and manage a hackathon)
--
-- Scope (Phase 2A only):
--   1. public.hackathon_status enum — the specification's lifecycle:
--        draft -> problem_intake -> registration -> hacking
--              -> evaluation -> completed -> archived
--   2. public.hackathons table — tenant-aware, the spec's columns only.
--   3. Indexes for tenant and lifecycle/status lookups.
--   4. Integrity guards: updated_at maintenance, immutable tenant and
--      owner, server-derived created_by, and enforcement of the
--      lifecycle state machine. The specification enforces the state
--      machine in its Node service layer; this project has no backend
--      and talks to Postgres directly through supabase-js, so the
--      identical rule is enforced in the database instead.
--   5. Row Level Security: strict tenant isolation; writes limited to
--      the owning tenant's college admins (plus platform super admins),
--      following the Phase 1.5 patterns (security-definer helpers,
--      explicit WITH CHECK clauses, fail-closed predicates).
--
-- Explicitly OUT of scope (later phases): companies, problem
-- statements, teams, team invitations, registrations, submissions,
-- evaluator assignments, scoring, leaderboards, talent pool/hiring, AI
-- pre-screening, notifications, background jobs, audit-log persistence
-- and storage buckets. No such object is created or modified here.
--
-- Safety guarantees:
--   * Idempotent — only CREATE ... IF NOT EXISTS / CREATE OR REPLACE /
--     DROP ... IF EXISTS are used, so re-running is harmless.
--   * Additive and non-destructive — nothing is dropped, renamed,
--     truncated or reset. The existing MITT tenant row, profiles,
--     tenant_memberships, Phase 1.5 helper functions, triggers and
--     policies are untouched, and no existing rule is relaxed.
--   * No seed data — zero rows are inserted on purpose, so the UI can
--     prove the difference between a real (empty) table and the
--     representative sample data shipped in the dashboard shells.
--   * Fails loudly instead of guessing: if public.hackathon_status
--     already exists with a different value set, this migration raises
--     an exception and changes nothing.
--
-- Committed but NOT executed automatically. Run it manually in the
-- Supabase SQL Editor, after, in this order:
--   1. 20260915000001_initial_foundation.sql
--   2. 20260916000001_phase1_5_security_hardening.sql
--   3. 20260917000001_pilot_tenant_mitt.sql
-- ============================================================

-- ============================================================
-- 1. LIFECYCLE STATUS TYPE
-- ============================================================
-- HackBridge.pdf, hackathonService.updateStatus():
--   draft -> problem_intake -> registration -> hacking
--         -> evaluation -> completed -> archived
-- The PDF sketches `status VARCHAR(50) DEFAULT 'draft'`; an enum is used
-- here so the same terminology is guaranteed and an unknown phase can
-- never be stored. The type is created once and never re-created
-- (re-creating a type already used by a column would fail), and a re-run
-- that finds an unexpected value set aborts instead of silently
-- reshaping the lifecycle.

DO $$
DECLARE
  expected_labels TEXT[] := ARRAY[
    'draft', 'problem_intake', 'registration', 'hacking',
    'evaluation', 'completed', 'archived'
  ];
  actual_labels TEXT[];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'hackathon_status'
  ) THEN
    CREATE TYPE public.hackathon_status AS ENUM (
      'draft',
      'problem_intake',
      'registration',
      'hacking',
      'evaluation',
      'completed',
      'archived'
    );
    RAISE NOTICE 'Phase 2A: created type public.hackathon_status.';
    RETURN;
  END IF;

  SELECT array_agg(e.enumlabel::TEXT ORDER BY e.enumsortorder)
    INTO actual_labels
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typname = 'hackathon_status';

  IF actual_labels IS DISTINCT FROM expected_labels THEN
    RAISE EXCEPTION
      'public.hackathon_status already exists with unexpected values [%]; expected [%]. Nothing was changed — resolve manually.',
      array_to_string(actual_labels, ', '),
      array_to_string(expected_labels, ', ');
  END IF;

  RAISE NOTICE 'Phase 2A: public.hackathon_status already matches the specification lifecycle.';
END $$;

-- ============================================================
-- 2. HACKATHONS TABLE (tenant-aware core entity)
-- ============================================================
-- Column set is taken verbatim from HackBridge.pdf ("HACKATHONS (Core
-- entity)"). Two deliberate hardenings versus the PDF sketch, both
-- required by the existing multi-tenant architecture:
--   * tenant_id is NOT NULL — a hackathon always belongs to exactly one
--     tenant, which is what makes the RLS isolation below unambiguous.
--   * created_by references public.profiles (the PDF's `users` table is
--     this project's `profiles`, which is backed by auth.users).
-- Constraints are declared inline so that `CREATE TABLE IF NOT EXISTS`
-- keeps the whole statement idempotent.

CREATE TABLE IF NOT EXISTS public.hackathons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenancy & ownership
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Identity
  slug VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  tagline TEXT,
  description TEXT,
  banner_url TEXT,

  -- Timeline (every lifecycle phase; NULL means "not scheduled yet")
  problem_submission_opens TIMESTAMPTZ,
  problem_submission_closes TIMESTAMPTZ,
  registration_opens TIMESTAMPTZ,
  registration_closes TIMESTAMPTZ,
  team_formation_closes TIMESTAMPTZ,
  hacking_starts TIMESTAMPTZ,
  hacking_ends TIMESTAMPTZ,
  evaluation_starts TIMESTAMPTZ,
  evaluation_ends TIMESTAMPTZ,
  results_announced_at TIMESTAMPTZ,

  -- Participation configuration
  min_team_size INT NOT NULL DEFAULT 2,
  max_team_size INT NOT NULL DEFAULT 4,
  max_teams_per_problem INT NOT NULL DEFAULT 10,
  allow_solo BOOLEAN NOT NULL DEFAULT false,
  require_college_email BOOLEAN NOT NULL DEFAULT true,

  -- Evaluation configuration (stored now, consumed by the evaluation phase)
  -- [{ criterion: "Innovation", weight: 30, description: "...", max_score: 10 }]
  evaluation_rubric JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ round: 1, name: "Internal Review", evaluators_per_team: 2 }]
  evaluation_rounds JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Prizes & perks
  -- [{ rank: 1, amount: 50000, description: "Cash + Internship" }]
  prizes JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Lifecycle + visibility
  status public.hackathon_status NOT NULL DEFAULT 'draft',
  visibility VARCHAR(20) NOT NULL DEFAULT 'public',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One slug per tenant (HackBridge.pdf), used by the public URLs
  CONSTRAINT hackathons_tenant_slug_key UNIQUE (tenant_id, slug),
  CONSTRAINT hackathons_slug_format_check
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT hackathons_title_not_blank_check CHECK (btrim(title) <> ''),
  CONSTRAINT hackathons_visibility_check CHECK (visibility IN ('public', 'private')),
  CONSTRAINT hackathons_team_size_check
    CHECK (min_team_size >= 1 AND max_team_size >= min_team_size),
  CONSTRAINT hackathons_max_teams_per_problem_check CHECK (max_teams_per_problem >= 1),
  CONSTRAINT hackathons_evaluation_rubric_is_array_check
    CHECK (jsonb_typeof(evaluation_rubric) = 'array'),
  CONSTRAINT hackathons_evaluation_rounds_is_array_check
    CHECK (jsonb_typeof(evaluation_rounds) = 'array'),
  CONSTRAINT hackathons_prizes_is_array_check CHECK (jsonb_typeof(prizes) = 'array')
);

COMMENT ON TABLE public.hackathons IS
  'HackBridge.pdf core entity: one hackathon event, owned by exactly one tenant. Phase 2A (foundation only).';
COMMENT ON COLUMN public.hackathons.status IS
  'Lifecycle: draft -> problem_intake -> registration -> hacking -> evaluation -> completed -> archived';

-- ============================================================
-- 3. INDEXES (tenant + lifecycle lookups)
-- ============================================================
-- Names follow HackBridge.pdf ("CREATE INDEX idx_hackathons_tenant" /
-- "idx_hackathons_status") so the PDF and the database can be diffed
-- directly. The status index is composite (tenant_id, status) exactly as
-- the specification defines it, because every lifecycle query in the
-- product is scoped to one tenant first.

CREATE INDEX IF NOT EXISTS idx_hackathons_tenant ON public.hackathons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hackathons_status ON public.hackathons(tenant_id, status);

-- ============================================================
-- 4. INTEGRITY GUARDS
-- ============================================================

-- 4a. updated_at is always maintained by the database.
--     The PDF's service layer writes `updated_at = NOW()` explicitly; the
--     database does it for every write so the timestamp can never drift.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hackathons_set_updated_at ON public.hackathons;
CREATE TRIGGER trg_hackathons_set_updated_at
  BEFORE UPDATE ON public.hackathons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4b. Ownership and tenancy are immutable once written.
--     Phase 1.5 guards protected profile attributes by comparing NEW
--     against OLD inside a trigger, because RLS alone cannot. The same
--     approach protects a hackathon:
--       * created_by is derived from the authenticated session, never
--         from client input, so ownership cannot be forged;
--       * a hackathon can never be moved to another tenant, so a tenant
--         can never "adopt" or hand over another tenant's event.
--     Trusted contexts without a JWT (SQL editor / service role / table
--     owner) are not constrained, exactly as in Phase 1.5, and platform
--     super admins keep administrative override.
CREATE OR REPLACE FUNCTION public.enforce_hackathon_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Server-derived owner: a client-supplied created_by is overwritten.
    NEW.created_by := caller;
    RETURN NEW;
  END IF;

  -- UPDATE: tenant is immutable for everyone, including super admins
  -- (moving a row across tenants would silently leak it to another
  -- tenant's members).
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'A hackathon can never be moved to another tenant'
      USING ERRCODE = '42501';
  END IF;

  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'A hackathon owner (created_by) can never be reassigned'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hackathons_ownership ON public.hackathons;
CREATE TRIGGER trg_hackathons_ownership
  BEFORE INSERT OR UPDATE ON public.hackathons
  FOR EACH ROW EXECUTE FUNCTION public.enforce_hackathon_ownership();

-- 4c. Lifecycle state machine.
--     HackBridge.pdf, hackathonService.updateStatus() -> validTransitions:
--       draft          -> problem_intake
--       problem_intake -> registration
--       registration   -> hacking
--       hacking        -> evaluation
--       evaluation     -> completed
--       completed      -> archived
--     Skipping a phase or moving backwards is rejected, so the lifecycle
--     cannot be corrupted by a direct API call. A platform super admin may
--     still correct a stuck event (unblocking a tenant), mirroring the
--     "super_admin bypasses all checks" rule in the PDF's authorize().
CREATE OR REPLACE FUNCTION public.enforce_hackathon_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed public.hackathon_status[];
BEGIN
  -- Same value written again (e.g. an unrelated column update): allowed.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  allowed := CASE OLD.status
    WHEN 'draft'::public.hackathon_status
      THEN ARRAY['problem_intake']::public.hackathon_status[]
    WHEN 'problem_intake'::public.hackathon_status
      THEN ARRAY['registration']::public.hackathon_status[]
    WHEN 'registration'::public.hackathon_status
      THEN ARRAY['hacking']::public.hackathon_status[]
    WHEN 'hacking'::public.hackathon_status
      THEN ARRAY['evaluation']::public.hackathon_status[]
    WHEN 'evaluation'::public.hackathon_status
      THEN ARRAY['completed']::public.hackathon_status[]
    WHEN 'completed'::public.hackathon_status
      THEN ARRAY['archived']::public.hackathon_status[]
    ELSE ARRAY[]::public.hackathon_status[]
  END;

  IF NOT (NEW.status = ANY (allowed)) THEN
    RAISE EXCEPTION 'Invalid hackathon lifecycle transition: % -> % (next allowed: %)',
      OLD.status,
      NEW.status,
      COALESCE(array_to_string(allowed, ', '), 'none')
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hackathons_status_transition ON public.hackathons;
CREATE TRIGGER trg_hackathons_status_transition
  BEFORE UPDATE OF status ON public.hackathons
  FOR EACH ROW EXECUTE FUNCTION public.enforce_hackathon_status_transition();

-- ============================================================
-- 5. ROW LEVEL SECURITY (tenant isolation)
-- ============================================================
-- Roles (HackBridge.pdf section 3.9):
--   ADMIN     = college_admin, super_admin
--   COMMITTEE = committee_member, college_admin, super_admin
--
-- Every predicate below fails closed:
--   * public.get_current_user_tenant_id() is NULL for an anonymous visitor
--     and for a signed-in user without a resolved tenant. `tenant_id = NULL`
--     evaluates to NULL (not TRUE), so such a session reads nothing.
--   * public.is_college_admin(target) is TRUE only when the caller
--     administers the target tenant (or is a platform super admin), so the
--     WITH CHECK clauses can never accept a row owned by another tenant.
--
-- Isolation consequence: a tenant can only ever read or write its own
-- hackathons. There is deliberately no anonymous/public read policy in
-- Phase 2A — public discovery of published events is a separate product
-- decision (hosting, SEO, visibility semantics), so the existing mocked
-- public directory cannot be mistaken for real data.
--
-- There is deliberately no DELETE policy: the specification exposes no
-- hackathon delete operation (an event is retired with status 'archived'),
-- so no client can delete a row.

ALTER TABLE public.hackathons ENABLE ROW LEVEL SECURITY;

-- 5a. READ — members of the owning tenant only.
DROP POLICY IF EXISTS "Tenant members can view their tenant hackathons" ON public.hackathons;
CREATE POLICY "Tenant members can view their tenant hackathons"
  ON public.hackathons
  FOR SELECT
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = public.get_current_user_tenant_id()
  );

-- 5b. READ — platform super admin oversight ("super_admin bypasses all
--     checks"). Kept as a separate policy from 5a so the tenant-isolation
--     rule stays readable in one place.
DROP POLICY IF EXISTS "Super admins can view all hackathons" ON public.hackathons;
CREATE POLICY "Super admins can view all hackathons"
  ON public.hackathons
  FOR SELECT
  USING (public.is_super_admin());

-- 5c. CREATE — college admins of the target tenant only (Roles.ADMIN).
--     created_by is not part of this check: the BEFORE INSERT guard (4b)
--     overwrites it with auth.uid(), so ownership can neither be supplied
--     nor forged by the client.
DROP POLICY IF EXISTS "College admins can create hackathons in their tenant" ON public.hackathons;
CREATE POLICY "College admins can create hackathons in their tenant"
  ON public.hackathons
  FOR INSERT
  WITH CHECK (public.is_college_admin(tenant_id));

-- 5d. UPDATE — college admins of the owning tenant only. USING keeps another
--     tenant's row invisible (and therefore inert); WITH CHECK keeps the row
--     inside the same tenant after the write.
--
--     Committee-member management (Roles.COMMITTEE) is NOT granted here on
--     purpose: RLS cannot restrict an UPDATE to a single column, so granting
--     a committee member UPDATE would also let them rewrite the title,
--     timeline and prize configuration. The lifecycle state machine (4c) is
--     already enforced, and the narrower committee permission belongs to the
--     phase that ships the transition workflow.
DROP POLICY IF EXISTS "College admins can manage hackathons in their tenant" ON public.hackathons;
CREATE POLICY "College admins can manage hackathons in their tenant"
  ON public.hackathons
  FOR UPDATE
  USING (public.is_college_admin(tenant_id))
  WITH CHECK (public.is_college_admin(tenant_id));

-- ============================================================
-- 6. POST-CONDITION VERIFICATION (fails loudly, changes nothing)
-- ============================================================
-- The same style as 20260917000001_pilot_tenant_mitt.sql: if anything above
-- did not land as intended, the migration aborts instead of leaving a
-- half-secured table behind.

DO $$
DECLARE
  rls_enabled BOOLEAN;
  policy_count INT;
  index_count INT;
  trigger_count INT;
BEGIN
  SELECT c.relrowsecurity
    INTO rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'hackathons';

  IF rls_enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Phase 2A verification failed: RLS is not enabled on public.hackathons.';
  END IF;

  SELECT count(*)
    INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'hackathons';

  IF policy_count <> 4 THEN
    RAISE EXCEPTION 'Phase 2A verification failed: expected 4 RLS policies on public.hackathons, found %.',
      policy_count;
  END IF;

  SELECT count(*)
    INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'hackathons'
    AND indexname IN ('idx_hackathons_tenant', 'idx_hackathons_status');

  IF index_count <> 2 THEN
    RAISE EXCEPTION 'Phase 2A verification failed: expected the tenant and status indexes on public.hackathons, found %.',
      index_count;
  END IF;

  SELECT count(*)
    INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'public.hackathons'::regclass
    AND NOT tgisinternal;

  IF trigger_count <> 3 THEN
    RAISE EXCEPTION 'Phase 2A verification failed: expected 3 guards on public.hackathons, found %.',
      trigger_count;
  END IF;

  RAISE NOTICE 'Phase 2A verified: public.hackathons — RLS enabled, % tenant-isolation policies, tenant/status indexes and % guards in place.',
    policy_count,
    trigger_count;
END $$;

-- ============================================================
-- END OF PHASE 2A HACKATHON FOUNDATION MIGRATION
-- ============================================================
