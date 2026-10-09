import { IDatabaseAdapter } from './dbAdapter';
import { Hackathon, Company, ProblemStatement, HackathonStatus, ProblemStatus } from '../models';

export class HackathonRepository {
  constructor(private db: IDatabaseAdapter) {}

  async findById(id: string): Promise<Hackathon | null> {
    const res = await this.db.query<Hackathon>('SELECT * FROM hackathons WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] || null;
  }

  async findBySlug(slug: string): Promise<Hackathon | null> {
    const res = await this.db.query<Hackathon>('SELECT * FROM hackathons WHERE slug = $1 LIMIT 1', [slug]);
    return res.rows[0] || null;
  }

  async listByTenant(tenantId: string): Promise<Hackathon[]> {
    const res = await this.db.query<Hackathon>(
      'SELECT * FROM hackathons WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    return res.rows;
  }

  async create(data: Partial<Hackathon> & { tenant_id: string; title: string; slug: string; created_by: string }): Promise<Hackathon> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await this.db.query<Hackathon>(
      `INSERT INTO hackathons (
        id, tenant_id, title, slug, tagline, description, banner_url, status,
        registration_start, registration_end, hacking_start, hacking_end,
        evaluation_start, evaluation_end, min_team_size, max_team_size,
        max_teams, rules, evaluation_rubric, tracks, prizes, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24
      ) RETURNING *`,
      [
        id,
        data.tenant_id,
        data.title,
        data.slug,
        data.tagline || null,
        data.description || null,
        data.banner_url || null,
        data.status || 'draft',
        data.registration_start || now,
        data.registration_end || now,
        data.hacking_start || now,
        data.hacking_end || now,
        data.evaluation_start || now,
        data.evaluation_end || now,
        data.min_team_size || 2,
        data.max_team_size || 4,
        data.max_teams || null,
        data.rules || null,
        JSON.stringify(data.evaluation_rubric || []),
        JSON.stringify(data.tracks || []),
        JSON.stringify(data.prizes || []),
        data.created_by,
        now,
        now
      ]
    );
    return res.rows[0];
  }

  async updateStatus(id: string, status: HackathonStatus): Promise<Hackathon | null> {
    const now = new Date().toISOString();
    const res = await this.db.query<Hackathon>(
      'UPDATE hackathons SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *',
      [status, now, id]
    );
    return res.rows[0] || null;
  }
}

export class CompanyRepository {
  constructor(private db: IDatabaseAdapter) {}

  async findById(id: string): Promise<Company | null> {
    const res = await this.db.query<Company>('SELECT * FROM companies WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] || null;
  }

  async findByCreatedBy(userId: string): Promise<Company | null> {
    const res = await this.db.query<Company>('SELECT * FROM companies WHERE created_by = $1 LIMIT 1', [userId]);
    return res.rows[0] || null;
  }

  async listByTenant(tenantId: string): Promise<Company[]> {
    const res = await this.db.query<Company>(
      'SELECT * FROM companies WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    return res.rows;
  }

  async create(data: Partial<Company> & { tenant_id: string; name: string; slug: string; created_by: string }): Promise<Company> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await this.db.query<Company>(
      `INSERT INTO companies (
        id, tenant_id, name, slug, industry, website, logo_url, description,
        verified, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        id,
        data.tenant_id,
        data.name,
        data.slug,
        data.industry || null,
        data.website || null,
        data.logo_url || null,
        data.description || null,
        data.verified ?? false,
        data.created_by,
        now,
        now
      ]
    );
    return res.rows[0];
  }

  async verifyCompany(id: string, verifiedBy: string): Promise<Company | null> {
    const now = new Date().toISOString();
    const res = await this.db.query<Company>(
      'UPDATE companies SET verified = true, verified_at = $1, verified_by = $2, updated_at = $1 WHERE id = $3 RETURNING *',
      [now, verifiedBy, id]
    );
    return res.rows[0] || null;
  }
}

export class ProblemRepository {
  constructor(private db: IDatabaseAdapter) {}

  async findById(id: string): Promise<ProblemStatement | null> {
    const res = await this.db.query<ProblemStatement>('SELECT * FROM problem_statements WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] || null;
  }

  async listByHackathon(hackathonId: string, status?: ProblemStatus): Promise<ProblemStatement[]> {
    if (status) {
      const res = await this.db.query<ProblemStatement>(
        'SELECT * FROM problem_statements WHERE hackathon_id = $1 AND status = $2 ORDER BY created_at DESC',
        [hackathonId, status]
      );
      return res.rows;
    }
    const res = await this.db.query<ProblemStatement>(
      'SELECT * FROM problem_statements WHERE hackathon_id = $1 ORDER BY created_at DESC',
      [hackathonId]
    );
    return res.rows;
  }

  async listByCompany(companyId: string): Promise<ProblemStatement[]> {
    const res = await this.db.query<ProblemStatement>(
      'SELECT * FROM problem_statements WHERE company_id = $1 ORDER BY created_at DESC',
      [companyId]
    );
    return res.rows;
  }

  async create(data: Partial<ProblemStatement> & { hackathon_id: string; title: string; slug: string; description: string; created_by: string }): Promise<ProblemStatement> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await this.db.query<ProblemStatement>(
      `INSERT INTO problem_statements (
        id, hackathon_id, company_id, title, slug, description, track, difficulty,
        dataset_url, submission_guidelines, max_teams, status, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        id,
        data.hackathon_id,
        data.company_id || null,
        data.title,
        data.slug,
        data.description,
        data.track || null,
        data.difficulty || 'medium',
        data.dataset_url || null,
        data.submission_guidelines || null,
        data.max_teams || null,
        data.status || 'submitted',
        data.created_by,
        now,
        now
      ]
    );
    return res.rows[0];
  }

  async updateReview(id: string, status: ProblemStatus, reviewNotes: string, reviewedBy: string): Promise<ProblemStatement | null> {
    const now = new Date().toISOString();
    const res = await this.db.query<ProblemStatement>(
      'UPDATE problem_statements SET status = $1, review_notes = $2, reviewed_by = $3, reviewed_at = $4, updated_at = $4 WHERE id = $5 RETURNING *',
      [status, reviewNotes, reviewedBy, now, id]
    );
    return res.rows[0] || null;
  }
}
