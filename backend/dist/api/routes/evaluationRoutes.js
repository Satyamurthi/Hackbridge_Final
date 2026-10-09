"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEvaluationRoutes = createEvaluationRoutes;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
function createEvaluationRoutes(evalService, evalRepo, authService) {
    const router = (0, express_1.Router)();
    const requireAuth = (0, auth_1.createAuthMiddleware)(authService);
    // Evaluator: List my assigned submissions
    router.get('/assignments', requireAuth, (0, auth_1.requireRole)(['evaluator', 'super_admin']), async (req, res, next) => {
        try {
            const user = req.user;
            const hackathonId = req.query.hackathonId;
            const list = await evalRepo.listAssignmentsForEvaluator(user.userId, hackathonId);
            res.json({ assignments: list });
        }
        catch (err) {
            next(err);
        }
    });
    // Evaluator: Submit rubric evaluation score
    router.post('/score', requireAuth, (0, auth_1.requireRole)(['evaluator', 'super_admin']), async (req, res, next) => {
        try {
            const user = req.user;
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
        }
        catch (err) {
            next(err);
        }
    });
    // Admin: Auto-assign evaluators round-robin
    router.post('/auto-assign', requireAuth, (0, auth_1.requireRole)(['super_admin', 'college_admin']), async (req, res, next) => {
        try {
            const user = req.user;
            const { hackathonId, targetPerSubmission } = req.body;
            if (!hackathonId)
                return res.status(400).json({ error: 'hackathonId is required.' });
            const result = await evalService.autoAssignEvaluators(hackathonId, user.tenantId, targetPerSubmission || 2);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
