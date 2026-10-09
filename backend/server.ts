import { createApp } from './api';
import { PostgresAdapter } from './repositories/postgresAdapter';
import { MemoryDatabaseAdapter } from './repositories/dbAdapter';
import { config } from './config';

async function bootstrap() {
  console.log(`[HackBridge Backend] Initializing service on port ${config.port} (${config.nodeEnv})...`);

  let dbAdapter;
  try {
    if (process.env.DATABASE_URL) {
      console.log(`[HackBridge Backend] Connecting to PostgreSQL at ${config.databaseUrl.replace(/:[^:@]+@/, ':****@')}...`);
      dbAdapter = new PostgresAdapter(config.databaseUrl);
    } else {
      console.log('[HackBridge Backend] DATABASE_URL not set. Running in portable in-memory mock driver mode.');
      dbAdapter = new MemoryDatabaseAdapter();
    }
  } catch (err: any) {
    console.warn('[HackBridge Backend] Database connection failed, falling back to MemoryDatabaseAdapter:', err.message);
    dbAdapter = new MemoryDatabaseAdapter();
  }

  const { app } = createApp(dbAdapter);

  const server = app.listen(config.port, () => {
    console.log(`🚀 [HackBridge Backend] Server running at http://localhost:${config.port}`);
    console.log(`📡 [HackBridge Backend] REST API available at http://localhost:${config.port}/api`);
    console.log(`🩺 [HackBridge Backend] Healthcheck at http://localhost:${config.port}/health`);
  });

  const shutdown = async () => {
    console.log('\n[HackBridge Backend] Gracefully shutting down...');
    server.close(async () => {
      await dbAdapter.close();
      console.log('[HackBridge Backend] Closed database connections. Bye!');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('[HackBridge Backend] Fatal bootstrap error:', err);
    process.exit(1);
  });
}
