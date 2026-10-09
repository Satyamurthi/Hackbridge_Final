import { Router, Response } from 'express';
import { NotificationRepository } from '../../repositories';
import { StorageService } from '../../services/storageService';
import { AuthenticatedRequest, createAuthMiddleware } from '../middleware/auth';
import { AuthService } from '../../services/authService';

export function createNotificationRoutes(
  notifRepo: NotificationRepository,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // User: Fetch notifications
  router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const notifications = await notifRepo.listForUser(req.user!.userId);
      res.json({ notifications });
    } catch (err) {
      next(err);
    }
  });

  // User: Mark single notification read
  router.post('/:id/read', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      await notifRepo.markAsRead(req.params.id, req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // User: Mark all read
  router.post('/read-all', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      await notifRepo.markAllAsRead(req.user!.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function createStorageRoutes(
  storageService: StorageService,
  authService: AuthService
): Router {
  const router = Router();
  const requireAuth = createAuthMiddleware(authService);

  // Authenticated file upload
  router.post('/upload', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { category, filename, base64Data, mimeType } = req.body;
      if (!category || !filename || !base64Data || !mimeType) {
        return res.status(400).json({ error: 'category, filename, base64Data, and mimeType are required.' });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const fileUrl = await storageService.saveFile(category, filename, buffer, mimeType);
      res.json({ url: fileUrl });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
