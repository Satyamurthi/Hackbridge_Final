"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHiringRoutes = createHiringRoutes;
exports.createAuditRoutes = createAuditRoutes;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
function createHiringRoutes(hiringRepo, auditRepo, notifRepo, authService) {
    const router = (0, express_1.Router)();
    const requireAuth = (0, auth_1.createAuthMiddleware)(authService);
    // Recruiter: Send outreach inquiry / interview request to student
    router.post('/outreach', requireAuth, (0, auth_1.requireRole)(['company_rep', 'super_admin']), async (req, res, next) => {
        try {
            const user = req.user;
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
        }
        catch (err) {
            next(err);
        }
    });
    // Student: View offers / career inquiries sent to me
    router.get('/student', requireAuth, async (req, res, next) => {
        try {
            const list = await hiringRepo.listByStudent(req.user.userId);
            res.json({ offers: list });
        }
        catch (err) {
            next(err);
        }
    });
    // Company: View all outreach candidate threads
    router.get('/company/:companyId', requireAuth, async (req, res, next) => {
        try {
            const list = await hiringRepo.listByCompany(req.params.companyId);
            res.json({ pipeline: list });
        }
        catch (err) {
            next(err);
        }
    });
    // Update status (e.g. accepted, declined, interviewing)
    router.post('/:id/status', requireAuth, async (req, res, next) => {
        try {
            const { status } = req.body;
            if (!status)
                return res.status(400).json({ error: 'status is required.' });
            const updated = await hiringRepo.updateStatus(req.params.id, status);
            res.json({ interest: updated });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
function createAuditRoutes(auditRepo, authService) {
    const router = (0, express_1.Router)();
    const requireAuth = (0, auth_1.createAuthMiddleware)(authService);
    // Admin: View tenant compliance audit trail
    router.get('/logs', requireAuth, (0, auth_1.requireRole)(['super_admin', 'college_admin']), async (req, res, next) => {
        try {
            const user = req.user;
            const { action, targetType, limit } = req.query;
            const logs = await auditRepo.list(user.tenantId, {
                action: action,
                targetType: targetType,
                limit: limit ? parseInt(limit, 10) : 100
            });
            res.json({ logs });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
