-- ============================================================
-- HACKBRIDGE PHASE 7 — DOUBLE-BLIND EVALUATION ENGINE FOUNDATION
-- Migration: 20260923000001_phase7_evaluation_foundation.sql
--
-- Source of truth: HackBridge.pdf
--   * section "2. Database Schema" -> "EVALUATION ENGINE"
--     (tables: evaluation_assignments, evaluation_scores, submission_scores_aggregate)
--   * section "3.8 Evaluation Module" -> judging workflow, double-blind scoring, COI
--
-- Scope (Phase 7):
--   1. public.evaluation_assignments table — judge assignments per round with status tracking
--   2. public.evaluation_scores table — rubric criterion scores (JSONB), weights, COI, qualitative feedback
--   3. public.submission_scores_aggregate table — automated aggregate statistics and rankings
--   4. Trigger guards:
--        - Automatic assignment completion/recusal sync on score submission
--        - Real-time recomputation of submission score aggregates (averages, variance, criterion averages, votes)
--   5. Row Level Security:
--        - Evaluators read & write their own assignments and scores
--        - Double-blind guarantee: competing students cannot read evaluator identities, assignments, or scores
--        - Tenant admins & committee members have full management and oversight
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
--   9. THIS FILE
-- ============================================================

-- ============================================================
-- 1. EVALUATION ASSIGNMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.evaluation_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  evaluator_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  round          INT NOT NULL DEFAULT 1,
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at         TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  status         VARCHAR(50) NOT NULL DEFAULT 'pending',

  CONSTRAINT evaluation_assignments_status_check
    CHECK (status IN ('pending', 'in_progress', 'completed', 'recused')),
  CONSTRAINT evaluation_assignments_sub_eval_round_unique
    UNIQUE (submission_id, evaluator_id, round)
);

COMMENT ON TABLE public.evaluation_assignments IS
  'HackBridge.pdf: Evaluator assignment to a project submission per evaluation round. Phase 7.';

CREATE INDEX IF NOT EXISTS idx_eval_assignments_submission
  ON public.evaluation_assignments(submission_id);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_evaluator
  ON public.evaluation_assignments(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_status
  ON public.evaluation_assignments(status);

-- ============================================================
-- 2. EVALUATION SCORES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.evaluation_scores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  UUID NOT NULL REFERENCES public.evaluation_assignments(id) ON DELETE CASCADE,
  submission_id  UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  evaluator_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  round          INT NOT NULL DEFAULT 1,

  -- Rubric Scores (JSONB mapping criterion key to numeric score)
  -- e.g. { "innovation": 8.5, "technical_complexity": 7.0, "presentation": 9.0 }
  scores         JSONB NOT NULL DEFAULT '{}',
  total_score    DECIMAL(6,2),
  weighted_score DECIMAL(6,2),

  -- Qualitative Feedback
  strengths        TEXT,
  weaknesses       TEXT,
  recommendation   VARCHAR(50),
  private_notes    TEXT,  -- visible only to evaluators and committee
  public_feedback  TEXT,  -- visible to team after results announcement

  -- Conflict of Interest
  coi_declared     BOOLEAN NOT NULL DEFAULT false,
  coi_reason       TEXT,

  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT evaluation_scores_recommendation_check
    CHECK (recommendation IS NULL OR recommendation IN ('advance', 'reject', 'borderline')),
  CONSTRAINT evaluation_scores_assignment_unique
    UNIQUE (assignment_id)
);

COMMENT ON TABLE public.evaluation_scores IS
  'HackBridge.pdf: Individual judge rubric score and qualitative critique. Phase 7.';

CREATE INDEX IF NOT EXISTS idx_eval_scores_submission
  ON public.evaluation_scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_eval_scores_evaluator
  ON public.evaluation_scores(evaluator_id);

-- ============================================================
-- 3. SUBMISSION SCORES AGGREGATE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.submission_scores_aggregate (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id    UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  round            INT NOT NULL DEFAULT 1,

  avg_score        DECIMAL(6,2),
  weighted_avg     DECIMAL(6,2),
  score_variance   DECIMAL(8,4),
  evaluator_count  INT NOT NULL DEFAULT 0,

  -- Per-criterion averages
  criterion_averages JSONB NOT NULL DEFAULT '{}',

  -- Relative standings
  rank_in_problem  INT,
  rank_overall     INT,

  -- Deliberation votes
  advance_votes    INT NOT NULL DEFAULT 0,
  reject_votes     INT NOT NULL DEFAULT 0,
  borderline_votes INT NOT NULL DEFAULT 0,

  -- Final committee decision
  final_decision   VARCHAR(50),
  decided_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at       TIMESTAMPTZ,

  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT submission_scores_aggregate_final_decision_check
    CHECK (final_decision IS NULL OR final_decision IN ('advanced', 'rejected', 'waitlisted', 'winner')),
  CONSTRAINT submission_scores_aggregate_sub_round_unique
    UNIQUE (submission_id, round)
);

COMMENT ON TABLE public.submission_scores_aggregate IS
  'HackBridge.pdf: Real-time aggregated judge scores and rank per submission per round. Phase 7.';

CREATE INDEX IF NOT EXISTS idx_submission_scores_agg_sub
  ON public.submission_scores_aggregate(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_scores_agg_round
  ON public.submission_scores_aggregate(round, weighted_avg DESC NULLS LAST);

-- ============================================================
-- 4. TRIGGERS: ASSIGNMENT SYNC & AGGREGATE RECOMPUTATION
-- ============================================================

-- 4a. Sync Assignment Status on Score Insert/Update
CREATE OR REPLACE FUNCTION public.sync_eval_assignment_on_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.coi_declared = true THEN
    UPDATE public.evaluation_assignments
    SET status = 'recused', completed_at = NOW()
    WHERE id = NEW.assignment_id;
  ELSE
    UPDATE public.evaluation_assignments
    SET status = 'completed', completed_at = NOW()
    WHERE id = NEW.assignment_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eval_scores_sync_assignment ON public.evaluation_scores;
CREATE TRIGGER trg_eval_scores_sync_assignment
  AFTER INSERT OR UPDATE ON public.evaluation_scores
  FOR EACH ROW EXECUTE FUNCTION public.sync_eval_assignment_on_score();

-- 4b. Recompute Aggregated Scores
CREATE OR REPLACE FUNCTION public.recompute_submission_scores_aggregate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id UUID;
  v_round INT;
  v_count INT;
  v_avg_score DECIMAL(6,2);
  v_weighted_avg DECIMAL(6,2);
  v_variance DECIMAL(8,4);
  v_advance INT;
  v_reject INT;
  v_borderline INT;
BEGIN
  v_sub_id := NEW.submission_id;
  v_round := NEW.round;

  -- Only aggregate valid, non-recused evaluations
  SELECT
    COUNT(*),
    ROUND(AVG(total_score), 2),
    ROUND(AVG(weighted_score), 2),
    COALESCE(ROUND(VARIANCE(weighted_score), 4), 0),
    COUNT(*) FILTER (WHERE recommendation = 'advance'),
    COUNT(*) FILTER (WHERE recommendation = 'reject'),
    COUNT(*) FILTER (WHERE recommendation = 'borderline')
  INTO
    v_count,
    v_avg_score,
    v_weighted_avg,
    v_variance,
    v_advance,
    v_reject,
    v_borderline
  FROM public.evaluation_scores
  WHERE submission_id = v_sub_id
    AND round = v_round
    AND coi_declared = false;

  -- Upsert into submission_scores_aggregate
  INSERT INTO public.submission_scores_aggregate (
    submission_id,
    round,
    avg_score,
    weighted_avg,
    score_variance,
    evaluator_count,
    advance_votes,
    reject_votes,
    borderline_votes,
    computed_at
  )
  VALUES (
    v_sub_id,
    v_round,
    v_avg_score,
    v_weighted_avg,
    v_variance,
    COALESCE(v_count, 0),
    COALESCE(v_advance, 0),
    COALESCE(v_reject, 0),
    COALESCE(v_borderline, 0),
    NOW()
  )
  ON CONFLICT (submission_id, round)
  DO UPDATE SET
    avg_score = EXCLUDED.avg_score,
    weighted_avg = EXCLUDED.weighted_avg,
    score_variance = EXCLUDED.score_variance,
    evaluator_count = EXCLUDED.evaluator_count,
    advance_votes = EXCLUDED.advance_votes,
    reject_votes = EXCLUDED.reject_votes,
    borderline_votes = EXCLUDED.borderline_votes,
    computed_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eval_scores_recompute_aggregate ON public.evaluation_scores;
CREATE TRIGGER trg_eval_scores_recompute_aggregate
  AFTER INSERT OR UPDATE ON public.evaluation_scores
  FOR EACH ROW EXECUTE FUNCTION public.recompute_submission_scores_aggregate();

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.evaluation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_scores_aggregate ENABLE ROW LEVEL SECURITY;

-- 5a. evaluation_assignments Policies
-- Evaluator can read assignments assigned to them
CREATE POLICY "eval_assignments_select_evaluator"
  ON public.evaluation_assignments
  FOR SELECT
  TO authenticated
  USING (
    evaluator_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.hackathons h ON h.id = s.hackathon_id
      WHERE s.id = evaluation_assignments.submission_id
        AND (
          public.is_college_admin(h.tenant_id)
          OR public.get_current_user_role() = 'committee_member'
        )
    )
  );

-- Evaluator can update assignment status (e.g. mark in_progress or recused)
CREATE POLICY "eval_assignments_update_evaluator"
  ON public.evaluation_assignments
  FOR UPDATE
  TO authenticated
  USING (
    evaluator_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.hackathons h ON h.id = s.hackathon_id
      WHERE s.id = evaluation_assignments.submission_id
        AND public.is_college_admin(h.tenant_id)
    )
  );

-- College admin / committee can create assignments
CREATE POLICY "eval_assignments_insert_admin"
  ON public.evaluation_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.hackathons h ON h.id = s.hackathon_id
      WHERE s.id = evaluation_assignments.submission_id
        AND (
          public.is_college_admin(h.tenant_id)
          OR public.get_current_user_role() = 'committee_member'
        )
    )
  );

-- 5b. evaluation_scores Policies
-- Evaluators can read their own scores; admins/committee can read all for their tenant
CREATE POLICY "eval_scores_select"
  ON public.evaluation_scores
  FOR SELECT
  TO authenticated
  USING (
    evaluator_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.hackathons h ON h.id = s.hackathon_id
      WHERE s.id = evaluation_scores.submission_id
        AND (
          public.is_college_admin(h.tenant_id)
          OR public.get_current_user_role() = 'committee_member'
        )
    )
  );

-- Evaluators can insert scores for assignments assigned to them
CREATE POLICY "eval_scores_insert"
  ON public.evaluation_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.evaluation_assignments ea
      WHERE ea.id = assignment_id
        AND ea.evaluator_id = auth.uid()
        AND ea.status <> 'recused'
    )
  );

-- Evaluators can update their own score before final lock
CREATE POLICY "eval_scores_update"
  ON public.evaluation_scores
  FOR UPDATE
  TO authenticated
  USING (
    evaluator_id = auth.uid()
    OR public.is_super_admin()
  );

-- 5c. submission_scores_aggregate Policies
-- Admins and committee can read all aggregates; evaluators can read aggregates for judging review
CREATE POLICY "submission_scores_agg_select"
  ON public.submission_scores_aggregate
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.hackathons h ON h.id = s.hackathon_id
      WHERE s.id = submission_scores_aggregate.submission_id
        AND (
          public.is_college_admin(h.tenant_id)
          OR public.get_current_user_role() IN ('committee_member', 'evaluator')
          -- Students can only read after results are announced
          OR (
            public.get_current_user_role() = 'student'
            AND (h.status IN ('completed', 'archived') OR (h.results_announced_at IS NOT NULL AND h.results_announced_at <= NOW()))
          )
        )
    )
  );

-- Admins and committee can update final decisions
CREATE POLICY "submission_scores_agg_update_admin"
  ON public.submission_scores_aggregate
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.hackathons h ON h.id = s.hackathon_id
      WHERE s.id = submission_scores_aggregate.submission_id
        AND (
          public.is_college_admin(h.tenant_id)
          OR public.get_current_user_role() = 'committee_member'
        )
    )
  );
