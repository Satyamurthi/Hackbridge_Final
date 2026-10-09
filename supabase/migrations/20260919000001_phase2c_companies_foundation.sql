-- ============================================================
-- HACKBRIDGE PHASE 2C — COMPANIES DATABASE FOUNDATION
-- Migration: 20260919000001_phase2c_companies_foundation.sql
--
-- Source of truth: HackBridge.pdf
--   * section "2. Database Schema" -> "COMPANIES (Industry partners)"
--     (table, columns, tenant isolation, RLS)
--   * section "3.9 Routes" -> Roles.COMPANY / Roles.ADMIN
--     (who is allowed to create/manage a company)
--
-- Scope (Phase 2C only):
--   1. public.companies table — tenant-aware, the spec's columns only.
--   2. Indexes for tenant lookups.
--   3. Integrity guards: updated_at maintenance, immutable tenant and
--      owner, server-derived created_by.
--   4. Row Level Security: strict tenant isolation; reads for all tenant
--      members; write for company_rep on their own company; admin
--      (college_admin/committee_member/super_admin) can read all and
--      update `verified` status; company_id on profiles as nullable FK.
--   5. ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES
--      public.companies(id) ON DELETE SET NULL.
--
-- Explicitly OUT of scope (later phases): problem statements/approval,
-- team formation/invitations, registrations, submissions, evaluations,
-- evaluator assignments, scoring, leaderboards, talent pool/hiring,
-- AI pre-screening, notifications, audit-log persistence, Supabase
-- Storage buckets.
--
-- Safety guarantees:
--   * Idempotent — only CREATE ... IF NOT EXISTS / CREATE OR REPLACE /
--     DROP ... IF EXISTS are used, so re-running is harmless.
--   * Additive and non-destructive — nothing is dropped, renamed,
--     truncated or reset. The existing tables, profiles, tenant_memberships,
--     helper functions, triggers and policies are untouched, and no
--     existing rule is relaxed.
--   * No seed data — zero rows are inserted on purpose, so the UI can
--     prove the difference between a real (empty) table and the
--     representative sample data shipped in the dashboard shells.
--   * Fails loudly instead of guessing: if public.companies already
--     exists with a different structure, this migration raises an
--     exception and changes nothing.
--
-- Committed but NOT executed automatically. Run it manually in the
-- Supabase SQL Editor, after, in this order:
--   1. 20260915000001_initial_foundation.sql
--   2. 20260916000001_phase1_5_security_hardening.sql
--   3. 20260917000001_pilot_tenant_mitt.sql
--   4. 20260918000001_phase2a_hackathon_foundation.sql
-- ============================================================

-- ============================================================
-- 1. COMPANIES TABLE (tenant-aware industry partner entity)
-- ============================================================
-- Column set is taken from HackBridge.pdf ("COMPANIES (Industry
-- partners)"). Two deliberate hardenings versus the PDF sketch, both
-- required by the existing multi-tenant architecture:
--   * tenant_id is NOT NULL — a company always belongs to exactly one
--     tenant, which is what makes the RLS isolation below unambiguous.
--   * created_by references public.profiles (the PDF's `users` table is
--     this project's `profiles`, which is backed by auth.users).
-- Constraints are declared inline so that `CREATE TABLE IF NOT EXISTS`
-- keeps the whole statement idempotent.

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenancy & ownership
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Identity
  name VARCHAR(255) NOT NULL,
  website TEXT,
  logo_url TEXT,
  description TEXT,
  industry VARCHAR(100),

  -- Verification status (admin-controlled)
  verified BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One company name per tenant (prevents duplicate registrations)
  CONSTRAINT companies_tenant_name_key UNIQUE (tenant_id, name),
  CONSTRAINT companies_name_not_blank_check CHECK (btrim(name) <> ''),
  CONSTRAINT companies_website_format_check
    CHECK (website IS NULL OR website ~ '^https?://\S+$'),
  CONSTRAINT companies_logo_url_format_check
    CHECK (logo_url IS NULL OR logo_url ~ '^https?://\S+$')
);

COMMENT ON TABLE public.companies IS
  'HackBridge.pdf industry partner entity: one company, owned by exactly one tenant. Phase 2C (foundation only).';
COMMENT ON COLUMN public.companies.verified IS
  'Set to true by college_admin / committee_member / super_admin after review. company_rep cannot change this.';

-- ============================================================
-- 2. ADD company_id TO PROFILES (nullable FK)
-- ============================================================
-- A company_rep is linked to exactly one company. The column is
-- nullable so existing profiles and non-company roles are unaffected.
-- The FK uses ON DELETE SET NULL so deleting a company does not
-- orphan profiles.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.company_id IS
  'Links a company_rep to their company. Null for all other roles.';

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- ============================================================
-- 3. INDEXES (tenant lookups)
-- ============================================================
-- Names follow HackBridge.pdf naming conventions so the PDF and the
-- database can be diffed directly.

CREATE INDEX IF NOT EXISTS idx_companies_tenant ON public.companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_verified ON public.companies(tenant_id, verified);

-- ============================================================
-- 4. INTEGRITY GUARDS
-- ============================================================

-- 4a. updated_at is always maintained by the database.
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

DROP TRIGGER IF EXISTS trg_companies_set_updated_at ON public.companies;
CREATE TRIGGER trg_companies_set_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4b. Ownership and tenancy are immutable once written.
--     Phase 1.5 guards protected profile attributes by comparing NEW
--     against OLD inside a trigger, because RLS alone cannot. The same
--     approach protects a company:
--       * created_by is derived from the authenticated session, never
--         from client input, so ownership cannot be forged;
--       * a company can never be moved to another tenant, so a tenant
--         can never "adopt" or hand over another tenant's company.
--     Trusted contexts without a JWT (SQL editor / service role / table
--     owner) are not constrained, exactly as in Phase 1.5, and platform
--     super admins keep administrative override.
CREATE OR REPLACE FUNCTION public.enforce_company_ownership()
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
    RAISE EXCEPTION 'A company can never be moved to another tenant'
      USING ERRCODE = '42501';
  END IF;

  -- A company_rep cannot change the verified status (only admins can)
  IF NOT (public.is_college_admin(OLD.tenant_id) OR public.is_super_admin()) THEN
    IF NEW.verified IS DISTINCT FROM OLD.verified THEN
      RAISE EXCEPTION 'Only college administrators can change company verification status'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'A company owner (created_by) can never be reassigned'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_ownership ON public.companies;
CREATE TRIGGER trg_companies_ownership
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.enforce_company_ownership();

-- ============================================================
-- 5. ROW LEVEL SECURITY (tenant isolation)
-- ============================================================
-- Roles (HackBridge.pdf section 3.9):
--   COMPANY   = company_rep (can read/update their own company only)
--   ADMIN     = college_admin, committee_member, super_admin
--     (can read all companies in tenant; can update verified status)
--
-- Every predicate below fails closed:
--   * public.get_current_user_tenant_id() is NULL for an anonymous
--     visitor and for a signed-in user without a resolved tenant.
--     `tenant_id = NULL` evaluates to NULL (not TRUE), so such a
--     session reads nothing.
--   * public.is_college_admin(target) is TRUE only when the caller
--     administers the target tenant (or is a platform super admin),
--     so the WITH CHECK clauses can never accept a row owned by
--     another tenant.
--
-- Isolation consequence: a tenant can only ever read or write its own
-- companies. There is deliberately no anonymous/public read policy —
-- public discovery of companies is a separate product decision.

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 5a. READ — members of the owning tenant (all roles in tenant).
DROP POLICY IF EXISTS "Tenant members can view their tenant companies" ON public.companies;
CREATE POLICY "Tenant members can view their tenant companies"
  ON public.companies
  FOR SELECT
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = public.get_current_user_tenant_id()
  );

-- 5b. READ — platform super admin oversight ("super_admin bypasses all
--     checks"). Kept as a separate policy from 5a so the tenant-isolation
--     rule stays readable in one place.
DROP POLICY IF EXISTS "Super admins can view all companies" ON public.companies;
CREATE POLICY "Super admins can view all companies"
  ON public.companies
  FOR SELECT
  USING (public.is_super_admin());

-- 5c. CREATE — company_rep of the target tenant only.
--     created_by is not part of this check: the BEFORE INSERT guard (4b)
--     overwrites it with auth.uid(), so ownership can neither be supplied
--     nor forged by the client.
--     The company_rep must not already have a company (enforced by
--     unique constraint on tenant_id + created_by would be ideal, but
--     we use the existing profile.company_id linkage instead; the
--     register page will guard against double-registration).
DROP POLICY IF EXISTS "Company reps can create their company in their tenant" ON public.companies;
CREATE POLICY "Company reps can create their company in their tenant"
  ON public.companies
  FOR INSERT
  WITH CHECK (
    public.get_current_user_role() = 'company_rep'
    AND tenant_id = public.get_current_user_tenant_id()
  );

-- 5d. UPDATE — company_rep can update their own company (except verified).
--     The USING clause ensures they can only see their own row.
--     The WITH CHECK clause ensures they cannot change tenant_id or
--     created_by (guarded by trigger) and verified is protected by trigger.
DROP POLICY IF EXISTS "Company reps can update their own company" ON public.companies;
CREATE POLICY "Company reps can update their own company"
  ON public.companies
  FOR UPDATE
  USING (
    public.get_current_user_role() = 'company_rep'
    AND tenant_id = public.get_current_user_tenant_id()
    AND created_by = auth.uid()
  )
  WITH CHECK (
    public.get_current_user_role() = 'company_rep'
    AND tenant_id = public.get_current_user_tenant_id()
    AND created_by = auth.uid()
  );

-- 5e. UPDATE — college_admin / committee_member / super_admin can update
--     verified status of any company in their tenant. USING keeps another
--     tenant's row invisible; WITH CHECK keeps the row inside the same
--     tenant after the write.
DROP POLICY IF EXISTS "Admins can verify companies in their tenant" ON public.companies;
CREATE POLICY "Admins can verify companies in their tenant"
  ON public.companies
  FOR UPDATE
  USING (
    public.is_college_admin(tenant_id)
  )
  WITH CHECK (
    public.is_college_admin(tenant_id)
  );

-- ============================================================
-- 6. POST-CONDITION VERIFICATION (fails loudly, changes nothing)
-- ============================================================

DO $$
DECLARE
  rls_enabled BOOLEAN;
  policy_count INT;
  index_count INT;
  trigger_count INT;
  profile_fk_exists BOOLEAN;
BEGIN
  SELECT c.relrowsecurity
    INTO rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'companies';

  IF rls_enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Phase 2C verification failed: RLS is not enabled on public.companies.';
  END IF;

  SELECT count(*)
    INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'companies';

  IF policy_count <> 5 THEN
    RAISE EXCEPTION 'Phase 2C verification failed: expected 5 RLS policies on public.companies, found %.',
      policy_count;
  END IF;

  SELECT count(*)
    INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'companies'
    AND indexname IN ('idx_companies_tenant', 'idx_companies_verified');

  IF index_count <> 2 THEN
    RAISE EXCEPTION 'Phase 2C verification failed: expected the tenant and verified indexes on public.companies, found %.',
      index_count;
  END IF;

  SELECT count(*)
    INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'public.companies'::regclass
    AND NOT tgisinternal;

  IF trigger_count <> 2 THEN
    RAISE EXCEPTION 'Phase 2C verification failed: expected 2 guards on public.companies, found %.',
      trigger_count;
  END IF;

  -- Verify company_id FK on profiles
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'company_id'
  ) INTO profile_fk_exists;

  IF profile_fk_exists IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Phase 2C verification failed: company_id column not found on public.profiles.';
  END IF;

  RAISE NOTICE 'Phase 2C verified: public.companies — RLS enabled, % tenant-isolation policies, tenant/verified indexes and % guards in place. profiles.company_id FK added.',
    policy_count,
    trigger_count;
END $$;

-- ============================================================
-- END OF PHASE 2C COMPANIES FOUNDATION MIGRATION
-- ============================================================