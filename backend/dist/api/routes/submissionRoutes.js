"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubmissionRoutes = createSubmissionRoutes;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
function createSubmissionRoutes(subService, subRepo, authService) {
    const router = (0, express_1.Router)();
    const requireAuth = (0, auth_1.createAuthMiddleware)(authService);
    // Student: Get submission for team
    router.get('/team/:teamId', requireAuth, async (req, res, next) => {
        try {
            const round = req.query.round ? parseInt(req.query.round, 10) : 1;
            const sub = await subRepo.findByTeamAndRound(req.params.teamId, round);
            res.json({ submission: sub });
        }
        catch (err) {
            next(err);
        }
    });
    // Student: Save draft
    router.post('/draft', requireAuth, (0, auth_1.requireRole)(['student', 'mentor', 'super_admin']), async (req, res, next) => {
        try {
            const user = req.user;
            const { hackathonId, teamId, title, abstract, approach, repoUrl, demoUrl, presentationUrl, videoUrl, techStack, problemId } = req.body;
            if (!hackathonId || !teamId || !title || !abstract || !approach) {
                return res.status(400).json({ error: 'hackathonId, teamId, title, abstract, and approach are required.' });
            }
            const sub = await subService.saveDraft({
                hackathon_id: hackathonId,
                team_id: teamId,
                title,
                abstract,
                approach,
                repo_url: repoUrl,
                demo_url: demoUrl,
                presentation_url: presentationUrl,
                video_url: videoUrl,
                tech_stack: techStack || [],
                problem_id: problemId,
                submitted_by: user.userId,
                tenant_id: user.tenantId
            });
            res.json({ submission: sub });
        }
        catch (err) {
            next(err);
        }
    });
    // Student: Final lock
    router.post('/:id/lock', requireAuth, (0, auth_1.requireRole)(['student', 'mentor', 'super_admin']), async (req, res, next) => {
        try {
            const user = req.user;
            const locked = await subService.lockSubmission(req.params.id, user.userId, user.tenantId);
            res.json({ submission: locked });
        }
        catch (err) {
            next(err);
        }
    });
    // Admin / Evaluator: List submissions for a hackathon
    router.get('/hackathon/:hackathonId', requireAuth, async (req, res, next) => {
        try {
            const round = req.query.round ? parseInt(req.query.round, 10) : 1;
            const list = await subRepo.listByHackathon(req.params.hackathonId, round);
            res.json({ submissions: list });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
