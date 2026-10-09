import { Router, Response } from 'express';
import { AuthService } from '../../services/authService';
import { AuthenticatedRequest, createAuthMiddleware } from '../middleware/auth';

export function createAuthRoutes(authService: AuthService): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = await authService.login(email, password, clientIp);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/register', async (req, res, next) => {
    try {
      const { email, password, fullName, role, tenantSlugOrId, phone, metadata } = req.body;
      if (!email || !password || !fullName) {
        return res.status(400).json({ error: 'Email, password, and full name are required.' });
      }
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
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
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  return router;
}
