import { Router, Response } from 'express';
import { HackathonService } from '../../services/hackathonService';
import { HackathonRepository, CompanyRepository, AuditRepository } from '../../repositories';
import { AuthenticatedRequest, createAuthMiddleware, requireRole } from '../middleware/auth';
import { AuthService } from '../../services/authService';

export function createHackathonRoutes(
  hackathonService: HackathonService,
  hackathonRepo: HackathonRepository,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // Public: List hackathons by tenant
  router.get('/', async (req, res, next) => {
    try {
      const tenantId = (req.query.tenantId as string) || 'mitt';
      const list = await hackathonRepo.listByTenant(tenantId);
      res.json({ hackathons: list });
    } catch (err) {
      next(err);
    }
  });

  // Public: Get single hackathon by ID or slug
  router.get('/:idOrSlug', async (req, res, next) => {
    try {
      const idOrSlug = req.params.idOrSlug;
      let hackathon = await hackathonRepo.findById(idOrSlug);
      if (!hackathon) {
        hackathon = await hackathonRepo.findBySlug(idOrSlug);
      }
      if (!hackathon) {
        return res.status(404).json({ error: 'Hackathon not found.' });
      }
      res.json({ hackathon });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Create hackathon
  router.post(
    '/',
    requireAuth,
    requireRole(['super_admin', 'college_admin']),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const hackathon = await hackathonService.createHackathon({
          ...req.body,
          tenant_id: user.tenantId,
          created_by: user.userId
        });
        res.status(201).json({ hackathon });
      } catch (err) {
        next(err);
      }
    }
  );

  // Admin: Transition hackathon state machine
  router.post(
    '/:id/transition',
    requireAuth,
    requireRole(['super_admin', 'college_admin']),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const { nextStatus } = req.body;
        if (!nextStatus) {
          return res.status(400).json({ error: 'nextStatus is required.' });
        }
        const updated = await hackathonService.transitionState(
          req.params.id,
          nextStatus,
          user.userId,
          user.tenantId
        );
        res.json({ hackathon: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export function createCompanyRoutes(
  companyRepo: CompanyRepository,
  auditRepo: AuditRepository,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // List companies for tenant
  router.get('/', async (req, res, next) => {
    try {
      const tenantId = (req.query.tenantId as string) || 'mitt';
      const companies = await companyRepo.listByTenant(tenantId);
      res.json({ companies });
    } catch (err) {
      next(err);
    }
  });

  // Get current user's registered company
  router.get('/my', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const company = await companyRepo.findByCreatedBy(req.user!.userId);
      res.json({ company });
    } catch (err) {
      next(err);
    }
  });

  // Company: Register new corporate entity
  router.post(
    '/',
    requireAuth,
    requireRole(['company_rep', 'super_admin', 'college_admin']),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const { name, industry, website, logo_url, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Company name is required.' });

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const company = await companyRepo.create({
          tenant_id: user.tenantId,
          name,
          slug,
          industry,
          website,
          logo_url,
          description,
          verified: false,
          created_by: user.userId
        });

        await auditRepo.record({
          tenant_id: user.tenantId,
          actor_id: user.userId,
          action: 'company.registered',
          target_type: 'company',
          target_id: company.id,
          payload: { name: company.name }
        });

        res.status(201).json({ company });
      } catch (err) {
        next(err);
      }
    }
  );

  // Admin: Verify company
  router.post(
    '/:id/verify',
    requireAuth,
    requireRole(['super_admin', 'college_admin']),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const verified = await companyRepo.verifyCompany(req.params.id, user.userId);
        if (!verified) return res.status(404).json({ error: 'Company not found.' });

        await auditRepo.record({
          tenant_id: user.tenantId,
          actor_id: user.userId,
          action: 'company.verified',
          target_type: 'company',
          target_id: verified.id
        });

        res.json({ company: verified });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
