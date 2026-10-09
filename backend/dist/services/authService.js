"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class AuthService {
    userRepo;
    tenantRepo;
    auditRepo;
    jwtSecret;
    constructor(userRepo, tenantRepo, auditRepo) {
        this.userRepo = userRepo;
        this.tenantRepo = tenantRepo;
        this.auditRepo = auditRepo;
        this.jwtSecret = process.env.JWT_SECRET || 'hackbridge-insecure-dev-secret-change-in-production-2026';
    }
    /**
     * Secure PBKDF2 password hashing using built-in crypto (portable & zero native dependencies)
     */
    hashPassword(password) {
        const salt = crypto_1.default.randomBytes(16).toString('hex');
        const hash = crypto_1.default.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        return `${salt}:${hash}`;
    }
    verifyPassword(password, storedHash) {
        const parts = storedHash.split(':');
        if (parts.length !== 2)
            return false;
        const [salt, originalHash] = parts;
        const testHash = crypto_1.default.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        return crypto_1.default.timingSafeEqual(Buffer.from(testHash), Buffer.from(originalHash));
    }
    generateToken(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenant_id
        };
        return jsonwebtoken_1.default.sign(payload, this.jwtSecret, { expiresIn: '7d' });
    }
    verifyToken(token) {
        return jsonwebtoken_1.default.verify(token, this.jwtSecret);
    }
    async login(email, password, clientIp) {
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
    async register(data) {
        const email = data.email.trim().toLowerCase();
        // Check if email already exists
        const existing = await this.userRepo.findByEmail(email);
        if (existing) {
            throw new Error('An account with this email address already exists.');
        }
        // Role Whitelist: Self-service registration ONLY allows student, company_rep, evaluator, mentor.
        // Super admins and College admins MUST be created by an existing administrator.
        const requestedRole = data.role || 'student';
        const allowedSelfRoles = ['student', 'company_rep', 'evaluator', 'mentor'];
        if (!allowedSelfRoles.includes(requestedRole)) {
            throw new Error(`Self-registration with role '${requestedRole}' is prohibited. Contact platform administration.`);
        }
        // Resolve tenant
        let tenant = null;
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
exports.AuthService = AuthService;
