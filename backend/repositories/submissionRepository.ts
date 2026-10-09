import { IDatabaseAdapter } from './dbAdapter';
import { Submission } from '../models';

export class SubmissionRepository {
  constructor(private db: IDatabaseAdapter) {}

  async findById(id: string): Promise<Submission | null> {
    const res = await this.db.query<Submission>('SELECT * FROM submissions WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] || null;
  }

  async findByTeamAndRound(teamId: string, round: number = 1): Promise<Submission | null> {
    const res = await this.db.query<Submission>(
      'SELECT * FROM submissions WHERE team_id = $1 AND submission_round = $2 LIMIT 1',
      [teamId, round]
    );
    return res.rows[0] || null;
  }

  async listByHackathon(hackathonId: string, round: number = 1): Promise<Submission[]> {
    const res = await this.db.query<Submission>(
      'SELECT * FROM submissions WHERE hackathon_id = $1 AND submission_round = $2 ORDER BY created_at ASC',
      [hackathonId, round]
    );
    return res.rows;
  }

  /**
   * Save submission draft or create if not exists
   */
  async upsertDraft(data: Partial<Submission> & {
    hackathon_id: string;
    team_id: string;
    title: string;
    abstract: string;
    approach: string;
    submitted_by: string;
    submission_round?: number;
  }): Promise<Submission> {
    const round = data.submission_round || 1;
    const now = new Date().toISOString();

    // Check if locked
    const existing = await this.findByTeamAndRound(data.team_id, round);
    if (existing && existing.is_locked) {
      throw new Error('This submission has already been finalized and locked. Edits are no longer allowed.');
    }

    if (existing) {
      const res = await this.db.query<Submission>(
        `UPDATE submissions SET
          title = $1, abstract = $2, approach = $3, repo_url = $4,
          demo_url = $5, presentation_url = $6, video_url = $7,
          tech_stack = $8, problem_id = $9, last_edited_at = $10
         WHERE id = $11
         RETURNING *`,
        [
          data.title,
          data.abstract,
          data.approach,
          data.repo_url || null,
          data.demo_url || null,
          data.presentation_url || null,
          data.video_url || null,
          JSON.stringify(data.tech_stack || []),
          data.problem_id || null,
          now,
          existing.id
        ]
      );
      return res.rows[0];
    } else {
      const id = data.id || crypto.randomUUID();
      const res = await this.db.query<Submission>(
        `INSERT INTO submissions (
          id, hackathon_id, team_id, problem_id, submission_round, title,
          abstract, approach, repo_url, demo_url, presentation_url, video_url,
          tech_stack, is_locked, submitted_by, created_at, last_edited_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, false, $14, $15, $15
        ) RETURNING *`,
        [
          id,
          data.hackathon_id,
          data.team_id,
          data.problem_id || null,
          round,
          data.title,
          data.abstract,
          data.approach,
          data.repo_url || null,
          data.demo_url || null,
          data.presentation_url || null,
          data.video_url || null,
          JSON.stringify(data.tech_stack || []),
          data.submitted_by,
          now
        ]
      );
      return res.rows[0];
    }
  }

  /**
   * Final lock of submission - makes deliverables immutable
   */
  async lockSubmission(submissionId: string, userId: string): Promise<Submission> {
    const sub = await this.findById(submissionId);
    if (!sub) throw new Error('Submission not found.');
    if (sub.is_locked) return sub;

    // Check minimum requirements before final locking
    if (!sub.title || !sub.abstract || !sub.approach) {
      throw new Error('Title, abstract, and technical approach are required to finalize submission.');
    }
    if (!sub.repo_url && !sub.demo_url && !sub.presentation_url) {
      throw new Error('At least one deliverable (GitHub repository, live demo, or presentation) is required.');
    }

    const now = new Date().toISOString();
    const res = await this.db.query<Submission>(
      'UPDATE submissions SET is_locked = true, lock_timestamp = $1, last_edited_at = $1 WHERE id = $2 RETURNING *',
      [now, submissionId]
    );

    // Update team status to 'submitted'
    await this.db.query(
      `UPDATE teams SET status = 'submitted', is_open = false, updated_at = $1 WHERE id = $2`,
      [now, sub.team_id]
    );

    return res.rows[0];
  }

  async updateAIPreScreening(submissionId: string, flags: string[], score: number): Promise<void> {
    await this.db.query(
      'UPDATE submissions SET ai_flags = $1, ai_readiness_score = $2 WHERE id = $3',
      [JSON.stringify(flags), score, submissionId]
    );
  }
}
