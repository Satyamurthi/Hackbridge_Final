"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TalentRepository = exports.LeaderboardRepository = void 0;
class LeaderboardRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async getLeaderboard(hackathonId, round = 1) {
        const sql = `
      SELECT
        s.hackathon_id,
        s.id as submission_id,
        t.id as team_id,
        t.name as team_name,
        s.title as submission_title,
        ssa.round,
        COALESCE(ssa.average_score, 0) as average_score,
        COALESCE(ssa.evaluator_count, 0) as evaluator_count,
        ssa.final_decision,
        s.repo_url,
        s.demo_url,
        ps.title as problem_title,
        DENSE_RANK() OVER (ORDER BY COALESCE(ssa.average_score, 0) DESC) as rank_overall
      FROM submissions s
      JOIN teams t ON t.id = s.team_id
      LEFT JOIN submission_scores_aggregate ssa ON ssa.submission_id = s.id AND ssa.round = $2
      LEFT JOIN problem_statements ps ON ps.id = s.problem_id
      WHERE s.hackathon_id = $1
      ORDER BY average_score DESC, s.created_at ASC
    `;
        const res = await this.db.query(sql, [hackathonId, round]);
        return res.rows.map((r) => ({
            hackathon_id: r.hackathon_id,
            submission_id: r.submission_id,
            team_id: r.team_id,
            team_name: r.team_name,
            submission_title: r.submission_title,
            round: r.round || round,
            average_score: Number(r.average_score) || 0,
            evaluator_count: Number(r.evaluator_count) || 0,
            rank_overall: Number(r.rank_overall) || 1,
            final_decision: r.final_decision,
            repo_url: r.repo_url,
            demo_url: r.demo_url,
            problem_title: r.problem_title
        }));
    }
    async finalizeAwards(hackathonId, round, decisions, decidedBy) {
        await this.db.transaction(async (tx) => {
            const now = new Date().toISOString();
            for (const d of decisions) {
                await tx.query(`UPDATE submission_scores_aggregate
           SET final_decision = $1, decided_at = $2, decided_by = $3
           WHERE submission_id = $4 AND round = $5`, [d.finalDecision, now, decidedBy, d.submissionId, round]);
            }
            await tx.query(`UPDATE hackathons
         SET status = 'completed', results_announced_at = $1, updated_at = $1
         WHERE id = $2`, [now, hackathonId]);
        });
    }
}
exports.LeaderboardRepository = LeaderboardRepository;
class TalentRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findByUserId(userId) {
        const res = await this.db.query(`SELECT tp.*, u.full_name, u.email, u.avatar_url
       FROM talent_profiles tp
       JOIN users u ON u.id = tp.user_id
       WHERE tp.user_id = $1 LIMIT 1`, [userId]);
        if (!res.rows[0])
            return null;
        const r = res.rows[0];
        return {
            id: r.id,
            user_id: r.user_id,
            tenant_id: r.tenant_id,
            headline: r.headline,
            bio: r.bio,
            skills: typeof r.skills === 'string' ? JSON.parse(r.skills) : (r.skills || []),
            github_url: r.github_url,
            linkedin_url: r.linkedin_url,
            portfolio_url: r.portfolio_url,
            resume_url: r.resume_url,
            achievements: typeof r.achievements === 'string' ? JSON.parse(r.achievements) : (r.achievements || []),
            is_visible: r.is_visible,
            created_at: r.created_at,
            updated_at: r.updated_at,
            user: {
                id: r.user_id,
                email: r.email,
                full_name: r.full_name,
                role: 'student',
                tenant_id: r.tenant_id,
                avatar_url: r.avatar_url,
                is_active: true,
                created_at: '',
                updated_at: ''
            }
        };
    }
    async listTalentPool(tenantId) {
        let sql = `
      SELECT tp.*, u.full_name, u.email, u.avatar_url
      FROM talent_profiles tp
      JOIN users u ON u.id = tp.user_id
      WHERE tp.is_visible = true
    `;
        const params = [];
        if (tenantId) {
            sql += ' AND tp.tenant_id = $1';
            params.push(tenantId);
        }
        sql += ' ORDER BY tp.updated_at DESC';
        const res = await this.db.query(sql, params);
        return res.rows.map((r) => ({
            id: r.id,
            user_id: r.user_id,
            tenant_id: r.tenant_id,
            headline: r.headline,
            bio: r.bio,
            skills: typeof r.skills === 'string' ? JSON.parse(r.skills) : (r.skills || []),
            github_url: r.github_url,
            linkedin_url: r.linkedin_url,
            portfolio_url: r.portfolio_url,
            resume_url: r.resume_url,
            achievements: typeof r.achievements === 'string' ? JSON.parse(r.achievements) : (r.achievements || []),
            is_visible: r.is_visible,
            created_at: r.created_at,
            updated_at: r.updated_at,
            user: {
                id: r.user_id,
                email: r.email,
                full_name: r.full_name,
                role: 'student',
                tenant_id: r.tenant_id,
                avatar_url: r.avatar_url,
                is_active: true,
                created_at: '',
                updated_at: ''
            }
        }));
    }
    async upsert(data) {
        const existing = await this.findByUserId(data.user_id);
        const now = new Date().toISOString();
        if (existing) {
            const res = await this.db.query(`UPDATE talent_profiles SET
          headline = $1, bio = $2, skills = $3, github_url = $4,
          linkedin_url = $5, portfolio_url = $6, resume_url = $7,
          achievements = $8, is_visible = $9, updated_at = $10
         WHERE id = $11
         RETURNING *`, [
                data.headline || null,
                data.bio || null,
                JSON.stringify(data.skills || []),
                data.github_url || null,
                data.linkedin_url || null,
                data.portfolio_url || null,
                data.resume_url || null,
                JSON.stringify(data.achievements || []),
                data.is_visible ?? true,
                now,
                existing.id
            ]);
            return res.rows[0];
        }
        else {
            const id = crypto.randomUUID();
            const res = await this.db.query(`INSERT INTO talent_profiles (
          id, user_id, tenant_id, headline, bio, skills, github_url,
          linkedin_url, portfolio_url, resume_url, achievements, is_visible, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
        RETURNING *`, [
                id,
                data.user_id,
                data.tenant_id,
                data.headline || null,
                data.bio || null,
                JSON.stringify(data.skills || []),
                data.github_url || null,
                data.linkedin_url || null,
                data.portfolio_url || null,
                data.resume_url || null,
                JSON.stringify(data.achievements || []),
                data.is_visible ?? true,
                now
            ]);
            return res.rows[0];
        }
    }
}
exports.TalentRepository = TalentRepository;
