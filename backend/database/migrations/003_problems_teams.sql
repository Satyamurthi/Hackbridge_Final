-- Migration 003: Problem Statements, Teams, and Team Members
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
