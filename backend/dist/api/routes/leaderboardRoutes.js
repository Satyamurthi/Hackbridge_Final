"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLeaderboardRoutes = createLeaderboardRoutes;
exports.createTalentRoutes = createTalentRoutes;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
function createLeaderboardRoutes(leaderboardRepo, auditRepo, authService) {
    const router = (0, express_1.Router)();
    const requireAuth = (0, auth_1.createAuthMiddleware)(authService);
    // Public: Live championship leaderboard
    router.get('/:hackathonId', async (req, res, next) => {
        try {
            const round = req.query.round ? parseInt(req.query.round, 10) : 1;
            const entries = await leaderboardRepo.getLeaderboard(req.params.hackathonId, round);
            res.json({ entries });
        }
        catch (err) {
            next(err);
        }
    });
    // Admin: Finalize hackathon awards & announce results
    router.post('/:hackathonId/finalize', requireAuth, (0, auth_1.requireRole)(['super_admin', 'college_admin']), async (req, res, next) => {
        try {
            const user = req.user;
            const { round, decisions } = req.body;
            if (!decisions || !Array.isArray(decisions)) {
                return res.status(400).json({ error: 'decisions array is required.' });
            }
            await leaderboardRepo.finalizeAwards(req.params.hackathonId, round || 1, decisions, user.userId);
            await auditRepo.record({
                tenant_id: user.tenantId,
                actor_id: user.userId,
                action: 'hackathon.awards_finalized',
                target_type: 'hackathon',
                target_id: req.params.hackathonId,
                payload: { count: decisions.length }
            });
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
function createTalentRoutes(talentRepo, authService) {
    const router = (0, express_1.Router)();
    const requireAuth = (0, auth_1.createAuthMiddleware)(authService);
    // Student: Get my talent profile
    router.get('/me', requireAuth, async (req, res, next) => {
        try {
            const profile = await talentRepo.findByUserId(req.user.userId);
            res.json({ profile });
        }
        catch (err) {
            next(err);
        }
    });
    // Public: View a student's verified showcase portfolio
    router.get('/profile/:userId', async (req, res, next) => {
        try {
            const profile = await talentRepo.findByUserId(req.params.userId);
            if (!profile || !profile.is_visible) {
                return res.status(404).json({ error: 'Talent portfolio not found or private.' });
            }
            res.json({ profile });
        }
        catch (err) {
            next(err);
        }
    });
    // Student: Update talent profile
    router.post('/me', requireAuth, (0, auth_1.requireRole)(['student', 'mentor', 'super_admin']), async (req, res, next) => {
        try {
            const user = req.user;
            const updated = await talentRepo.upsert({
                ...req.body,
                user_id: user.userId,
                tenant_id: user.tenantId
            });
            res.json({ profile: updated });
        }
        catch (err) {
            next(err);
        }
    });
    // Recruiter / Admin: List talent pool
    router.get('/pool', requireAuth, async (req, res, next) => {
        try {
            const list = await talentRepo.listTalentPool(req.user.tenantId);
            res.json({ candidates: list });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
