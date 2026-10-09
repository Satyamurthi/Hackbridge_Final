-- ============================================================================
-- HackBridge Portable Relational Database Schema
-- Compatible with: PostgreSQL 14+, Managed Postgres (AWS RDS, GCP Cloud SQL, Supabase, Neon),
-- and convertible to MySQL 8+ / Microsoft SQL Server.
-- ============================================================================

-- Extensions (Portable: If running on standard Postgres, pgcrypto provides gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. INSTITUTION TENANTS (Multi-Tenant White-Label Core)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    custom_domain VARCHAR(255) UNIQUE,
    subdomain VARCHAR(64) UNIQUE,
    primary_color VARCHAR(16) DEFAULT '#4F46E5',
    secondary_color VARCHAR(16) DEFAULT '#7C3AED',
    logo_url TEXT,
    plan VARCHAR(32) DEFAULT 'enterprise',
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(custom_domain);

-- ============================================================================
-- 2. USERS & PROFILES (Server-side Role-Based Access Control)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(32) NOT NULL DEFAULT 'student' CHECK (role IN (
        'super_admin', 'college_admin', 'committee_member',
        'evaluator', 'company_rep', 'student', 'mentor'
    )),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(32),
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);

-- ============================================================================
-- 3. HACKATHONS (Event Lifecycle State Machine)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hackathons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(128) NOT NULL,
    tagline TEXT,
    description TEXT,
    banner_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'problem_intake', 'registration', 'hacking',
        'evaluation', 'completed', 'archived'
    )),
    registration_start TIMESTAMPTZ NOT NULL,
    registration_end TIMESTAMPTZ NOT NULL,
    hacking_start TIMESTAMPTZ NOT NULL,
    hacking_end TIMESTAMPTZ NOT NULL,
    evaluation_start TIMESTAMPTZ NOT NULL,
    evaluation_end TIMESTAMPTZ NOT NULL,
    results_announced_at TIMESTAMPTZ,
    min_team_size INT DEFAULT 2,
    max_team_size INT DEFAULT 4,
    max_teams INT,
    rules TEXT,
    evaluation_rubric JSONB DEFAULT '[]'::jsonb,
    tracks JSONB DEFAULT '[]'::jsonb,
    prizes JSONB DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_hackathons_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_hackathons_tenant_status ON hackathons(tenant_id, status);

-- ============================================================================
-- 4. INDUSTRY PARTNER COMPANIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(128) NOT NULL,
    industry VARCHAR(128),
    website TEXT,
    logo_url TEXT,
    description TEXT,
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_companies_tenant_slug UNIQUE (tenant_id, slug)
);

-- ============================================================================
-- 5. PROBLEM STATEMENTS (Challenge Intake & Review)
-- ============================================================================
CREATE TABLE IF NOT EXISTS problem_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(128) NOT NULL,
    description TEXT NOT NULL,
    track VARCHAR(128),
    difficulty VARCHAR(16) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    dataset_url TEXT,
    submission_guidelines TEXT,
    max_teams INT,
    status VARCHAR(32) DEFAULT 'submitted' CHECK (status IN (
        'submitted', 'under_review', 'approved', 'rejected', 'published'
    )),
    review_notes TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_problems_hackathon_slug UNIQUE (hackathon_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_problems_hackathon_status ON problem_statements(hackathon_id, status);

-- ============================================================================
-- 6. STUDENT TEAMS & MEMBERSHIP (With Invite Codes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    invite_code VARCHAR(16) NOT NULL,
    problem_id UUID REFERENCES problem_statements(id) ON DELETE SET NULL,
    status VARCHAR(32) DEFAULT 'forming' CHECK (status IN ('forming', 'ready', 'submitted', 'disqualified')),
    is_open BOOLEAN DEFAULT true,
    max_members INT DEFAULT 4,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_teams_hackathon_name UNIQUE (hackathon_id, name),
    CONSTRAINT uq_teams_hackathon_invite UNIQUE (hackathon_id, invite_code)
);

CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(16) DEFAULT 'member' CHECK (role IN ('leader', 'member')),
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ============================================================================
-- 7. MULTI-FORMAT SUBMISSIONS (With AI Readiness Triage & Locking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    problem_id UUID REFERENCES problem_statements(id) ON DELETE SET NULL,
    submission_round INT DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    abstract TEXT NOT NULL,
    approach TEXT NOT NULL,
    repo_url TEXT,
    demo_url TEXT,
    presentation_url TEXT,
    video_url TEXT,
    tech_stack JSONB DEFAULT '[]'::jsonb,
    is_locked BOOLEAN DEFAULT false,
    lock_timestamp TIMESTAMPTZ,
    submitted_by UUID NOT NULL REFERENCES users(id),
    ai_flags JSONB DEFAULT '[]'::jsonb,
    ai_readiness_score INT DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_edited_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_submissions_team_round UNIQUE (team_id, submission_round)
);

CREATE INDEX IF NOT EXISTS idx_submissions_hackathon_round ON submissions(hackathon_id, submission_round);

-- ============================================================================
-- 8. DOUBLE-BLIND EVALUATION & RUBRIC SCORING
-- ============================================================================
CREATE TABLE IF NOT EXISTS evaluation_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hackathon_id UUID NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    round INT DEFAULT 1,
    status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'recused')),
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    conflict_of_interest BOOLEAN DEFAULT false,
    CONSTRAINT uq_eval_assignment UNIQUE (hackathon_id, evaluator_id, submission_id, round)
);

CREATE TABLE IF NOT EXISTS evaluation_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID UNIQUE NOT NULL REFERENCES evaluation_assignments(id) ON DELETE CASCADE,
    scores JSONB NOT NULL,
    total_score NUMERIC(5, 2) NOT NULL,
    normalized_score NUMERIC(5, 2),
    strengths TEXT,
    weaknesses TEXT,
    recommendation VARCHAR(32) NOT NULL CHECK (recommendation IN ('advance', 'shortlist', 'reject', 'borderline')),
    private_notes TEXT,
    is_locked BOOLEAN DEFAULT true,
    scored_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submission_scores_aggregate (
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    round INT DEFAULT 1,
    average_score NUMERIC(5, 2) DEFAULT 0,
    normalized_average NUMERIC(5, 2) DEFAULT 0,
    evaluator_count INT DEFAULT 0,
    score_variance NUMERIC(6, 3) DEFAULT 0,
    final_decision VARCHAR(32) CHECK (final_decision IN (
        'winner', 'runner_up', 'second_runner_up', 'top_10',
        'honorable_mention', 'shortlisted', 'participated'
    )),
    decided_at TIMESTAMPTZ,
    decided_by UUID REFERENCES users(id),
    PRIMARY KEY (submission_id, round)
);

-- ============================================================================
-- 9. STUDENT TALENT PROFILES & VERIFIED CREDENTIALS
-- ============================================================================
CREATE TABLE IF NOT EXISTS talent_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    headline VARCHAR(255),
    bio TEXT,
    skills JSONB DEFAULT '[]'::jsonb,
    github_url TEXT,
    linkedin_url TEXT,
    portfolio_url TEXT,
    resume_url TEXT,
    achievements JSONB DEFAULT '[]'::jsonb,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 10. INDUSTRY RECRUITER OUTREACH PIPELINE
-- ============================================================================
CREATE TABLE IF NOT EXISTS hiring_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_title VARCHAR(128) NOT NULL,
    compensation_range VARCHAR(64),
    interest_type VARCHAR(32) NOT NULL CHECK (interest_type IN (
        'interview_requested', 'offer_extended', 'general_inquiry', 'rejected'
    )),
    message TEXT,
    status VARCHAR(32) DEFAULT 'pending' CHECK (status IN (
        'pending', 'contacted', 'interviewing', 'offered', 'accepted', 'declined'
    )),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 11. IMMUTABLE AUDIT LOGS & NOTIFICATION CENTER
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(128),
    payload JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(32) NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
