-- ============================================================
-- HACKBRIDGE PILOT TENANT RENAME — RVCE -> MITT (DATA ONLY)
-- Migration: 20260917000001_pilot_tenant_mitt.sql
--
-- Scope:
--   * Renames the existing pilot tenant row IN PLACE (UPDATE only).
--   * The row UUID is never written, so profiles.tenant_id,
--     tenant_memberships.tenant_id and all UUID-based RLS policies
--     keep working unchanged. No second tenant is created and no
--     tenant is deleted or recreated.
--   * No table, column, policy, function, trigger or type is touched.
--   * custom_domain is cleared to NULL (MITT uses the
--     mitt.hackbridge.in subdomain only).
--   * No college-email domain is invented: allowed_email_domains is
--     set to an empty array and require_college_email stays TRUE, so a
--     client-supplied tenant claim is still rejected (fail closed) and
--     the pilot tenant is resolved server-side by slug.
--   * plan, limits, colours and logo_url are left untouched.
--
-- Safety:
--   * Idempotent — re-running is a no-op once renamed.
--   * Non-destructive — no INSERT / DELETE / DROP / TRUNCATE.
--   * Aborts without writing if the database is ambiguous (both rvce
--     and mitt rows present, or duplicated rvce rows).
--   * Committed but NOT executed automatically. Run it manually in the
--     Supabase SQL Editor after 20260915000001_initial_foundation.sql
--     and 20260916000001_phase1_5_security_hardening.sql.
-- ============================================================

DO $$
DECLARE
  rvce_rows INT;
  mitt_rows INT;
  target_id UUID;
BEGIN
  SELECT count(*) INTO rvce_rows FROM public.tenants WHERE slug = 'rvce';
  SELECT count(*) INTO mitt_rows FROM public.tenants WHERE slug = 'mitt';

  -- Already renamed (idempotent re-run).
  IF rvce_rows = 0 AND mitt_rows = 1 THEN
    RAISE NOTICE 'Pilot tenant is already MITT (slug=mitt). Nothing to do.';
    RETURN;
  END IF;

  -- Fresh deployment seeded directly as MITT, or no pilot row at all.
  IF rvce_rows = 0 AND mitt_rows = 0 THEN
    RAISE NOTICE 'No pilot tenant row found (neither rvce nor mitt). Nothing to do.';
    RETURN;
  END IF;

  -- Precondition: refuse to guess if both exist.
  IF rvce_rows > 0 AND mitt_rows > 0 THEN
    RAISE EXCEPTION 'Both rvce and mitt tenants exist — resolve manually; nothing was changed.';
  END IF;

  -- Precondition: exactly one rvce row.
  IF rvce_rows <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one rvce tenant row, found %. Nothing was changed.', rvce_rows;
  END IF;

  SELECT id INTO target_id FROM public.tenants WHERE slug = 'rvce';

  UPDATE public.tenants
     SET slug          = 'mitt',
         name          = 'Maharaja Institute of Technology Thandavapura',
         subdomain     = 'mitt.hackbridge.in',
         custom_domain = NULL,
         settings      = settings
                         || jsonb_build_object('institution_code', 'MITT')
                         || jsonb_build_object('location', 'Thandavapura, Mandya, Karnataka')
                         || jsonb_build_object('allowed_email_domains', '[]'::jsonb),
         updated_at    = NOW()
   WHERE id = target_id;

  -- Post-condition: raises -> the whole transaction rolls back.
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = target_id AND slug = 'mitt') THEN
    RAISE EXCEPTION 'Pilot tenant rename verification failed; transaction rolled back.';
  END IF;

  RAISE NOTICE 'Pilot tenant % renamed: slug=mitt, name/subdomain/settings updated, custom_domain NULL.',
    target_id;
END $$;
