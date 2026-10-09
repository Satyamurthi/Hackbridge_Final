import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Structured server-side error logging
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [ERROR] ${req.method} ${req.originalUrl}:`, err.message || err);

  const status = err.status || err.statusCode || (err.message?.includes('not found') ? 404 : 400);

  // Fail safe in production: never expose stack traces or raw database driver errors
  res.status(status).json({
    error: err.message || 'An unexpected server error occurred.',
    timestamp
  });
}
