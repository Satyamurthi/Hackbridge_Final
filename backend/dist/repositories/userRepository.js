"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantRepository = exports.UserRepository = void 0;
class UserRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findById(id) {
        const res = await this.db.query('SELECT id, email, role, tenant_id, full_name, phone, avatar_url, metadata, is_active, created_at, updated_at FROM users WHERE id = $1 LIMIT 1', [id]);
        return res.rows[0] || null;
    }
    async findByEmail(email) {
        const res = await this.db.query('SELECT id, email, password_hash, role, tenant_id, full_name, phone, avatar_url, metadata, is_active, created_at, updated_at FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
        return res.rows[0] || null;
    }
    async findByTenantAndRole(tenantId, role) {
        if (role) {
            const res = await this.db.query('SELECT id, email, role, tenant_id, full_name, phone, avatar_url, is_active, created_at FROM users WHERE tenant_id = $1 AND role = $2 AND is_active = true ORDER BY full_name ASC', [tenantId, role]);
            return res.rows;
        }
        const res = await this.db.query('SELECT id, email, role, tenant_id, full_name, phone, avatar_url, is_active, created_at FROM users WHERE tenant_id = $1 AND is_active = true ORDER BY full_name ASC', [tenantId]);
        return res.rows;
    }
    async create(user) {
        const id = user.id || crypto.randomUUID();
        const now = new Date().toISOString();
        const res = await this.db.query(`INSERT INTO users (id, email, password_hash, role, tenant_id, full_name, phone, avatar_url, metadata, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, email, role, tenant_id, full_name, phone, avatar_url, metadata, is_active, created_at, updated_at`, [
            id,
            user.email.toLowerCase(),
            user.password_hash || null,
            user.role,
            user.tenant_id,
            user.full_name,
            user.phone || null,
            user.avatar_url || null,
            JSON.stringify(user.metadata || {}),
            user.is_active ?? true,
            now,
            now
        ]);
        return res.rows[0];
    }
    async update(id, updates) {
        const now = new Date().toISOString();
        const fields = [];
        const values = [];
        let idx = 1;
        if (updates.full_name !== undefined) {
            fields.push(`full_name = $${idx++}`);
            values.push(updates.full_name);
        }
        if (updates.phone !== undefined) {
            fields.push(`phone = $${idx++}`);
            values.push(updates.phone);
        }
        if (updates.avatar_url !== undefined) {
            fields.push(`avatar_url = $${idx++}`);
            values.push(updates.avatar_url);
        }
        if (updates.metadata !== undefined) {
            fields.push(`metadata = $${idx++}`);
            values.push(JSON.stringify(updates.metadata));
        }
        if (updates.password_hash !== undefined) {
            fields.push(`password_hash = $${idx++}`);
            values.push(updates.password_hash);
        }
        if (fields.length === 0)
            return this.findById(id);
        fields.push(`updated_at = $${idx++}`);
        values.push(now);
        values.push(id);
        const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, email, role, tenant_id, full_name, phone, avatar_url, metadata, is_active, created_at, updated_at`;
        const res = await this.db.query(sql, values);
        return res.rows[0] || null;
    }
}
exports.UserRepository = UserRepository;
class TenantRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async findById(id) {
        const res = await this.db.query('SELECT * FROM tenants WHERE id = $1 LIMIT 1', [id]);
        return res.rows[0] || null;
    }
    async findBySlug(slug) {
        const res = await this.db.query('SELECT * FROM tenants WHERE slug = $1 AND is_active = true LIMIT 1', [slug]);
        return res.rows[0] || null;
    }
    async findByDomain(domain) {
        const res = await this.db.query('SELECT * FROM tenants WHERE (custom_domain = $1 OR subdomain = $1) AND is_active = true LIMIT 1', [domain]);
        return res.rows[0] || null;
    }
    async listActive() {
        const res = await this.db.query('SELECT * FROM tenants WHERE is_active = true ORDER BY name ASC');
        return res.rows;
    }
    async create(tenant) {
        const id = tenant.id || crypto.randomUUID();
        const now = new Date().toISOString();
        const res = await this.db.query(`INSERT INTO tenants (id, slug, name, custom_domain, subdomain, primary_color, secondary_color, logo_url, plan, settings, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`, [
            id,
            tenant.slug.toLowerCase(),
            tenant.name,
            tenant.custom_domain || null,
            tenant.subdomain || null,
            tenant.primary_color || '#4F46E5',
            tenant.secondary_color || '#7C3AED',
            tenant.logo_url || null,
            tenant.plan || 'enterprise',
            JSON.stringify(tenant.settings || {}),
            tenant.is_active ?? true,
            now,
            now
        ]);
        return res.rows[0];
    }
}
exports.TenantRepository = TenantRepository;
