-- ============================================================
-- HACKBRIDGE PHASE 8 — DYNAMIC LIVE LEADERBOARD FOUNDATION
-- Migration: 20260924000001_phase8_leaderboard_foundation.sql
--
-- Source of truth: HackBridge.pdf
--   * section "2. Database Schema" -> "VIEWS FOR COMMON QUERIES" -> "leaderboard"
--   * section "4.5 LEADERBOARD / RANKINGS" -> public display, ranks, award badges
--
-- Scope (Phase 8):
--   1. public.leaderboard VIEW:
--        - Joins submissions, teams, submission_scores_aggregate, hackathons,
--          problem_statements, and companies.
--        - Computes dynamic rank_overall and rank_in_problem via DENSE_RANK().
--        - Exposes score (weighted_avg), evaluator count, vote tallies, deliverables,
--          and committee final_decision.
--   2. public.finalize_hackathon_awards() RPC:
--        - Allows college admins / committee members to assign official award tiers
--          ('winner', 'runner_up', 'second_runner_up', 'top_10', 'shortlisted', 'honorable_mention').
--        - Advances hackathon status from 'evaluation' to 'completed'.
--        - Stamps hackathons.results_announced_at = NOW().
--        - Synchronizes parent teams.status.
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
--  10. THIS FILE
-- ============================================================

-- ============================================================
-- 1. DYNAMIC LEADERBOARD VIEW
-- ============================================================

-- Drop existing view if any exists
DROP VIEW IF EXISTS public.leaderboard CASCADE;

CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  s.hackathon_id,
  h.tenant_id,
  h.title AS hackathon_title,
  h.slug AS hackathon_slug,
  h.status AS hackathon_status,
  h.results_announced_at,

  -- Submission details
  s.id AS submission_id,
  s.title AS submission_title,
  s.abstract AS submission_abstract,
  s.approach AS submission_approach,
  s.demo_url,
  s.repo_url,
  s.presentation_url,
  s.video_url,
  s.tech_stack,
  s.submitted_at,

  -- Team details
  t.id AS team_id,
  t.name AS team_name,
  t.status AS team_status,

  -- Problem Statement & Corporate Sponsor details
  s.problem_id,
  ps.title AS problem_title,
  ps.domain AS problem_domain,
  ps.difficulty AS problem_difficulty,
  c.id AS company_id,
  c.name AS company_name,
  c.logo_url AS company_logo_url,

  -- Score Aggregates & Deliberation
  ssa.round,
  ssa.weighted_avg AS score,
  ssa.avg_score,
  ssa.score_variance,
  ssa.evaluator_count,
  ssa.advance_votes,
  ssa.reject_votes,
  ssa.borderline_votes,
  ssa.criterion_averages,
  ssa.final_decision,
  ssa.decided_at,

  -- Dynamic Ranks computed across normalized weighted average
  DENSE_RANK() OVER (
    PARTITION BY s.hackathon_id, ssa.round
    ORDER BY COALESCE(ssa.weighted_avg, 0) DESC, ssa.advance_votes DESC, s.submitted_at ASC
  ) AS rank_overall,

  DENSE_RANK() OVER (
    PARTITION BY s.hackathon_id, s.problem_id, ssa.round
    ORDER BY COALESCE(ssa.weighted_avg, 0) DESC, ssa.advance_votes DESC, s.submitted_at ASC
  ) AS rank_in_problem

FROM public.submissions s
JOIN public.hackathons h ON h.id = s.hackathon_id
JOIN public.teams t ON t.id = s.team_id
JOIN public.submission_scores_aggregate ssa ON ssa.submission_id = s.id
LEFT JOIN public.problem_statements ps ON ps.id = s.problem_id
LEFT JOIN public.companies c ON c.id = ps.company_id
WHERE s.is_final = true;

COMMENT ON VIEW public.leaderboard IS
  'HackBridge.pdf section 2: Dynamic leaderboard view joining submissions, teams, aggregate scores, problem statements, and companies. Phase 8.';

-- Grant read permissions on view
GRANT SELECT ON public.leaderboard TO authenticated, anon;


-- ============================================================
-- 2. COMMITTEE FINAL AWARD ALLOCATION & ANNOUNCEMENT RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.finalize_hackathon_awards(
  p_hackathon_id UUID,
  p_round INT,
  p_decisions JSONB  -- Array of { "submission_id": UUID, "final_decision": text }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role public.user_role;
  v_caller_tenant_id UUID;
  v_hackathon public.hackathons%ROWTYPE;
  v_item JSONB;
  v_sub_id UUID;
  v_decision TEXT;
  v_team_id UUID;
  v_updated_count INT := 0;
BEGIN
  -- 1. Security Check: Authenticated session required
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to finalize hackathon awards.';
  END IF;

  SELECT role, tenant_id INTO v_caller_role, v_caller_tenant_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- 2. Fetch target hackathon
  SELECT * INTO v_hackathon
  FROM public.hackathons
  WHERE id = p_hackathon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hackathon not found.';
  END IF;

  -- 3. Authorization check: Super admin or owning tenant college_admin / committee_member
  IF v_caller_role <> 'super_admin' THEN
    IF v_caller_tenant_id IS DISTINCT FROM v_hackathon.tenant_id OR
       v_caller_role NOT IN ('college_admin', 'committee_member') THEN
      RAISE EXCEPTION 'Permission denied: Only college administrators or committee members may finalize awards.';
    END IF;
  END IF;

  -- 4. Apply final_decision to submission_scores_aggregate
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_decisions)
  LOOP
    v_sub_id := (v_item->>'submission_id')::UUID;
    v_decision := v_item->>'final_decision';

    IF v_sub_id IS NOT NULL AND v_decision IS NOT NULL THEN
      -- Update aggregate record
      UPDATE public.submission_scores_aggregate
      SET
        final_decision = v_decision,
        decided_by = auth.uid(),
        decided_at = NOW()
      WHERE submission_id = v_sub_id
        AND round = p_round;

      -- Update parent team status accordingly
      SELECT team_id INTO v_team_id
      FROM public.submissions
      WHERE id = v_sub_id;

      IF v_team_id IS NOT NULL THEN
        UPDATE public.teams
        SET status = CASE
          WHEN v_decision IN ('winner', 'runner_up', 'second_runner_up', 'top_10', 'advanced', 'shortlisted') THEN 'shortlisted'
          ELSE 'evaluated'
        END,
        updated_at = NOW()
        WHERE id = v_team_id;
      END IF;

      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;

  -- 5. Transition Hackathon lifecycle to completed if currently in evaluation
  IF v_hackathon.status = 'evaluation' THEN
    UPDATE public.hackathons
    SET
      status = 'completed',
      results_announced_at = COALESCE(results_announced_at, NOW()),
      updated_at = NOW()
    WHERE id = p_hackathon_id;
  ELSE
    -- If already completed, ensure results_announced_at is stamped
    UPDATE public.hackathons
    SET
      results_announced_at = COALESCE(results_announced_at, NOW()),
      updated_at = NOW()
    WHERE id = p_hackathon_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'hackathon_id', p_hackathon_id,
    'updated_count', v_updated_count,
    'results_announced_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.finalize_hackathon_awards IS
  'HackBridge.pdf: Allows committee members to assign awards and advance hackathon to completed with official results announcement timestamp. Phase 8.';

GRANT EXECUTE ON FUNCTION public.finalize_hackathon_awards TO authenticated;
