"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthMiddleware = createAuthMiddleware;
exports.requireRole = requireRole;
function createAuthMiddleware(authService) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = authService.verifyToken(token);
            req.user = decoded;
            next();
        }
        catch (err) {
            return res.status(401).json({ error: 'Invalid or expired session token.' });
        }
    };
}
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required.' });
        }
        // Super admin has universal override
        if (req.user.role === 'super_admin') {
            return next();
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Forbidden: Access restricted. Role '${req.user.role}' is not authorized for this resource.`
            });
        }
        next();
    };
}
