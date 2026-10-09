"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotificationRoutes = createNotificationRoutes;
exports.createStorageRoutes = createStorageRoutes;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
function createNotificationRoutes(notifRepo, authService) {
    const router = (0, express_1.Router)();
    const requireAuth = (0, auth_1.createAuthMiddleware)(authService);
    // User: Fetch notifications
    router.get('/', requireAuth, async (req, res, next) => {
        try {
            const notifications = await notifRepo.listForUser(req.user.userId);
            res.json({ notifications });
        }
        catch (err) {
            next(err);
        }
    });
    // User: Mark single notification read
    router.post('/:id/read', requireAuth, async (req, res, next) => {
        try {
            await notifRepo.markAsRead(req.params.id, req.user.userId);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    });
    // User: Mark all read
    router.post('/read-all', requireAuth, async (req, res, next) => {
        try {
            await notifRepo.markAllAsRead(req.user.userId);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
function createStorageRoutes(storageService, authService) {
    const router = (0, express_1.Router)();
    const requireAuth = (0, auth_1.createAuthMiddleware)(authService);
    // Authenticated file upload
    router.post('/upload', requireAuth, async (req, res, next) => {
        try {
            const { category, filename, base64Data, mimeType } = req.body;
            if (!category || !filename || !base64Data || !mimeType) {
                return res.status(400).json({ error: 'category, filename, base64Data, and mimeType are required.' });
            }
            const buffer = Buffer.from(base64Data, 'base64');
            const fileUrl = await storageService.saveFile(category, filename, buffer, mimeType);
            res.json({ url: fileUrl });
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
