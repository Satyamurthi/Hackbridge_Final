import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { UserRepository, TenantRepository, AuditRepository } from '../repositories';
import { User, UserRole, Tenant } from '../models';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

export class AuthService {
  private jwtSecret: string;

  constructor(
    private userRepo: UserRepository,
    private tenantRepo: TenantRepository,
    private auditRepo?: AuditRepository
  ) {
    this.jwtSecret = process.env.JWT_SECRET || 'hackbridge-insecure-dev-secret-change-in-production-2026';
  }

  /**
   * Secure PBKDF2 password hashing using built-in crypto (portable & zero native dependencies)
   */
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password: string, storedHash: string): boolean {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    const testHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(testHash), Buffer.from(originalHash));
  }

  generateToken(user: User): string {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id
    };
    return jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });
  }

  verifyToken(token: string): TokenPayload {
    return jwt.verify(token, this.jwtSecret) as TokenPayload;
  }

  async login(email: string, password: string, clientIp?: string): Promise<{ token: string; user: User; tenant: Tenant | null }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (!user.is_active) {
      throw new Error('Your account has been deactivated. Please contact your institution administrator.');
    }

    if (user.password_hash) {
      const match = this.verifyPassword(password, user.password_hash);
      if (!match) {
        throw new Error('Invalid email or password.');
      }
    }

    const tenant = await this.tenantRepo.findById(user.tenant_id);
    const token = this.generateToken(user);

    if (this.auditRepo && user.tenant_id) {
      await this.auditRepo.record({
        tenant_id: user.tenant_id,
        actor_id: user.id,
        action: 'user.login',
        target_type: 'user',
        target_id: user.id,
        ip_address: clientIp
      });
    }

    return { token, user, tenant };
  }

  /**
   * Self-service registration with STRICT role whitelisting (Prevents privilege escalation)
   */
  async register(data: {
    email: string;
    password: string;
    fullName: string;
    role?: UserRole;
    tenantSlugOrId?: string;
    phone?: string;
    metadata?: Record<string, any>;
    clientIp?: string;
  }): Promise<{ token: string; user: User; tenant: Tenant }> {
    const email = data.email.trim().toLowerCase();
    
    // Check if email already exists
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    // Role Whitelist: Self-service registration ONLY allows student, company_rep, evaluator, mentor.
    // Super admins and College admins MUST be created by an existing administrator.
    const requestedRole = data.role || 'student';
    const allowedSelfRoles: UserRole[] = ['student', 'company_rep', 'evaluator', 'mentor'];
    if (!allowedSelfRoles.includes(requestedRole)) {
      throw new Error(`Self-registration with role '${requestedRole}' is prohibited. Contact platform administration.`);
    }

    // Resolve tenant
    let tenant: Tenant | null = null;
    if (data.tenantSlugOrId) {
      tenant = (await this.tenantRepo.findById(data.tenantSlugOrId)) ||
               (await this.tenantRepo.findBySlug(data.tenantSlugOrId));
    }

    if (!tenant) {
      // Resolve by email domain
      const domain = email.split('@')[1];
      if (domain) {
        tenant = await this.tenantRepo.findByDomain(domain);
      }
    }

    // Default fallback to pilot tenant (MITT)
    if (!tenant) {
      tenant = (await this.tenantRepo.findBySlug('mitt')) || (await this.tenantRepo.listActive())[0];
    }

    if (!tenant) {
      throw new Error('Could not resolve an active institution tenant for registration.');
    }

    const passwordHash = this.hashPassword(data.password);
    const user = await this.userRepo.create({
      email,
      password_hash: passwordHash,
      role: requestedRole,
      tenant_id: tenant.id,
      full_name: data.fullName.trim(),
      phone: data.phone || null,
      metadata: data.metadata || {},
      is_active: true
    });

    const token = this.generateToken(user);

    if (this.auditRepo) {
      await this.auditRepo.record({
        tenant_id: tenant.id,
        actor_id: user.id,
        action: 'user.registered',
        target_type: 'user',
        target_id: user.id,
        payload: { role: user.role, email: user.email },
        ip_address: data.clientIp
      });
    }

    return { token, user, tenant };
  }
}
