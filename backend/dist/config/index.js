"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hackbridge',
    jwtSecret: process.env.JWT_SECRET || 'hackbridge-insecure-dev-secret-change-in-production-2026',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'mitt',
};
