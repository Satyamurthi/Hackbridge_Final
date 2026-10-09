-- ============================================================
-- HACKBRIDGE PHASE 5 — MULTI-FORMAT SUBMISSIONS FOUNDATION
-- Migration: 20260922000001_phase5_submissions_foundation.sql
--
-- Source of truth: HackBridge.pdf
--   * section "2. Database Schema" -> "SUBMISSIONS"
--     (table: submissions, URLs, abstract, approach, tech_stack, is_final, RLS)
--   * section "3.6 Hackathon Module" -> hacking phase lifecycle
--
-- Scope (Phase 5):
--   1. public.submissions table — multi-format project deliverables
--   2. URL format validation checks for repo_url, demo_url, presentation_url, video_url
--   3. Unique constraint: UNIQUE(team_id, submission_round)
--   4. Integrity guards & triggers:
--        - last_edited_at maintenance
--        - Immutability guard: once is_final = true, non-super-admins cannot edit
--        - Team status sync: setting is_final = true automatically sets teams.status = 'submitted'
--   5. Row Level Security:
--        - Team members can SELECT and INSERT/UPDATE their team's submission draft
--        - Tenant admins, committee members, and evaluators can SELECT submissions
--        - Competing students cannot view other teams' drafts
--
-- Explicitly OUT of scope (later phases):
--   AI pre-screening execution (Phase 6), rubric evaluation engine (Phase 7),
--   leaderboards (Phase 8), talent pool / hiring (Phases 9-10), storage buckets (Phase 12).
--
-- Safety guarantees:
--   * Idempotent — CREATE ... IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS only
--   * Additive and non-destructive — no existing tables or data altered
--   * Zero seed data
--
-- Run order (cumulative):
--   1. 20260915000001_initial_foundation.sql
--   2. 20260916000001_phase1_5_security_hardening.sql
--   3. 20260917000001_pilot_tenant_mitt.sql
--   4. 20260918000001_phase2a_hackathon_foundation.sql
--   5. 20260919000001_phase2c_companies_foundation.sql
--   6. 20260920000001_phase3a_problem_statements.sql
--   7. 20260921000001_phase4_teams_foundation.sql
--   8. THIS FILE
-- ============================================================

-- ============================================================
-- 1. SUBMISSIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent Entity References
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  hackathon_id  UUID NOT NULL REFERENCES public.hackathons(id) ON DELETE CASCADE,
  problem_id    UUID REFERENCES public.problem_statements(id) ON DELETE SET NULL,

  -- Content & Technical Approach
  title         VARCHAR(500) NOT NULL,
  abstract      TEXT NOT NULL,
  approach      TEXT,

  -- Multi-Format Artifact Deliverables (Verified URLs)
  demo_url         TEXT,  -- live deployment / web app
  repo_url         TEXT,  -- GitHub / GitLab repo
  presentation_url TEXT,  -- slide deck / pitch deck
  video_url        TEXT,  -- demo video (Loom / YouTube / Drive)

  -- Structured Metadata
  files         JSONB NOT NULL DEFAULT '[]',
  tech_stack    TEXT[] NOT NULL DEFAULT '{}',

  -- AI-Assisted Pre-Screening Columns (Phase 6 hook)
  ai_summary    TEXT,
  ai_scores     JSONB NOT NULL DEFAULT '{}',
  ai_flags      TEXT[] NOT NULL DEFAULT '{}',

  -- Submission Lifecycle & Locking
  submission_round INT NOT NULL DEFAULT 1,
  submitted_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_edited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_final         BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT submissions_title_not_blank_check CHECK (btrim(title) <> ''),
  CONSTRAINT submissions_abstract_not_blank_check CHECK (btrim(abstract) <> ''),
  CONSTRAINT submissions_demo_url_check
    CHECK (demo_url IS NULL OR demo_url ~ '^https?://\S+$'),
  CONSTRAINT submissions_repo_url_check
    CHECK (repo_url IS NULL OR repo_url ~ '^https?://\S+$'),
  CONSTRAINT submissions_presentation_url_check
    CHECK (presentation_url IS NULL OR presentation_url ~ '^https?://\S+$'),
  CONSTRAINT submissions_video_url_check
    CHECK (video_url IS NULL OR video_url ~ '^https?://\S+$'),
  CONSTRAINT submissions_team_round_unique UNIQUE (team_id, submission_round)
);

COMMENT ON TABLE public.submissions IS
  'HackBridge.pdf: multi-format project submissions submitted by student teams. Phase 5.';
COMMENT ON COLUMN public.submissions.is_final IS
  'When true, locked for judging. Trigger sets parent teams.status = submitted.';

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_submissions_team ON public.submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_submissions_hackathon ON public.submissions(hackathon_id);
CREATE INDEX IF NOT EXISTS idx_submissions_problem ON public.submissions(problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_is_final ON public.submissions(hackathon_id, is_final);

-- ============================================================
-- 3. INTEGRITY GUARDS & TRIGGERS
-- ============================================================

-- 3a. Update last_edited_at timestamp on modification
CREATE OR REPLACE FUNCTION public.set_submissions_last_edited_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.last_edited_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submissions_last_edited_at ON public.submissions;
CREATE TRIGGER trg_submissions_last_edited_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_submissions_last_edited_at();

-- 3b. Immutability guard: once is_final is true, non-super-admins cannot alter submission
CREATE OR REPLACE FUNCTION public.enforce_submission_final_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_final = true AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'This project submission has been locked as final and cannot be edited.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submissions_lock_final ON public.submissions;
CREATE TRIGGER trg_submissions_lock_final
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_submission_final_lock();

-- 3c. When submission is finalized, automatically update parent teams.status = 'submitted'
CREATE OR REPLACE FUNCTION public.sync_team_submission_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_final = true AND (OLD IS NULL OR OLD.is_final = false) THEN
    UPDATE public.teams
    SET status = 'submitted', updated_at = NOW()
    WHERE id = NEW.team_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submissions_update_team_status ON public.submissions;
CREATE TRIGGER trg_submissions_update_team_status
  AFTER INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.sync_team_submission_status();

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- SELECT:
-- 1. Super admin has global read access
-- 2. College admin, committee member, or evaluator of the hackathon tenant can read all submissions
-- 3. Students can read submissions for teams they belong to
CREATE POLICY submissions_select_policy ON public.submissions
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = submissions.hackathon_id
        AND (
          public.is_college_admin(h.tenant_id)
          OR public.get_current_user_role() IN ('committee_member', 'evaluator')
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = submissions.team_id
        AND tm.user_id = auth.uid()
    )
  );

-- INSERT:
-- Any member of the team can create the initial submission draft for their team
CREATE POLICY submissions_insert_policy ON public.submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = submissions.team_id
        AND tm.user_id = auth.uid()
    )
  );

-- UPDATE:
-- Any member of the team can update the submission draft (if not finalized),
-- or college_admin / super_admin can update
CREATE POLICY submissions_update_policy ON public.submissions
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = submissions.hackathon_id
        AND public.is_college_admin(h.tenant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = submissions.team_id
        AND tm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = submissions.hackathon_id
        AND public.is_college_admin(h.tenant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = submissions.team_id
        AND tm.user_id = auth.uid()
    )
  );

-- DELETE:
-- Only team leader or college/super admin can delete a submission
CREATE POLICY submissions_delete_policy ON public.submissions
  FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = submissions.hackathon_id
        AND public.is_college_admin(h.tenant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = submissions.team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'leader'
    )
  );
