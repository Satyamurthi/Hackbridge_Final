import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hackbridge',
  jwtSecret: process.env.JWT_SECRET || 'hackbridge-insecure-dev-secret-change-in-production-2026',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'mitt',
};
