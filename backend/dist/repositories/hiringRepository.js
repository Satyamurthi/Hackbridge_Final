"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationRepository = exports.AuditRepository = exports.HiringRepository = void 0;
class HiringRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async createInterest(data) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const res = await this.db.query(`INSERT INTO hiring_interests (
        id, company_id, student_id, role_title, compensation_range,
        interest_type, message, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $8)
      RETURNING *`, [
            id,
            data.company_id,
            data.student_id,
            data.role_title,
            data.compensation_range || null,
            data.interest_type,
            data.message || null,
            now
        ]);
        return res.rows[0];
    }
    async listByCompany(companyId) {
        const res = await this.db.query(`SELECT hi.*, u.full_name as student_name, u.email as student_email
       FROM hiring_interests hi
       JOIN users u ON u.id = hi.student_id
       WHERE hi.company_id = $1
       ORDER BY hi.created_at DESC`, [companyId]);
        return res.rows;
    }
    async listByStudent(studentId) {
        const res = await this.db.query(`SELECT hi.*, c.name as company_name, c.logo_url as company_logo
       FROM hiring_interests hi
       JOIN companies c ON c.id = hi.company_id
       WHERE hi.student_id = $1
       ORDER BY hi.created_at DESC`, [studentId]);
        return res.rows;
    }
    async updateStatus(id, status) {
        const now = new Date().toISOString();
        const res = await this.db.query('UPDATE hiring_interests SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *', [status, now, id]);
        return res.rows[0] || null;
    }
}
exports.HiringRepository = HiringRepository;
class AuditRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async record(data) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const res = await this.db.query(`INSERT INTO audit_logs (
        id, tenant_id, actor_id, action, target_type, target_id, payload, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`, [
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
        ]);
        return res.rows[0];
    }
    async list(tenantId, options) {
        let sql = `
      SELECT al.*, u.full_name as actor_name, u.email as actor_email, u.role as actor_role
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.actor_id
      WHERE al.tenant_id = $1
    `;
        const params = [tenantId];
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
        const res = await this.db.query(sql, params);
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
exports.AuditRepository = AuditRepository;
class NotificationRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async create(data) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const res = await this.db.query(`INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, $7)
       RETURNING *`, [id, data.user_id, data.title, data.message, data.type, data.link || null, now]);
        return res.rows[0];
    }
    async listForUser(userId, limit = 30) {
        const res = await this.db.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
        return res.rows;
    }
    async markAsRead(id, userId) {
        const now = new Date().toISOString();
        const res = await this.db.query('UPDATE notifications SET is_read = true, read_at = $1 WHERE id = $2 AND user_id = $3', [now, id, userId]);
        return res.rowCount > 0;
    }
    async markAllAsRead(userId) {
        const now = new Date().toISOString();
        const res = await this.db.query('UPDATE notifications SET is_read = true, read_at = $1 WHERE user_id = $2 AND is_read = false', [now, userId]);
        return res.rowCount > 0;
    }
}
exports.NotificationRepository = NotificationRepository;
