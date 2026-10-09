-- Migration 002: Hackathons and Companies
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
