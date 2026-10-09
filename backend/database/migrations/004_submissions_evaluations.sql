-- Migration 004: Submissions and Double-Blind Rubric Evaluations
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
