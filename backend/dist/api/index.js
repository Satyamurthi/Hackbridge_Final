"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const repositories_1 = require("../repositories");
const services_1 = require("../services");
const authRoutes_1 = require("./routes/authRoutes");
const hackathonRoutes_1 = require("./routes/hackathonRoutes");
const teamRoutes_1 = require("./routes/teamRoutes");
const submissionRoutes_1 = require("./routes/submissionRoutes");
const evaluationRoutes_1 = require("./routes/evaluationRoutes");
const leaderboardRoutes_1 = require("./routes/leaderboardRoutes");
const hiringRoutes_1 = require("./routes/hiringRoutes");
const notificationRoutes_1 = require("./routes/notificationRoutes");
const errorHandler_1 = require("./middleware/errorHandler");
function createApp(db) {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '50mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
    // Initialize Repositories
    const userRepo = new repositories_1.UserRepository(db);
    const tenantRepo = new repositories_1.TenantRepository(db);
    const hackathonRepo = new repositories_1.HackathonRepository(db);
    const companyRepo = new repositories_1.CompanyRepository(db);
    const problemRepo = new repositories_1.ProblemRepository(db);
    const teamRepo = new repositories_1.TeamRepository(db);
    const submissionRepo = new repositories_1.SubmissionRepository(db);
    const evalRepo = new repositories_1.EvaluationRepository(db);
    const leaderboardRepo = new repositories_1.LeaderboardRepository(db);
    const talentRepo = new repositories_1.TalentRepository(db);
    const hiringRepo = new repositories_1.HiringRepository(db);
    const auditRepo = new repositories_1.AuditRepository(db);
    const notifRepo = new repositories_1.NotificationRepository(db);
    // Initialize Services
    const authService = new services_1.AuthService(userRepo, tenantRepo, auditRepo);
    const hackathonService = new services_1.HackathonService(hackathonRepo, auditRepo);
    const teamService = new services_1.TeamService(teamRepo, hackathonRepo, problemRepo, auditRepo, notifRepo);
    const aiPrescreeningService = new services_1.AIPrescreeningService();
    const submissionService = new services_1.SubmissionService(submissionRepo, teamRepo, hackathonRepo, aiPrescreeningService, auditRepo, notifRepo);
    const evalService = new services_1.EvaluationService(evalRepo, hackathonRepo, submissionRepo, userRepo, auditRepo, notifRepo);
    const storageService = new services_1.StorageService();
    // Root healthcheck
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            service: 'hackbridge-backend',
            timestamp: new Date().toISOString()
        });
    });
    // Mount API routers
    app.use('/api/auth', (0, authRoutes_1.createAuthRoutes)(authService));
    app.use('/api/hackathons', (0, hackathonRoutes_1.createHackathonRoutes)(hackathonService, hackathonRepo, authService));
    app.use('/api/companies', (0, hackathonRoutes_1.createCompanyRoutes)(companyRepo, auditRepo, authService));
    app.use('/api/problems', (0, teamRoutes_1.createProblemRoutes)(problemRepo, auditRepo, authService));
    app.use('/api/teams', (0, teamRoutes_1.createTeamRoutes)(teamService, teamRepo, authService));
    app.use('/api/submissions', (0, submissionRoutes_1.createSubmissionRoutes)(submissionService, submissionRepo, authService));
    app.use('/api/evaluations', (0, evaluationRoutes_1.createEvaluationRoutes)(evalService, evalRepo, authService));
    app.use('/api/leaderboard', (0, leaderboardRoutes_1.createLeaderboardRoutes)(leaderboardRepo, auditRepo, authService));
    app.use('/api/talent', (0, leaderboardRoutes_1.createTalentRoutes)(talentRepo, authService));
    app.use('/api/hiring', (0, hiringRoutes_1.createHiringRoutes)(hiringRepo, auditRepo, notifRepo, authService));
    app.use('/api/audit', (0, hiringRoutes_1.createAuditRoutes)(auditRepo, authService));
    app.use('/api/notifications', (0, notificationRoutes_1.createNotificationRoutes)(notifRepo, authService));
    app.use('/api/storage', (0, notificationRoutes_1.createStorageRoutes)(storageService, authService));
    // Error Handler
    app.use(errorHandler_1.errorHandler);
    return { app, authService, hackathonService, teamService, submissionService, evalService };
}
