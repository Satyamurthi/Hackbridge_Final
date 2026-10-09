import { Router, Response } from 'express';
import { EvaluationService } from '../../services/evaluationService';
import { EvaluationRepository } from '../../repositories';
import { AuthenticatedRequest, createAuthMiddleware, requireRole } from '../middleware/auth';
import { AuthService } from '../../services/authService';

export function createEvaluationRoutes(
  evalService: EvaluationService,
  evalRepo: EvaluationRepository,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // Evaluator: List my assigned submissions
  router.get(
    '/assignments',
    requireAuth,
    requireRole(['evaluator', 'super_admin']),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const hackathonId = req.query.hackathonId as string;
        const list = await evalRepo.listAssignmentsForEvaluator(user.userId, hackathonId);
        res.json({ assignments: list });
      } catch (err) {
        next(err);
      }
    }
  );

  // Evaluator: Submit rubric evaluation score
  router.post(
    '/score',
    requireAuth,
    requireRole(['evaluator', 'super_admin']),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const { assignmentId, scores, strengths, weaknesses, recommendation, privateNotes } = req.body;

        if (!assignmentId || !scores || !recommendation) {
          return res.status(400).json({ error: 'assignmentId, scores, and recommendation are required.' });
        }

        const score = await evalService.submitScore({
          assignmentId,
          evaluatorId: user.userId,
          scores,
          strengths,
          weaknesses,
          recommendation,
          privateNotes,
          tenantId: user.tenantId
        });

        res.json({ score });
      } catch (err) {
        next(err);
      }
    }
  );

  // Admin: Auto-assign evaluators round-robin
  router.post(
    '/auto-assign',
    requireAuth,
    requireRole(['super_admin', 'college_admin']),
    async (req: AuthenticatedRequest, res: Response, next) => {
      try {
        const user = req.user!;
        const { hackathonId, targetPerSubmission } = req.body;
        if (!hackathonId) return res.status(400).json({ error: 'hackathonId is required.' });

        const result = await evalService.autoAssignEvaluators(hackathonId, user.tenantId, targetPerSubmission || 2);
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
