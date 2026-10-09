"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("./api");
const postgresAdapter_1 = require("./repositories/postgresAdapter");
const dbAdapter_1 = require("./repositories/dbAdapter");
const config_1 = require("./config");
async function bootstrap() {
    console.log(`[HackBridge Backend] Initializing service on port ${config_1.config.port} (${config_1.config.nodeEnv})...`);
    let dbAdapter;
    try {
        if (process.env.DATABASE_URL) {
            console.log(`[HackBridge Backend] Connecting to PostgreSQL at ${config_1.config.databaseUrl.replace(/:[^:@]+@/, ':****@')}...`);
            dbAdapter = new postgresAdapter_1.PostgresAdapter(config_1.config.databaseUrl);
        }
        else {
            console.log('[HackBridge Backend] DATABASE_URL not set. Running in portable in-memory mock driver mode.');
            dbAdapter = new dbAdapter_1.MemoryDatabaseAdapter();
        }
    }
    catch (err) {
        console.warn('[HackBridge Backend] Database connection failed, falling back to MemoryDatabaseAdapter:', err.message);
        dbAdapter = new dbAdapter_1.MemoryDatabaseAdapter();
    }
    const { app } = (0, api_1.createApp)(dbAdapter);
    const server = app.listen(config_1.config.port, () => {
        console.log(`🚀 [HackBridge Backend] Server running at http://localhost:${config_1.config.port}`);
        console.log(`📡 [HackBridge Backend] REST API available at http://localhost:${config_1.config.port}/api`);
        console.log(`🩺 [HackBridge Backend] Healthcheck at http://localhost:${config_1.config.port}/health`);
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
