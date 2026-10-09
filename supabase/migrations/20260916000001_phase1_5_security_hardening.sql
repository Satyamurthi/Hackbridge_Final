-- ============================================================
-- HACKBRIDGE PHASE 1.5 — SECURITY + FOUNDATION HARDENING
-- Migration: 20260916000001_phase1_5_security_hardening.sql
--
-- Scope (Phase 1.5 hardening only — no Phase 2 objects):
--   1. Block profile privilege escalation on public.profiles
--      (self-promotion, self tenant-hopping, self activate/deactivate)
--      with a database-side guard that runs on every INSERT / UPDATE.
--   2. Restrict self-service signup to non-privileged roles and resolve
--      the tenant server-side, so a client can no longer choose its own
--      role and can never inject an invalid / non-existent tenant UUID.
--   3. Restate the existing profile RLS policies with explicit WITH CHECK
--      clauses (identical to, or stricter than, the previous behaviour).
--
-- Safety guarantees:
--   * Idempotent — only CREATE OR REPLACE / CREATE IF NOT EXISTS /
--     DROP ... IF EXISTS are used, so re-running is harmless.
--   * Additive — no table, column, policy or row is dropped, renamed or
--     deleted; no data is reset and the existing tenants row is untouched.
--   * No Phase 2 scope — no hackathons, companies, teams, submissions,
--     evaluations, talent pool, storage buckets or background jobs.
--
-- This file is committed but NOT executed automatically. Run it manually
-- in the Supabase SQL Editor after 20260915000001_initial_foundation.sql.
-- ============================================================

-- ============================================================
-- 1. PROFILE FIELD PROTECTION (privilege-escalation guard)
-- ============================================================
-- RLS can compare the new row against the caller, but it cannot compare the
-- new row against the stored row. The previous "Users can update own profile"
-- policy therefore still allowed a user to rewrite their own role,
-- tenant_id or is_active. This trigger compares NEW against OLD and rejects
-- all protected-attribute changes.

CREATE OR REPLACE FUNCTION public.enforce_profile_field_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
BEGIN
  -- Service-role / internal contexts (the auth sync trigger, or maintenance
  -- run by the table owner) have no JWT and are already governed by RLS and
  -- table ownership rules, so they are not constrained by this guard.
  IF caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Platform super admins retain unrestricted administrative access.
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- ---- INSERT: profile provisioning ----
  -- Only administrators may create profile rows, and only a super admin may
  -- create another super_admin (prevents a tenant admin minting a platform
  -- super admin inside their own tenant).
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS NOT DISTINCT FROM 'super_admin'::public.user_role THEN
      RAISE EXCEPTION 'Only a platform super admin can create a super_admin profile'
        USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_college_admin(NEW.tenant_id) THEN
      RAISE EXCEPTION 'Not authorised to create a profile for this tenant'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- ---- UPDATE of the caller's own profile ----
  -- Self-service editing stays available for full_name, phone, avatar_url,
  -- metadata, last_login_at and updated_at. Identity / authorisation columns
  -- must be untouched.
  IF caller = OLD.id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'You cannot change your own role, tenant, active status, email or identity fields'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- ---- UPDATE of another profile ----
  -- Same-tenant college admins keep full management of their own tenant's
  -- profiles, but a profile may never be moved out of (or into) another
  -- tenant by a non-super-admin.
  IF public.is_college_admin(OLD.tenant_id)
     AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not authorised to modify this profile' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_field_protection ON public.profiles;
CREATE TRIGGER trg_profiles_field_protection
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_field_protection();

-- ============================================================
-- 2. RLS RESTATEMENT (explicit WITH CHECK — no relaxation)
-- ============================================================
-- Behaviour is deliberately unchanged for legitimate use:
--   * a user may still update ONLY their own row (auth.uid() = id),
--   * college admins / super admins may still manage profiles in the
--     tenants they administer,
--   * tenant isolation is unchanged.
-- The WITH CHECK clauses are made explicit so the write-side rule can never
-- fall back to an implicit default and so the intent stays auditable.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "College admins can manage profiles in their tenant" ON public.profiles;
CREATE POLICY "College admins can manage profiles in their tenant"
  ON public.profiles
  FOR ALL
  USING (public.is_college_admin(tenant_id))
  WITH CHECK (public.is_college_admin(tenant_id));

-- ============================================================
-- 3. SERVER-SIDE ROLE + TENANT RESOLUTION ON SIGNUP
-- ============================================================
-- Previously the signup trigger trusted raw_user_meta_data completely:
--   * `role` was cast straight from client metadata, so anyone could register
--     as super_admin / college_admin by calling the auth endpoint directly;
--   * `tenant_id` was taken from client metadata, so a foreign or non-existent
--     UUID could be written into profiles (and an invalid UUID made the whole
--     signup fail with an opaque foreign-key error).
-- The trigger now validates every client-supplied value against the database
-- and never invents an identifier.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role public.user_role;
  parsed_tenant_id UUID;
  requested_tenant_id UUID;
  requested_role TEXT;
  email_domain TEXT;
  tenant_requires_college_email BOOLEAN;
  tenant_allows_domain BOOLEAN;
  user_full_name TEXT;
BEGIN
  -- Extract values from user_metadata if provided
  user_full_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  -- 3a. Self-service roles only. Privileged roles (super_admin, college_admin,
  --     committee_member) are granted afterwards by an administrator.
  requested_role := lower(COALESCE(new.raw_user_meta_data->>'role', 'student'));
  IF requested_role IN ('student', 'company_rep', 'evaluator', 'mentor') THEN
    assigned_role := requested_role::public.user_role;
  ELSE
    assigned_role := 'student'::public.user_role;
  END IF;

  email_domain := lower(split_part(COALESCE(new.email, ''), '@', 2));

  -- 3b. A client-supplied tenant_id is honoured only when it matches an active
  --     tenant row AND that tenant's email-domain policy is satisfied.
  --     An unknown, inactive or malformed UUID is simply ignored.
  BEGIN
    requested_tenant_id := (new.raw_user_meta_data->>'tenant_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    requested_tenant_id := NULL;
  END;

  IF requested_tenant_id IS NOT NULL THEN
    SELECT
      (t.settings->>'require_college_email')::BOOLEAN,
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(t.settings->'allowed_email_domains', '[]'::jsonb)) AS allowed(domain)
        WHERE lower(allowed.domain) = email_domain
      )
    INTO tenant_requires_college_email, tenant_allows_domain
    FROM public.tenants AS t
    WHERE t.id = requested_tenant_id
      AND t.is_active = TRUE
      AND (t.settings->'allowed_email_domains' IS NULL OR jsonb_typeof(t.settings->'allowed_email_domains') = 'array')
    LIMIT 1;

    IF FOUND THEN
      IF COALESCE(tenant_requires_college_email, FALSE) = TRUE
         AND COALESCE(tenant_allows_domain, FALSE) = FALSE THEN
        -- This college requires a college email address, so the registration
        -- may not self-enrol into it.
        parsed_tenant_id := NULL;
      ELSE
        parsed_tenant_id := requested_tenant_id;
      END IF;
    END IF;
  END IF;

  -- 3c. Otherwise resolve the tenant from the verified email domain.
  IF parsed_tenant_id IS NULL AND email_domain <> '' THEN
    SELECT t.id INTO parsed_tenant_id
    FROM public.tenants AS t
    WHERE t.is_active = TRUE
      AND jsonb_typeof(t.settings->'allowed_email_domains') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(t.settings->'allowed_email_domains') AS allowed(domain)
        WHERE lower(allowed.domain) = email_domain
      )
    ORDER BY t.created_at
    LIMIT 1;
  END IF;

  -- 3d. Final fallback: the pilot tenant, resolved from the database by slug.
  --     Never a hardcoded UUID.
  IF parsed_tenant_id IS NULL THEN
    SELECT t.id INTO parsed_tenant_id
    FROM public.tenants AS t
    WHERE t.slug = 'mitt' AND t.is_active = TRUE
    LIMIT 1;
  END IF;

  -- Insert profile. Role and tenant are server-resolved; the raw role and
  -- tenant_id claims are stripped from the stored metadata mirror so they can
  -- never be mistaken for authoritative values.
  INSERT INTO public.profiles (id, tenant_id, email, full_name, role, metadata)
  VALUES (
    new.id,
    parsed_tenant_id,
    new.email,
    user_full_name,
    assigned_role,
    COALESCE(new.raw_user_meta_data, '{}'::jsonb) - 'role' - 'tenant_id'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

  -- Insert tenant membership if a tenant was resolved.
  IF parsed_tenant_id IS NOT NULL THEN
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
    VALUES (parsed_tenant_id, new.id, assigned_role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
      role = EXCLUDED.role;
  END IF;

  RETURN new;
END;
$$;

-- Keep the auth sync trigger wired to the hardened function.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- END OF PHASE 1.5 HARDENING MIGRATION
-- ============================================================