-- ============================================================
-- HACKBRIDGE DATABASE FOUNDATION MIGRATION
-- Multi-Tenant White-Label Schema with Row Level Security (RLS)
-- Roles: super_admin, college_admin, committee_member, evaluator, company_rep, student, mentor
-- ============================================================

-- Enable pgcrypto / gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ROLES ENUM
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'college_admin',
    'committee_member',
    'evaluator',
    'company_rep',
    'student',
    'mentor'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. TENANTS TABLE (Each tenant is an engineering college / institution)
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,                       -- e.g. 'mitt', 'pesit', 'bmsce'
  name VARCHAR(255) NOT NULL,                              -- e.g. 'Maharaja Institute of Technology Thandavapura'
  custom_domain VARCHAR(255) UNIQUE,                       -- e.g. 'hackathon.example.edu.in' (NULL when none)
  subdomain VARCHAR(100) UNIQUE,                           -- e.g. 'mitt.hackbridge.in'
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#4F46E5',              -- Default Indigo
  secondary_color VARCHAR(7) DEFAULT '#7C3AED',            -- Default Violet
  plan VARCHAR(50) DEFAULT 'starter',                      -- 'starter', 'pro', 'enterprise'
  plan_expires_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{
    "max_hackathons": 1,
    "max_participants": 200,
    "allowed_modules": ["teams", "submissions", "evaluations"],
    "require_college_email": true
  }'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for tenant lookup
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON public.tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON public.tenants(custom_domain);

-- 3. PROFILES TABLE (Mirrors and extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,
  role public.user_role NOT NULL DEFAULT 'student',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  -- For students: { usn, department, year, resume_url, skills, linkedin }
  -- For company_rep: { company_id, company_name, designation }
  -- For evaluator: { expertise, affiliation }
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_role ON public.profiles(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 4. TENANT MEMBERSHIPS TABLE (Enables future multi-college/multi-tenant associations)
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user ON public.tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant ON public.tenant_memberships(tenant_id);

-- ============================================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================

-- Get current caller's primary role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Get current caller's tenant ID
CREATE OR REPLACE FUNCTION public.get_current_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Check if caller is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Check if caller is college_admin for a given tenant
CREATE OR REPLACE FUNCTION public.is_college_admin(target_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND role IN ('super_admin', 'college_admin')
      AND (role = 'super_admin' OR tenant_id = target_tenant_id)
  );
$$;

-- ============================================================
-- AUTH SYNC TRIGGER
-- Automatically creates a public.profiles and tenant_memberships row
-- when a new user is created in auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role public.user_role;
  parsed_tenant_id UUID;
  user_full_name TEXT;
BEGIN
  -- Extract values from user_metadata if provided
  user_full_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  
  -- Role extraction with fallback
  BEGIN
    assigned_role := (new.raw_user_meta_data->>'role')::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    assigned_role := 'student'::public.user_role;
  END;

  -- Tenant ID extraction
  BEGIN
    parsed_tenant_id := (new.raw_user_meta_data->>'tenant_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    parsed_tenant_id := NULL;
  END;

  -- Default to the pilot institution (MITT) tenant if none specified
  IF parsed_tenant_id IS NULL THEN
    SELECT id INTO parsed_tenant_id FROM public.tenants WHERE slug = 'mitt' LIMIT 1;
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, tenant_id, email, full_name, role, metadata)
  VALUES (
    new.id,
    parsed_tenant_id,
    new.email,
    user_full_name,
    assigned_role,
    COALESCE(new.raw_user_meta_data, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

  -- Insert tenant membership if tenant exists
  IF parsed_tenant_id IS NOT NULL THEN
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
    VALUES (parsed_tenant_id, new.id, assigned_role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
      role = EXCLUDED.role;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

-- Tenants Policies:
DROP POLICY IF EXISTS "Public can view active tenants" ON public.tenants;
CREATE POLICY "Public can view active tenants"
  ON public.tenants
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Super admins can manage tenants" ON public.tenants;
CREATE POLICY "Super admins can manage tenants"
  ON public.tenants
  FOR ALL
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "College admins can update their own tenant" ON public.tenants;
CREATE POLICY "College admins can update their own tenant"
  ON public.tenants
  FOR UPDATE
  USING (public.is_college_admin(id))
  WITH CHECK (public.is_college_admin(id));

-- Profiles Policies:
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view peer profiles in same tenant" ON public.profiles;
CREATE POLICY "Users can view peer profiles in same tenant"
  ON public.profiles
  FOR SELECT
  USING (
    tenant_id IS NOT NULL AND tenant_id = public.get_current_user_tenant_id()
  );

DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_super_admin());

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
  USING (public.is_college_admin(tenant_id));

-- Tenant Memberships Policies:
DROP POLICY IF EXISTS "Users can view own tenant memberships" ON public.tenant_memberships;
CREATE POLICY "Users can view own tenant memberships"
  ON public.tenant_memberships
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view memberships for their tenant" ON public.tenant_memberships;
CREATE POLICY "Admins can view memberships for their tenant"
  ON public.tenant_memberships
  FOR SELECT
  USING (public.is_college_admin(tenant_id));

DROP POLICY IF EXISTS "Admins can manage memberships for their tenant" ON public.tenant_memberships;
CREATE POLICY "Admins can manage memberships for their tenant"
  ON public.tenant_memberships
  FOR ALL
  USING (public.is_college_admin(tenant_id));

-- ============================================================
-- SEED DATA: PILOT INSTITUTION (MAHARAJA INSTITUTE OF TECHNOLOGY THANDAVAPURA)
-- ============================================================
INSERT INTO public.tenants (
  slug,
  name,
  custom_domain,
  subdomain,
  logo_url,
  primary_color,
  secondary_color,
  plan,
  settings,
  is_active
) VALUES (
  'mitt',
  'Maharaja Institute of Technology Thandavapura',
  NULL,
  'mitt.hackbridge.in',
  'https://images.unsplash.com/photo-1562774053-701939374585?w=200&auto=format&fit=crop&q=80',
  '#4F46E5', -- Indigo
  '#7C3AED', -- Violet
  'enterprise',
  '{
    "institution_code": "MITT",
    "location": "Thandavapura, Mandya, Karnataka",
    "max_hackathons": 10,
    "max_participants": 2000,
    "allowed_modules": ["teams", "submissions", "evaluations", "talent_pool"],
    "require_college_email": true,
    "allowed_email_domains": []
  }'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  settings = EXCLUDED.settings;
