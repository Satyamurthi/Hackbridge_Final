"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthRoutes = createAuthRoutes;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
function createAuthRoutes(authService) {
    const router = (0, express_1.Router)();
    const requireAuth = (0, auth_1.createAuthMiddleware)(authService);
    router.post('/login', async (req, res, next) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required.' });
            }
            const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const result = await authService.login(email, password, clientIp);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    });
    router.post('/register', async (req, res, next) => {
        try {
            const { email, password, fullName, role, tenantSlugOrId, phone, metadata } = req.body;
            if (!email || !password || !fullName) {
                return res.status(400).json({ error: 'Email, password, and full name are required.' });
            }
            const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const result = await authService.register({
                email,
                password,
                fullName,
                role,
                tenantSlugOrId,
                phone,
                metadata,
                clientIp
            });
            res.status(201).json(result);
        }
        catch (err) {
            next(err);
        }
    });
    router.get('/me', requireAuth, async (req, res) => {
        res.json({ user: req.user });
    });
    return router;
}
