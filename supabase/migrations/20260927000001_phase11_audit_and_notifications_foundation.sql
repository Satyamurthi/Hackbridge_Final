-- ============================================================
-- HACKBRIDGE PHASE 11 — PERSISTENT AUDIT LOGGING & NOTIFICATION CENTER
-- Migration: 20260927000001_phase11_audit_and_notifications_foundation.sql
--
-- Source of truth: HackBridge.pdf
--   * section "2. Database Schema" -> "AUDIT & NOTIFICATIONS"
--   * section "4.1 Super Admin & College Admin" -> audit trail for compliance
--   * section "4. Stakeholder Dashboards" -> in-app alerts and notifications
--
-- Scope (Phase 11):
--   1. public.audit_logs table:
--        - Immutable system ledger recording administrative, lifecycle, and security events.
--        - Tracks tenant_id, actor_id, action, target_type, target_id, details (JSONB), and ip_address.
--        - Immutability trigger: refuses any UPDATE or DELETE to maintain evidentiary integrity.
--   2. public.notifications table:
--        - In-app notification center for all 7 stakeholder roles.
--        - Tracks user_id, tenant_id, title, message, type, link, is_read, read_at.
--   3. Row Level Security:
--        - Audit logs readable only by college_admin, committee_member, and super_admin.
--        - Notifications readable and updatable (mark as read) only by owning user.
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
--  12. 20260926000001_phase10_hiring_pipeline_foundation.sql
--  13. THIS FILE
-- ============================================================

-- ============================================================
-- 1. AUDIT LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  action              TEXT NOT NULL,
  target_type         TEXT NOT NULL,
  target_id           TEXT,
  details             JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address          TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_logs IS
  'HackBridge.pdf: Immutable administrative audit trail for security compliance and institutional oversight. Phase 11.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant
  ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON public.audit_logs(created_at DESC);

-- Immutability trigger: Block any updates or deletes to audit logs
CREATE OR REPLACE FUNCTION public.enforce_audit_log_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log rows are strictly immutable and cannot be updated or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_audit_log_immutability();

-- ============================================================
-- 2. NOTIFICATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  title               TEXT NOT NULL,
  message             TEXT NOT NULL,
  type                VARCHAR(50) NOT NULL CHECK (
    type IN ('team_invite', 'submission_confirmed', 'evaluation_assigned', 'awards_announced', 'hiring_interest', 'general')
  ),
  link                TEXT,
  is_read             BOOLEAN NOT NULL DEFAULT false,
  read_at             TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notifications IS
  'HackBridge.pdf: In-app notification center for all stakeholder roles. Phase 11.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read
  ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON public.notifications(created_at DESC);

-- ============================================================
-- 3. ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Audit Logs: College admins & super admins can read tenant logs
DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_read"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    (tenant_id = public.get_current_user_tenant_id() AND
     public.get_current_user_role() IN ('college_admin', 'committee_member'))
    OR public.is_super_admin()
  );

-- Audit Logs: Authenticated users can insert audit events for their tenant
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_current_user_tenant_id() OR
    public.is_super_admin()
  );

-- Notifications: Users can read their own notifications
DROP POLICY IF EXISTS "notifications_self_read" ON public.notifications;
CREATE POLICY "notifications_self_read"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Notifications: Users can update their own notifications (mark read)
DROP POLICY IF EXISTS "notifications_self_update" ON public.notifications;
CREATE POLICY "notifications_self_update"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Notifications: Authenticated users/system can insert notifications
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.get_current_user_tenant_id() OR
    public.is_super_admin()
  );
