import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../services/authService';
import { UserRole } from '../../models';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
    tenantId: string;
  };
}

export function createAuthMiddleware(authService: AuthService) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = authService.verifyToken(token);
      req.user = decoded;
      next();
    } catch (err: any) {
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }
  };
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
