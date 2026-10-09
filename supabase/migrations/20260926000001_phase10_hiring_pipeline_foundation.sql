-- ============================================================
-- HACKBRIDGE PHASE 10 — INDUSTRY HIRING PIPELINE & RECRUITER PORTAL
-- Migration: 20260926000001_phase10_hiring_pipeline_foundation.sql
--
-- Source of truth: HackBridge.pdf
--   * section "2. Database Schema" -> "HIRING PIPELINE" -> "hiring_interests"
--   * section "4.6 Company Portal" -> candidate discovery & recruitment pipeline
--   * section "4.4 Student Portal" -> incoming interview & job offers
--
-- Scope (Phase 10):
--   1. public.hiring_interests table:
--        - Connects corporate partners (public.companies) with verified talent (public.talent_profiles).
--        - Tracks interest_type: 'shortlisted', 'interview_requested', 'offer_made', 'hired'.
--        - Stores role_title, compensation_range, and recruiter invitation message.
--        - Tracks student_response: 'pending', 'accepted', 'declined' with student notes and timestamps.
--   2. RLS Policies:
--        - Company reps can view and create hiring interests for their own company.
--        - Students can view inquiries addressed to their own talent profile.
--        - Students can update their response (accepted / declined) and notes.
--        - College admins and super admins can view all tenant hiring interests for institutional placement metrics.
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
--  11. 20260925000001_phase9_talent_profiles_foundation.sql
--  12. THIS FILE
-- ============================================================

-- ============================================================
-- 1. HIRING INTERESTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hiring_interests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  talent_profile_id   UUID NOT NULL REFERENCES public.talent_profiles(id) ON DELETE CASCADE,
  expressed_by        UUID NOT NULL REFERENCES public.profiles(id),

  -- Interest Lifecycle
  interest_type       VARCHAR(50) NOT NULL CHECK (
    interest_type IN ('shortlisted', 'interview_requested', 'offer_made', 'hired')
  ),
  role_title          TEXT NOT NULL,
  message             TEXT,
  compensation_range  TEXT,

  -- Student Response
  student_response    VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
    student_response IN ('pending', 'accepted', 'declined')
  ),
  student_notes       TEXT,
  responded_at        TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT hiring_interests_unique_outreach UNIQUE (company_id, talent_profile_id, role_title)
);

COMMENT ON TABLE public.hiring_interests IS
  'HackBridge.pdf: Corporate recruiter hiring interests, interview requests, and student offer responses. Phase 10.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hiring_interests_company
  ON public.hiring_interests(company_id);
CREATE INDEX IF NOT EXISTS idx_hiring_interests_talent
  ON public.hiring_interests(talent_profile_id);
CREATE INDEX IF NOT EXISTS idx_hiring_interests_status
  ON public.hiring_interests(interest_type);
CREATE INDEX IF NOT EXISTS idx_hiring_interests_response
  ON public.hiring_interests(student_response);

-- Trigger: auto-maintain updated_at
CREATE OR REPLACE FUNCTION public.handle_hiring_interests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hiring_interests_updated_at ON public.hiring_interests;
CREATE TRIGGER trg_hiring_interests_updated_at
  BEFORE UPDATE ON public.hiring_interests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_hiring_interests_updated_at();

-- ============================================================
-- 2. ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE public.hiring_interests ENABLE ROW LEVEL SECURITY;

-- 1. Company members can read hiring interests created by their company
DROP POLICY IF EXISTS "hiring_interests_company_read" ON public.hiring_interests;
CREATE POLICY "hiring_interests_company_read"
  ON public.hiring_interests
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    ) OR
    public.is_super_admin()
  );

-- 2. Company members can insert hiring interests for their company
DROP POLICY IF EXISTS "hiring_interests_company_insert" ON public.hiring_interests;
CREATE POLICY "hiring_interests_company_insert"
  ON public.hiring_interests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    ) OR
    public.is_super_admin()
  );

-- 3. Company members can update their own hiring interests (e.g. status transition to 'hired')
DROP POLICY IF EXISTS "hiring_interests_company_update" ON public.hiring_interests;
CREATE POLICY "hiring_interests_company_update"
  ON public.hiring_interests
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    ) OR
    public.is_super_admin()
  )
  WITH CHECK (
    company_id IN (
      SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
    ) OR
    public.is_super_admin()
  );

-- 4. Students can read hiring interests addressed to their own talent profile
DROP POLICY IF EXISTS "hiring_interests_student_read" ON public.hiring_interests;
CREATE POLICY "hiring_interests_student_read"
  ON public.hiring_interests
  FOR SELECT
  TO authenticated
  USING (
    talent_profile_id IN (
      SELECT tp.id FROM public.talent_profiles tp WHERE tp.user_id = auth.uid()
    )
  );

-- 5. Students can update their response on inquiries addressed to them
DROP POLICY IF EXISTS "hiring_interests_student_response" ON public.hiring_interests;
CREATE POLICY "hiring_interests_student_response"
  ON public.hiring_interests
  FOR UPDATE
  TO authenticated
  USING (
    talent_profile_id IN (
      SELECT tp.id FROM public.talent_profiles tp WHERE tp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    talent_profile_id IN (
      SELECT tp.id FROM public.talent_profiles tp WHERE tp.user_id = auth.uid()
    )
  );

-- 6. College admins can read all hiring interests within their tenant for placement tracking
DROP POLICY IF EXISTS "hiring_interests_admin_read" ON public.hiring_interests;
CREATE POLICY "hiring_interests_admin_read"
  ON public.hiring_interests
  FOR SELECT
  TO authenticated
  USING (
    talent_profile_id IN (
      SELECT tp.id FROM public.talent_profiles tp
      WHERE tp.tenant_id = public.get_current_user_tenant_id()
    ) AND (
      public.get_current_user_role() IN ('college_admin', 'committee_member', 'super_admin')
    )
  );
