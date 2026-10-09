"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamRepository = void 0;
class TeamRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findById(id) {
        const res = await this.db.query('SELECT * FROM teams WHERE id = $1 LIMIT 1', [id]);
        if (!res.rows[0])
            return null;
        const team = res.rows[0];
        team.members = await this.getTeamMembers(team.id);
        return team;
    }
    async findByInviteCode(hackathonId, inviteCode) {
        const res = await this.db.query('SELECT * FROM teams WHERE hackathon_id = $1 AND UPPER(invite_code) = UPPER($2) LIMIT 1', [hackathonId, inviteCode.trim()]);
        if (!res.rows[0])
            return null;
        const team = res.rows[0];
        team.members = await this.getTeamMembers(team.id);
        return team;
    }
    async findUserTeam(hackathonId, userId) {
        const res = await this.db.query(`SELECT t.* FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE t.hackathon_id = $1 AND tm.user_id = $2
       LIMIT 1`, [hackathonId, userId]);
        if (!res.rows[0])
            return null;
        const team = res.rows[0];
        team.members = await this.getTeamMembers(team.id);
        return team;
    }
    async getTeamMembers(teamId) {
        const res = await this.db.query(`SELECT tm.team_id, tm.user_id, tm.role, tm.joined_at,
              u.email, u.full_name, u.avatar_url, u.role as user_role
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY tm.role DESC, tm.joined_at ASC`, [teamId]);
        return res.rows.map((r) => ({
            team_id: r.team_id,
            user_id: r.user_id,
            role: r.role,
            joined_at: r.joined_at,
            user: {
                id: r.user_id,
                email: r.email,
                full_name: r.full_name,
                role: r.user_role,
                tenant_id: '',
                avatar_url: r.avatar_url,
                is_active: true,
                created_at: '',
                updated_at: ''
            }
        }));
    }
    /**
     * Atomic team creation with leader membership in a transaction
     */
    async createTeam(hackathonId, name, creatorId, options) {
        return this.db.transaction(async (tx) => {
            // 1. Check if user already has a team in this hackathon
            const existing = await tx.query(`SELECT tm.team_id FROM team_members tm
         JOIN teams t ON t.id = tm.team_id
         WHERE t.hackathon_id = $1 AND tm.user_id = $2`, [hackathonId, creatorId]);
            if (existing.rowCount > 0) {
                throw new Error('You are already registered in a team for this hackathon.');
            }
            // 2. Generate unique 6-character code
            const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let inviteCode = '';
            for (let i = 0; i < 6; i++) {
                inviteCode += codeChars.charAt(Math.floor(Math.random() * codeChars.length));
            }
            const teamId = crypto.randomUUID();
            const now = new Date().toISOString();
            const teamRes = await tx.query(`INSERT INTO teams (id, hackathon_id, name, invite_code, problem_id, status, is_open, max_members, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'forming', true, $6, $7, $8, $8)
         RETURNING *`, [teamId, hackathonId, name.trim(), inviteCode, options?.problemId || null, options?.maxMembers || 4, creatorId, now]);
            // 3. Insert leader
            await tx.query(`INSERT INTO team_members (team_id, user_id, role, joined_at)
         VALUES ($1, $2, 'leader', $3)`, [teamId, creatorId, now]);
            const createdTeam = teamRes.rows[0];
            createdTeam.members = [
                {
                    team_id: teamId,
                    user_id: creatorId,
                    role: 'leader',
                    joined_at: now
                }
            ];
            return createdTeam;
        });
    }
    /**
     * Atomic join with row-level locking (FOR UPDATE) to prevent race conditions & member overflow
     */
    async joinTeamWithCode(hackathonId, inviteCode, userId) {
        return this.db.transaction(async (tx) => {
            // 1. Check if user is already in a team
            const existing = await tx.query(`SELECT tm.team_id FROM team_members tm
         JOIN teams t ON t.id = tm.team_id
         WHERE t.hackathon_id = $1 AND tm.user_id = $2`, [hackathonId, userId]);
            if (existing.rowCount > 0) {
                throw new Error('You already belong to a team in this hackathon.');
            }
            // 2. Lock the team row for concurrency safety
            const teamRes = await tx.query(`SELECT * FROM teams WHERE hackathon_id = $1 AND UPPER(invite_code) = UPPER($2) FOR UPDATE`, [hackathonId, inviteCode.trim()]);
            if (teamRes.rowCount === 0) {
                throw new Error('Invalid invite code. Team not found.');
            }
            const team = teamRes.rows[0];
            if (!team.is_open) {
                throw new Error('This team is currently closed to new members.');
            }
            // 3. Count current members under the lock
            const countRes = await tx.query(`SELECT COUNT(*) as count FROM team_members WHERE team_id = $1`, [team.id]);
            const currentCount = parseInt(countRes.rows[0]?.count || '0', 10);
            if (currentCount >= team.max_members) {
                throw new Error(`Team is already full (maximum ${team.max_members} members allowed).`);
            }
            // 4. Add member
            const now = new Date().toISOString();
            await tx.query(`INSERT INTO team_members (team_id, user_id, role, joined_at)
         VALUES ($1, $2, 'member', $3)`, [team.id, userId, now]);
            // Auto-close if full
            if (currentCount + 1 >= team.max_members) {
                await tx.query(`UPDATE teams SET is_open = false, updated_at = $1 WHERE id = $2`, [now, team.id]);
                team.is_open = false;
            }
            return team;
        });
    }
    async selectProblem(teamId, problemId) {
        const now = new Date().toISOString();
        const res = await this.db.query('UPDATE teams SET problem_id = $1, updated_at = $2 WHERE id = $3 RETURNING *', [problemId, now, teamId]);
        return res.rows[0] || null;
    }
}
exports.TeamRepository = TeamRepository;
