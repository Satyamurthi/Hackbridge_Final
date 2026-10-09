"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluationRepository = void 0;
class EvaluationRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async listAssignmentsForEvaluator(evaluatorId, hackathonId) {
        let sql = `
      SELECT ea.*, s.title as submission_title, s.abstract as submission_abstract,
             s.approach as submission_approach, s.repo_url, s.demo_url, s.presentation_url,
             s.video_url, s.tech_stack, s.problem_id
      FROM evaluation_assignments ea
      JOIN submissions s ON s.id = ea.submission_id
      WHERE ea.evaluator_id = $1
    `;
        const params = [evaluatorId];
        if (hackathonId) {
            sql += ' AND ea.hackathon_id = $2';
            params.push(hackathonId);
        }
        sql += ' ORDER BY ea.assigned_at DESC';
        const res = await this.db.query(sql, params);
        return res.rows.map((r) => ({
            id: r.id,
            hackathon_id: r.hackathon_id,
            evaluator_id: r.evaluator_id,
            submission_id: r.submission_id,
            round: r.round,
            status: r.status,
            assigned_at: r.assigned_at,
            conflict_of_interest: r.conflict_of_interest,
            submission: {
                id: r.submission_id,
                hackathon_id: r.hackathon_id,
                team_id: '', // Anonymized
                submission_round: r.round,
                title: r.submission_title,
                abstract: r.submission_abstract,
                approach: r.submission_approach,
                repo_url: r.repo_url,
                demo_url: r.demo_url,
                presentation_url: r.presentation_url,
                video_url: r.video_url,
                tech_stack: typeof r.tech_stack === 'string' ? JSON.parse(r.tech_stack) : (r.tech_stack || []),
                is_locked: true,
                submitted_by: '',
                created_at: '',
                last_edited_at: ''
            }
        }));
    }
    async findAssignmentById(id) {
        const res = await this.db.query('SELECT * FROM evaluation_assignments WHERE id = $1 LIMIT 1', [id]);
        return res.rows[0] || null;
    }
    async findExistingScore(assignmentId) {
        const res = await this.db.query('SELECT * FROM evaluation_scores WHERE assignment_id = $1 LIMIT 1', [assignmentId]);
        return res.rows[0] || null;
    }
    /**
     * Submit double-blind evaluation score & atomically update aggregates
     */
    async submitScore(data) {
        return this.db.transaction(async (tx) => {
            const assignRes = await tx.query('SELECT * FROM evaluation_assignments WHERE id = $1 LIMIT 1', [data.assignmentId]);
            if (assignRes.rowCount === 0)
                throw new Error('Evaluation assignment not found.');
            const assignment = assignRes.rows[0];
            // Check if locked
            const existingRes = await tx.query('SELECT * FROM evaluation_scores WHERE assignment_id = $1 LIMIT 1', [data.assignmentId]);
            if (existingRes.rowCount > 0 && existingRes.rows[0].is_locked) {
                throw new Error('This evaluation has already been locked and submitted.');
            }
            const now = new Date().toISOString();
            const scoreId = existingRes.rows[0]?.id || crypto.randomUUID();
            let score;
            if (existingRes.rowCount > 0) {
                const updateRes = await tx.query(`UPDATE evaluation_scores SET
            scores = $1, total_score = $2, strengths = $3,
            weaknesses = $4, recommendation = $5, private_notes = $6,
            is_locked = true, scored_at = $7
           WHERE id = $8
           RETURNING *`, [
                    JSON.stringify(data.scores),
                    data.totalScore,
                    data.strengths || null,
                    data.weaknesses || null,
                    data.recommendation,
                    data.privateNotes || null,
                    now,
                    scoreId
                ]);
                score = updateRes.rows[0];
            }
            else {
                const insertRes = await tx.query(`INSERT INTO evaluation_scores (
            id, assignment_id, scores, total_score, strengths,
            weaknesses, recommendation, private_notes, is_locked, scored_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
          RETURNING *`, [
                    scoreId,
                    data.assignmentId,
                    JSON.stringify(data.scores),
                    data.totalScore,
                    data.strengths || null,
                    data.weaknesses || null,
                    data.recommendation,
                    data.privateNotes || null,
                    now
                ]);
                score = insertRes.rows[0];
            }
            // Mark assignment as completed
            await tx.query(`UPDATE evaluation_assignments SET status = 'completed' WHERE id = $1`, [data.assignmentId]);
            // Re-aggregate scores for this submission
            const allScoresRes = await tx.query(`SELECT es.total_score
         FROM evaluation_scores es
         JOIN evaluation_assignments ea ON ea.id = es.assignment_id
         WHERE ea.submission_id = $1 AND es.is_locked = true`, [assignment.submission_id]);
            const count = allScoresRes.rowCount;
            if (count > 0) {
                const sum = allScoresRes.rows.reduce((acc, curr) => acc + Number(curr.total_score), 0);
                const avg = sum / count;
                // Variance calculation
                const variance = allScoresRes.rows.reduce((acc, curr) => acc + Math.pow(Number(curr.total_score) - avg, 2), 0) / count;
                await tx.query(`INSERT INTO submission_scores_aggregate (
            submission_id, round, average_score, normalized_average, evaluator_count, score_variance
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (submission_id, round)
          DO UPDATE SET
            average_score = EXCLUDED.average_score,
            normalized_average = EXCLUDED.normalized_average,
            evaluator_count = EXCLUDED.evaluator_count,
            score_variance = EXCLUDED.score_variance`, [assignment.submission_id, assignment.round, avg, avg, count, variance]);
            }
            return score;
        });
    }
    async createAssignment(data) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const res = await this.db.query(`INSERT INTO evaluation_assignments (
        id, hackathon_id, evaluator_id, submission_id, round, status, assigned_at, conflict_of_interest
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, false)
      RETURNING *`, [id, data.hackathonId, data.evaluatorId, data.submissionId, data.round || 1, now]);
        return res.rows[0];
    }
}
exports.EvaluationRepository = EvaluationRepository;
