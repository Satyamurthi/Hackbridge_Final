import { Router, Response } from 'express';
import { TeamService } from '../../services/teamService';
import { TeamRepository, ProblemRepository, AuditRepository } from '../../repositories';
import { AuthenticatedRequest, createAuthMiddleware, requireRole } from '../middleware/auth';
import { AuthService } from '../../services/authService';

export function createTeamRoutes(
  teamService: TeamService,
  teamRepo: TeamRepository,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // Student: Get my team for a hackathon
  router.get('/my', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const hackathonId = req.query.hackathonId as string;
      if (!hackathonId) return res.status(400).json({ error: 'hackathonId is required.' });

      const team = await teamRepo.findUserTeam(hackathonId, req.user!.userId);
      res.json({ team });
    } catch (err) {
      next(err);
    }
  });

  // Student: Create new team
  router.post(
    '/create',
    requireAuth,
    requireRole(['student', 'mentor', 'super_admin']),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const { hackathonId, name } = req.body;
        if (!hackathonId || !name) {
          return res.status(400).json({ error: 'hackathonId and name are required.' });
        }
        const team = await teamService.createTeam(hackathonId, name, user.userId, user.tenantId);
        res.status(201).json({ team });
      } catch (err) {
        next(err);
      }
    }
  );

  // Student: Join team with invite code (concurrency safe)
  router.post(
    '/join',
    requireAuth,
    requireRole(['student', 'mentor', 'super_admin']),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const { hackathonId, inviteCode } = req.body;
        if (!hackathonId || !inviteCode) {
          return res.status(400).json({ error: 'hackathonId and inviteCode are required.' });
        }
        const team = await teamService.joinTeamWithCode(hackathonId, inviteCode, user.userId, user.tenantId);
        res.json({ team });
      } catch (err) {
        next(err);
      }
    }
  );

  // Student: Select problem statement challenge
  router.post(
    '/:id/problem',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const { problemId } = req.body;
        if (!problemId) return res.status(400).json({ error: 'problemId is required.' });

        const team = await teamService.selectProblem(req.params.id, problemId, user.userId, user.tenantId);
        res.json({ team });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

export function createProblemRoutes(
  problemRepo: ProblemRepository,
  auditRepo: AuditRepository,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // Public: List problems for a hackathon
  router.get('/', async (req, res, next) => {
    try {
      const hackathonId = req.query.hackathonId as string;
      const status = req.query.status as any;
      if (!hackathonId) return res.status(400).json({ error: 'hackathonId query param is required.' });

      const list = await problemRepo.listByHackathon(hackathonId, status);
      res.json({ problemStatements: list });
    } catch (err) {
      next(err);
    }
  });

  // Company: Submit new problem statement
  router.post(
    '/',
    requireAuth,
    requireRole(['company_rep', 'super_admin', 'college_admin']),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const { hackathonId, companyId, title, description, track, difficulty, datasetUrl, submissionGuidelines } = req.body;

        if (!hackathonId || !title || !description) {
          return res.status(400).json({ error: 'hackathonId, title, and description are required.' });
        }

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const created = await problemRepo.create({
          hackathon_id: hackathonId,
          company_id: companyId || null,
          title,
          slug,
          description,
          track,
          difficulty: difficulty || 'medium',
          dataset_url: datasetUrl || null,
          submission_guidelines: submissionGuidelines || null,
          status: 'submitted',
          created_by: user.userId
        });

        await auditRepo.record({
          tenant_id: user.tenantId,
          actor_id: user.userId,
          action: 'problem_statement.submitted',
          target_type: 'problem_statement',
          target_id: created.id,
          payload: { title: created.title }
        });

        res.status(201).json({ problemStatement: created });
      } catch (err) {
        next(err);
      }
    }
  );

  // Admin: Review problem statement (Approve / Reject)
  router.post(
    '/:id/review',
    requireAuth,
    requireRole(['super_admin', 'college_admin', 'committee_member']),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const { status, reviewNotes } = req.body;
        if (!status || !['approved', 'rejected', 'published'].includes(status)) {
          return res.status(400).json({ error: "status must be 'approved', 'rejected', or 'published'." });
        }

        const updated = await problemRepo.updateReview(req.params.id, status, reviewNotes || '', user.userId);
        if (!updated) return res.status(404).json({ error: 'Problem statement not found.' });

        await auditRepo.record({
          tenant_id: user.tenantId,
          actor_id: user.userId,
          action: `problem_statement.${status}`,
          target_type: 'problem_statement',
          target_id: updated.id,
          payload: { status, reviewNotes }
        });

        res.json({ problemStatement: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
