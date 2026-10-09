-- ============================================================
-- HACKBRIDGE PHASE 4 — TEAMS & REGISTRATIONS DATABASE FOUNDATION
-- Migration: 20260921000001_phase4_teams_foundation.sql
--
-- Source of truth: HackBridge.pdf
--   * section "2. Database Schema" -> "TEAMS & REGISTRATIONS"
--     (tables: teams, team_members, invite_code, status lifecycle, RLS)
--   * section "3.6 Hackathon Module" -> team limits, max_team_size, allow_solo
--
-- Scope (Phase 4):
--   1. team_status enum (forming → registered → submitted → evaluated → shortlisted → rejected)
--   2. public.teams table — tenant-isolated via hackathon_id
--   3. public.team_members table — mapping students to teams with role (leader/member)
--   4. Indexes for hackathon, invite_code, user, and problem lookups
--   5. Integrity guards & triggers:
--        - updated_at maintenance (reuses public.set_updated_at())
--        - created_by derived from auth.uid() on INSERT
--        - Automatic team leader membership insertion upon team creation
--        - Invariant: A user can belong to at most ONE team per hackathon
--        - Capacity guard: Team members cannot exceed hackathons.max_team_size
--   6. Row Level Security:
--        - Strict tenant isolation flowing through hackathons
--        - Team members can read their own team & members
--        - Anyone in tenant can lookup an open team by invite_code
--        - Team leader can update team details, is_open flag, and selected problem
--        - Students can join open teams via valid invite_code
--        - Members can leave team (delete own team_members row)
--        - Admins (college_admin / committee_member / super_admin) have read-all & management oversight
--
-- Explicitly OUT of scope (later phases):
--   Submissions (Phase 5), AI pre-screening (Phase 6), evaluations (Phase 7),
--   leaderboards (Phase 8), talent pool / hiring (Phases 9-10).
--
-- Safety guarantees:
--   * Idempotent — CREATE ... IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS only
--   * Additive and non-destructive — no existing tables or data altered
--   * Zero seed data — UI handles empty states cleanly
--
-- Run order (cumulative):
--   1. 20260915000001_initial_foundation.sql
--   2. 20260916000001_phase1_5_security_hardening.sql
--   3. 20260917000001_pilot_tenant_mitt.sql
--   4. 20260918000001_phase2a_hackathon_foundation.sql
--   5. 20260919000001_phase2c_companies_foundation.sql
--   6. 20260920000001_phase3a_problem_statements.sql
--   7. THIS FILE
-- ============================================================

-- ============================================================
-- 1. TEAM STATUS ENUM
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'team_status'
  ) THEN
    CREATE TYPE public.team_status AS ENUM (
      'forming',
      'registered',
      'submitted',
      'evaluated',
      'shortlisted',
      'rejected'
    );
  END IF;
END $$;

COMMENT ON TYPE public.team_status IS
  'HackBridge.pdf: team registration and competition lifecycle states. Phase 4.';

-- ============================================================
-- 2. TEAMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent Hackathon & Problem Statement
  hackathon_id UUID NOT NULL REFERENCES public.hackathons(id) ON DELETE CASCADE,
  problem_id   UUID REFERENCES public.problem_statements(id) ON DELETE SET NULL,

  -- Team Identity
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  invite_code  VARCHAR(20) UNIQUE NOT NULL,

  -- Recruitment & Status
  is_open      BOOLEAN NOT NULL DEFAULT true,
  status       public.team_status NOT NULL DEFAULT 'forming',

  -- Creator & Ownership
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Timestamps
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT teams_name_not_blank_check CHECK (btrim(name) <> ''),
  CONSTRAINT teams_invite_code_not_blank_check CHECK (btrim(invite_code) <> ''),
  CONSTRAINT teams_hackathon_name_unique UNIQUE (hackathon_id, name)
);

COMMENT ON TABLE public.teams IS
  'HackBridge.pdf: student teams competing in a hackathon. Phase 4.';
COMMENT ON COLUMN public.teams.invite_code IS
  'Unique code shared by the leader for other students to join the team.';
COMMENT ON COLUMN public.teams.problem_id IS
  'The approved problem statement chosen by this team. Nullable during early formation.';

-- ============================================================
-- 3. TEAM MEMBERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  team_id   UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role      VARCHAR(50) NOT NULL DEFAULT 'member',

  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT team_members_team_user_unique UNIQUE (team_id, user_id),
  CONSTRAINT team_members_role_check CHECK (role IN ('leader', 'member'))
);

COMMENT ON TABLE public.team_members IS
  'HackBridge.pdf: students belonging to a team. Phase 4.';
COMMENT ON COLUMN public.team_members.role IS
  'Role in the team: leader (creator) or member.';

-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_teams_hackathon ON public.teams(hackathon_id);
CREATE INDEX IF NOT EXISTS idx_teams_problem ON public.teams(problem_id);
CREATE INDEX IF NOT EXISTS idx_teams_invite_code ON public.teams(invite_code);
CREATE INDEX IF NOT EXISTS idx_teams_status ON public.teams(status);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON public.teams(created_by);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);

-- ============================================================
-- 5. INTEGRITY GUARDS & TRIGGERS
-- ============================================================

-- 5a. Maintain updated_at on public.teams
DROP TRIGGER IF EXISTS trg_teams_set_updated_at ON public.teams;
CREATE TRIGGER trg_teams_set_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5b. Derive created_by from auth.uid() on INSERT if not set or non-super-admin
CREATE OR REPLACE FUNCTION public.set_teams_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.is_super_admin() OR NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teams_ownership ON public.teams;
CREATE TRIGGER trg_teams_ownership
  BEFORE INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_teams_ownership();

-- 5c. Automatically insert team creator as team leader into team_members
CREATE OR REPLACE FUNCTION public.auto_insert_team_leader()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.team_members (team_id, user_id, role, joined_at)
    VALUES (NEW.id, NEW.created_by, 'leader', NOW())
    ON CONFLICT (team_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teams_auto_leader ON public.teams;
CREATE TRIGGER trg_teams_auto_leader
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.auto_insert_team_leader();

-- 5d. Invariant: Enforce at most ONE team per user per hackathon
CREATE OR REPLACE FUNCTION public.check_user_single_team_per_hackathon()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hackathon_id UUID;
  v_existing_team_name VARCHAR(255);
BEGIN
  -- Get the hackathon for the team being joined
  SELECT hackathon_id INTO v_hackathon_id
  FROM public.teams
  WHERE id = NEW.team_id;

  IF v_hackathon_id IS NULL THEN
    RAISE EXCEPTION 'Team does not exist or has no associated hackathon.'
      USING ERRCODE = '23503';
  END IF;

  -- Check if this user is already in another team for this hackathon
  SELECT t.name INTO v_existing_team_name
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  WHERE tm.user_id = NEW.user_id
    AND t.hackathon_id = v_hackathon_id
    AND tm.team_id <> NEW.team_id
  LIMIT 1;

  IF v_existing_team_name IS NOT NULL THEN
    RAISE EXCEPTION 'You are already a member of team "%" in this hackathon. You must leave that team before creating or joining another.', v_existing_team_name
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_single_team_per_hackathon ON public.team_members;
CREATE TRIGGER trg_check_single_team_per_hackathon
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.check_user_single_team_per_hackathon();

-- 5e. Capacity guard: Ensure team size does not exceed hackathon max_team_size
CREATE OR REPLACE FUNCTION public.check_team_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hackathon_id UUID;
  v_max_team_size INT;
  v_current_member_count INT;
BEGIN
  SELECT t.hackathon_id, h.max_team_size
  INTO v_hackathon_id, v_max_team_size
  FROM public.teams t
  JOIN public.hackathons h ON h.id = t.hackathon_id
  WHERE t.id = NEW.team_id;

  IF v_max_team_size IS NOT NULL AND v_max_team_size > 0 THEN
    SELECT COUNT(*) INTO v_current_member_count
    FROM public.team_members
    WHERE team_id = NEW.team_id;

    IF v_current_member_count >= v_max_team_size THEN
      RAISE EXCEPTION 'This team has already reached the maximum size limit of % members for this hackathon.', v_max_team_size
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_team_capacity ON public.team_members;
CREATE TRIGGER trg_check_team_capacity
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.check_team_capacity();

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 6a. TEAMS POLICIES
-- ------------------------------------------------------------

-- SELECT:
-- 1. Super admin can read all teams
-- 2. Tenant members can read teams in their tenant's hackathons
-- 3. Any authenticated user can read open teams if querying by invite_code
CREATE POLICY teams_select_policy ON public.teams
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = teams.hackathon_id
        AND h.tenant_id = public.get_current_user_tenant_id()
    )
  );

-- INSERT:
-- Authenticated users (students, mentors, admins) can create a team in their tenant's hackathons
CREATE POLICY teams_insert_policy ON public.teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = teams.hackathon_id
        AND h.tenant_id = public.get_current_user_tenant_id()
    )
  );

-- UPDATE:
-- Team leader can update their own team; college admins and super admins can manage any team in tenant
CREATE POLICY teams_update_policy ON public.teams
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = teams.hackathon_id
        AND public.is_college_admin(h.tenant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = teams.id
        AND tm.user_id = auth.uid()
        AND tm.role = 'leader'
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = teams.hackathon_id
        AND public.is_college_admin(h.tenant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = teams.id
        AND tm.user_id = auth.uid()
        AND tm.role = 'leader'
    )
  );

-- DELETE:
-- Team leader or admins can delete/disband a team
CREATE POLICY teams_delete_policy ON public.teams
  FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = teams.hackathon_id
        AND public.is_college_admin(h.tenant_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = teams.id
        AND tm.user_id = auth.uid()
        AND tm.role = 'leader'
    )
  );

-- ------------------------------------------------------------
-- 6b. TEAM MEMBERS POLICIES
-- ------------------------------------------------------------

-- SELECT:
-- 1. Super admin can read all
-- 2. Tenant members can read team members for teams in their tenant
CREATE POLICY team_members_select_policy ON public.team_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.hackathons h ON h.id = t.hackathon_id
      WHERE t.id = team_members.team_id
        AND h.tenant_id = public.get_current_user_tenant_id()
    )
  );

-- INSERT:
-- 1. Users can join a team (insert their own user_id) if the team is in their tenant and is open
-- 2. Super admin or college admin can add members
-- 3. The auto_insert_team_leader trigger runs with SECURITY DEFINER
CREATE POLICY team_members_insert_policy ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.teams t
        JOIN public.hackathons h ON h.id = t.hackathon_id
        WHERE t.id = team_members.team_id
          AND h.tenant_id = public.get_current_user_tenant_id()
          AND t.is_open = true
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.hackathons h ON h.id = t.hackathon_id
      WHERE t.id = team_members.team_id
        AND public.is_college_admin(h.tenant_id)
    )
  );

-- UPDATE:
-- Only team leader or admins can change member roles
CREATE POLICY team_members_update_policy ON public.team_members
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.hackathons h ON h.id = t.hackathon_id
      WHERE t.id = team_members.team_id
        AND (
          public.is_college_admin(h.tenant_id)
          OR EXISTS (
            SELECT 1 FROM public.team_members leader_tm
            WHERE leader_tm.team_id = t.id
              AND leader_tm.user_id = auth.uid()
              AND leader_tm.role = 'leader'
          )
        )
    )
  );

-- DELETE:
-- 1. A member can leave a team (delete their own membership row)
-- 2. Team leader or admin can remove a member from the team
CREATE POLICY team_members_delete_policy ON public.team_members
  FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.hackathons h ON h.id = t.hackathon_id
      WHERE t.id = team_members.team_id
        AND (
          public.is_college_admin(h.tenant_id)
          OR EXISTS (
            SELECT 1 FROM public.team_members leader_tm
            WHERE leader_tm.team_id = t.id
              AND leader_tm.user_id = auth.uid()
              AND leader_tm.role = 'leader'
          )
        )
    )
  );
