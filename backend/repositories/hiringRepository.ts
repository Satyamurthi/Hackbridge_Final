import { IDatabaseAdapter } from './dbAdapter';
import { HiringInterest, AuditLog, AppNotification, HiringStatus, HiringInterestType, NotificationType } from '../models';

export class HiringRepository {
  constructor(private db: IDatabaseAdapter) {}

  async createInterest(data: {
    company_id: string;
    student_id: string;
    role_title: string;
    compensation_range?: string;
    interest_type: HiringInterestType;
    message?: string;
  }): Promise<HiringInterest> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await this.db.query<HiringInterest>(
      `INSERT INTO hiring_interests (
        id, company_id, student_id, role_title, compensation_range,
        interest_type, message, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $8)
      RETURNING *`,
      [
        id,
        data.company_id,
        data.student_id,
        data.role_title,
        data.compensation_range || null,
        data.interest_type,
        data.message || null,
        now
      ]
    );
    return res.rows[0];
  }

  async listByCompany(companyId: string): Promise<HiringInterest[]> {
    const res = await this.db.query<any>(
      `SELECT hi.*, u.full_name as student_name, u.email as student_email
       FROM hiring_interests hi
       JOIN users u ON u.id = hi.student_id
       WHERE hi.company_id = $1
       ORDER BY hi.created_at DESC`,
      [companyId]
    );
    return res.rows;
  }

  async listByStudent(studentId: string): Promise<HiringInterest[]> {
    const res = await this.db.query<any>(
      `SELECT hi.*, c.name as company_name, c.logo_url as company_logo
       FROM hiring_interests hi
       JOIN companies c ON c.id = hi.company_id
       WHERE hi.student_id = $1
       ORDER BY hi.created_at DESC`,
      [studentId]
    );
    return res.rows;
  }

  async updateStatus(id: string, status: HiringStatus): Promise<HiringInterest | null> {
    const now = new Date().toISOString();
    const res = await this.db.query<HiringInterest>(
      'UPDATE hiring_interests SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *',
      [status, now, id]
    );
    return res.rows[0] || null;
  }
}

export class AuditRepository {
  constructor(private db: IDatabaseAdapter) {}

  async record(data: {
    tenant_id: string;
    actor_id?: string | null;
    action: string;
    target_type: string;
    target_id?: string | null;
    payload?: Record<string, any>;
    ip_address?: string | null;
    user_agent?: string | null;
  }): Promise<AuditLog> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await this.db.query<AuditLog>(
      `INSERT INTO audit_logs (
        id, tenant_id, actor_id, action, target_type, target_id, payload, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        id,
        data.tenant_id,
        data.actor_id || null,
        data.action,
        data.target_type,
        data.target_id || null,
        JSON.stringify(data.payload || {}),
        data.ip_address || null,
        data.user_agent || null,
        now
      ]
    );
    return res.rows[0];
  }

  async list(tenantId: string, options?: { limit?: number; action?: string; targetType?: string }): Promise<any[]> {
    let sql = `
      SELECT al.*, u.full_name as actor_name, u.email as actor_email, u.role as actor_role
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.actor_id
      WHERE al.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let idx = 2;

    if (options?.action && options.action !== 'all') {
      sql += ` AND al.action ILIKE $${idx++}`;
      params.push(`%${options.action}%`);
    }
    if (options?.targetType && options.targetType !== 'all') {
      sql += ` AND al.target_type = $${idx++}`;
      params.push(options.targetType);
    }

    sql += ` ORDER BY al.created_at DESC LIMIT $${idx}`;
    params.push(options?.limit || 100);

    const res = await this.db.query<any>(sql, params);
    return res.rows.map((r) => ({
      ...r,
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload || {}),
      actor: r.actor_id ? {
        id: r.actor_id,
        fullName: r.actor_name,
        email: r.actor_email,
        role: r.actor_role
      } : null
    }));
  }
}

export class NotificationRepository {
  constructor(private db: IDatabaseAdapter) {}

  async create(data: {
    user_id: string;
    title: string;
    message: string;
    type: NotificationType;
    link?: string;
  }): Promise<AppNotification> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const res = await this.db.query<AppNotification>(
      `INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, $7)
       RETURNING *`,
      [id, data.user_id, data.title, data.message, data.type, data.link || null, now]
    );
    return res.rows[0];
  }

  async listForUser(userId: string, limit: number = 30): Promise<AppNotification[]> {
    const res = await this.db.query<AppNotification>(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return res.rows;
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const res = await this.db.query(
      'UPDATE notifications SET is_read = true, read_at = $1 WHERE id = $2 AND user_id = $3',
      [now, id, userId]
    );
    return res.rowCount > 0;
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const res = await this.db.query(
      'UPDATE notifications SET is_read = true, read_at = $1 WHERE user_id = $2 AND is_read = false',
      [now, userId]
    );
    return res.rowCount > 0;
  }
}
