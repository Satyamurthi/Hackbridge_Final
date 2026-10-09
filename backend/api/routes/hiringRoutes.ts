import { Router, Response } from 'express';
import { HiringRepository, AuditRepository, NotificationRepository } from '../../repositories';
import { AuthenticatedRequest, createAuthMiddleware, requireRole } from '../middleware/auth';
import { AuthService } from '../../services/authService';

export function createHiringRoutes(
  hiringRepo: HiringRepository,
  auditRepo: AuditRepository,
  notifRepo: NotificationRepository,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // Recruiter: Send outreach inquiry / interview request to student
  router.post(
    '/outreach',
    requireAuth,
    requireRole(['company_rep', 'super_admin']),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const { companyId, studentId, roleTitle, compensationRange, interestType, message } = req.body;

        if (!companyId || !studentId || !roleTitle || !interestType) {
          return res.status(400).json({ error: 'companyId, studentId, roleTitle, and interestType are required.' });
        }

        const interest = await hiringRepo.createInterest({
          company_id: companyId,
          student_id: studentId,
          role_title: roleTitle,
          compensation_range: compensationRange,
          interest_type: interestType,
          message
        });

        await auditRepo.record({
          tenant_id: user.tenantId,
          actor_id: user.userId,
          action: 'hiring.outreach_sent',
          target_type: 'hiring_interest',
          target_id: interest.id,
          payload: { roleTitle, studentId }
        });

        // Notify student
        await notifRepo.create({
          user_id: studentId,
          title: 'New Recruiter Career Opportunity',
          message: `A recruiter has expressed interest in your portfolio for '${roleTitle}'.`,
          type: 'hiring_interest',
          link: '/student/offers'
        });

        res.status(201).json({ interest });
      } catch (err) {
        next(err);
      }
    }
  );

  // Student: View offers / career inquiries sent to me
  router.get('/student', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const list = await hiringRepo.listByStudent(req.user!.userId);
      res.json({ offers: list });
    } catch (err) {
      next(err);
    }
  });

  // Company: View all outreach candidate threads
  router.get('/company/:companyId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const list = await hiringRepo.listByCompany(req.params.companyId);
      res.json({ pipeline: list });
    } catch (err) {
      next(err);
    }
  });

  // Update status (e.g. accepted, declined, interviewing)
  router.post('/:id/status', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { status } = req.body;
      if (!status) return res.status(400).json({ error: 'status is required.' });

      const updated = await hiringRepo.updateStatus(req.params.id, status);
      res.json({ interest: updated });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function createAuditRoutes(
  auditRepo: AuditRepository,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // Admin: View tenant compliance audit trail
  router.get(
    '/logs',
    requireAuth,
    requireRole(['super_admin', 'college_admin']),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const { action, targetType, limit } = req.query;
        const logs = await auditRepo.list(user.tenantId, {
          action: action as string,
          targetType: targetType as string,
          limit: limit ? parseInt(limit as string, 10) : 100
        });
        res.json({ logs });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
