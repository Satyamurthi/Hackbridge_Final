-- ============================================================
-- HACKBRIDGE PHASE 9 — STUDENT TALENT POOL & VERIFIED PORTFOLIOS FOUNDATION
-- Migration: 20260925000001_phase9_talent_profiles_foundation.sql
--
-- Source of truth: HackBridge.pdf
--   * section "2. Database Schema" -> "HIRING PIPELINE" -> "talent_profiles"
--   * section "4.4 Student Portal" -> profile, verified credentials, portfolio
--
-- Scope (Phase 9):
--   1. public.talent_profiles table:
--        - Links user_id to verified hackathon rankings, percentiles, and award badges.
--        - Stores career preferences: job types ('full_time', 'internship', etc.),
--          preferred locations, availability date, and technical skills.
--        - Professional links: GitHub, LinkedIn, Personal Site, and Resume.
--        - Recruiter visibility consent toggle (is_visible) and timestamp (consent_given_at).
--   2. RLS Policies:
--        - Students manage their own talent profile (insert, update, read).
--        - Company recruiters and tenant admins can search visible talent profiles.
--        - Public can read visible profiles via shareable portfolio link.
--   3. Trigger:
--        - Auto-maintains updated_at.
--
-- Run order (cumulative):
--   1. 20260915000001_initial_foundation.sql
--   2. 20260916000001_phase1_5_security_hardening.sql
--   3. 20260917000001_pilot_tenant_mitt.sql
--   4. 20260918000001_phase2a_hackathon_foundation.sql
--   5. 20260919000001_phase2c_companies_foundation.sql
--   6. 20260920000001_phase3a_problem_statements.sql
--   7. 20260921000001_phase4_teams_foundation.sql
--   8. 20260922000001_phase5_submissions_foundation.sql
--   9. 20260923000001_phase7_evaluation_foundation.sql
--  10. 20260924000001_phase8_leaderboard_foundation.sql
--  11. THIS FILE
-- ============================================================

-- ============================================================
-- 1. TALENT PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.talent_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  hackathon_id        UUID REFERENCES public.hackathons(id) ON DELETE SET NULL,
  team_id             UUID REFERENCES public.teams(id) ON DELETE SET NULL,

  -- Profile Headline & Bio
  headline            TEXT,
  bio                 TEXT,

  -- Derived from verified hackathon performance
  overall_rank        INT,
  percentile          DECIMAL(5,2),
  badge               VARCHAR(100) DEFAULT 'participant',
  -- Badges: 'winner' | 'runner_up' | 'second_runner_up' | 'top_10' | 'shortlisted' | 'participant'
  achievements        JSONB NOT NULL DEFAULT '[]',

  -- Skills & Competencies
  skills              TEXT[] NOT NULL DEFAULT '{}',

  -- Professional Links & Resume
  github_url          TEXT,
  linkedin_url        TEXT,
  portfolio_url       TEXT,
  resume_url          TEXT,

  -- Career Preferences & Availability
  available_from      DATE,
  looking_for         TEXT[] NOT NULL DEFAULT '{}',
  -- Options: 'full_time', 'internship', 'part_time', 'contract'
  preferred_location  TEXT[] NOT NULL DEFAULT '{}',

  -- Recruiter Visibility & Privacy Consent
  is_visible          BOOLEAN NOT NULL DEFAULT true,
  consent_given_at    TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT talent_profiles_user_unique UNIQUE (user_id)
);

COMMENT ON TABLE public.talent_profiles IS
  'HackBridge.pdf: Student verified talent profile with hackathon rank, credentials, skills, and recruiter discovery settings. Phase 9.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_talent_profiles_user
  ON public.talent_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_talent_profiles_tenant
  ON public.talent_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_talent_profiles_visible
  ON public.talent_profiles(is_visible);
CREATE INDEX IF NOT EXISTS idx_talent_profiles_badge
  ON public.talent_profiles(badge);
CREATE INDEX IF NOT EXISTS idx_talent_profiles_skills
  ON public.talent_profiles USING GIN(skills);

-- Trigger: auto-maintain updated_at
CREATE OR REPLACE FUNCTION public.handle_talent_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_talent_profiles_updated_at ON public.talent_profiles;
CREATE TRIGGER trg_talent_profiles_updated_at
  BEFORE UPDATE ON public.talent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_talent_profiles_updated_at();

-- ============================================================
-- 2. ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE public.talent_profiles ENABLE ROW LEVEL SECURITY;

-- 1. Student can read own profile
DROP POLICY IF EXISTS "talent_profiles_self_read" ON public.talent_profiles;
CREATE POLICY "talent_profiles_self_read"
  ON public.talent_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2. Student can insert own profile
DROP POLICY IF EXISTS "talent_profiles_self_insert" ON public.talent_profiles;
CREATE POLICY "talent_profiles_self_insert"
  ON public.talent_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. Student can update own profile
DROP POLICY IF EXISTS "talent_profiles_self_update" ON public.talent_profiles;
CREATE POLICY "talent_profiles_self_update"
  ON public.talent_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Corporate recruiters and tenant admins can search visible talent profiles within the tenant
DROP POLICY IF EXISTS "talent_profiles_recruiter_read" ON public.talent_profiles;
CREATE POLICY "talent_profiles_recruiter_read"
  ON public.talent_profiles
  FOR SELECT
  TO authenticated
  USING (
    is_visible = true AND (
      tenant_id = public.get_current_user_tenant_id() OR
      public.is_super_admin()
    )
  );

-- 5. Public read access for shareable profile URLs when visible
DROP POLICY IF EXISTS "talent_profiles_public_read" ON public.talent_profiles;
CREATE POLICY "talent_profiles_public_read"
  ON public.talent_profiles
  FOR SELECT
  TO anon
  USING (is_visible = true);
