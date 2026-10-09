-- ============================================================================
-- Canonical Parameterized SQL Queries (Isolated Database Layer)
-- ============================================================================

-- 1. AUTH & TENANT RESOLUTION
-- Find User by Email
SELECT id, email, password_hash, role, tenant_id, full_name, is_active FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;

-- Resolve Tenant by Custom Domain or Slug
SELECT * FROM tenants WHERE (custom_domain = $1 OR slug = $1) AND is_active = true LIMIT 1;

-- 2. HACKATHON WORKFLOWS
-- List Tenant Hackathons
SELECT * FROM hackathons WHERE tenant_id = $1 ORDER BY created_at DESC;

-- Advance Lifecycle State
UPDATE hackathons SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *;

-- 3. CONCURRENCY-SAFE TEAM FORMATION
-- Join Team Under Concurrency Lock
SELECT * FROM teams WHERE hackathon_id = $1 AND UPPER(invite_code) = UPPER($2) FOR UPDATE;

-- Add Member Under Lock
INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES ($1, $2, 'member', NOW());

-- 4. MULTI-FORMAT SUBMISSIONS & IMMUTABLE LOCKING
-- Upsert Submission Draft
INSERT INTO submissions (id, hackathon_id, team_id, problem_id, submission_round, title, abstract, approach, repo_url, demo_url, tech_stack, is_locked, submitted_by, created_at, last_edited_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, $12, NOW(), NOW())
ON CONFLICT (team_id, submission_round)
DO UPDATE SET title = EXCLUDED.title, abstract = EXCLUDED.abstract, approach = EXCLUDED.approach, repo_url = EXCLUDED.repo_url, demo_url = EXCLUDED.demo_url, tech_stack = EXCLUDED.tech_stack, last_edited_at = NOW();

-- Final Lock Immutability
UPDATE submissions SET is_locked = true, lock_timestamp = NOW(), last_edited_at = NOW() WHERE id = $1 AND is_locked = false RETURNING *;

-- 5. DOUBLE-BLIND EVALUATION & SCORING
-- Fetch Masked Submissions for Assigned Evaluator
SELECT ea.*, s.title, s.abstract, s.approach, s.repo_url, s.demo_url, s.tech_stack
FROM evaluation_assignments ea
JOIN submissions s ON s.id = ea.submission_id
WHERE ea.evaluator_id = $1 AND ea.hackathon_id = $2;

-- Submit Rubric Score & Lock
INSERT INTO evaluation_scores (id, assignment_id, scores, total_score, strengths, weaknesses, recommendation, private_notes, is_locked, scored_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW());

-- 6. DYNAMIC LEADERBOARD RANKING
SELECT
    s.hackathon_id,
    s.id as submission_id,
    t.name as team_name,
    s.title as submission_title,
    COALESCE(ssa.average_score, 0) as average_score,
    COALESCE(ssa.evaluator_count, 0) as evaluator_count,
    ssa.final_decision,
    DENSE_RANK() OVER (ORDER BY COALESCE(ssa.average_score, 0) DESC) as rank_overall
FROM submissions s
JOIN teams t ON t.id = s.team_id
LEFT JOIN submission_scores_aggregate ssa ON ssa.submission_id = s.id
WHERE s.hackathon_id = $1
ORDER BY average_score DESC;
