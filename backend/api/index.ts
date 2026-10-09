import express from 'express';
import cors from 'cors';
import { IDatabaseAdapter } from '../repositories/dbAdapter';
import {
  UserRepository,
  TenantRepository,
  HackathonRepository,
  CompanyRepository,
  ProblemRepository,
  TeamRepository,
  SubmissionRepository,
  EvaluationRepository,
  LeaderboardRepository,
  TalentRepository,
  HiringRepository,
  AuditRepository,
  NotificationRepository
} from '../repositories';
import {
  AuthService,
  HackathonService,
  TeamService,
  SubmissionService,
  AIPrescreeningService,
  EvaluationService,
  StorageService
} from '../services';
import { createAuthRoutes } from './routes/authRoutes';
import { createHackathonRoutes, createCompanyRoutes } from './routes/hackathonRoutes';
import { createTeamRoutes, createProblemRoutes } from './routes/teamRoutes';
import { createSubmissionRoutes } from './routes/submissionRoutes';
import { createEvaluationRoutes } from './routes/evaluationRoutes';
import { createLeaderboardRoutes, createTalentRoutes } from './routes/leaderboardRoutes';
import { createHiringRoutes, createAuditRoutes } from './routes/hiringRoutes';
import { createNotificationRoutes, createStorageRoutes } from './routes/notificationRoutes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(db: IDatabaseAdapter) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Initialize Repositories
  const userRepo = new UserRepository(db);
  const tenantRepo = new TenantRepository(db);
  const hackathonRepo = new HackathonRepository(db);
  const companyRepo = new CompanyRepository(db);
  const problemRepo = new ProblemRepository(db);
  const teamRepo = new TeamRepository(db);
  const submissionRepo = new SubmissionRepository(db);
  const evalRepo = new EvaluationRepository(db);
  const leaderboardRepo = new LeaderboardRepository(db);
  const talentRepo = new TalentRepository(db);
  const hiringRepo = new HiringRepository(db);
  const auditRepo = new AuditRepository(db);
  const notifRepo = new NotificationRepository(db);

  // Initialize Services
  const authService = new AuthService(userRepo, tenantRepo, auditRepo);
  const hackathonService = new HackathonService(hackathonRepo, auditRepo);
  const teamService = new TeamService(teamRepo, hackathonRepo, problemRepo, auditRepo, notifRepo);
  const aiPrescreeningService = new AIPrescreeningService();
  const submissionService = new SubmissionService(submissionRepo, teamRepo, hackathonRepo, aiPrescreeningService, auditRepo, notifRepo);
  const evalService = new EvaluationService(evalRepo, hackathonRepo, submissionRepo, userRepo, auditRepo, notifRepo);
  const storageService = new StorageService();

  // Root healthcheck
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'hackbridge-backend',
      timestamp: new Date().toISOString()
    });
  });

  // Mount API routers
  app.use('/api/auth', createAuthRoutes(authService));
  app.use('/api/hackathons', createHackathonRoutes(hackathonService, hackathonRepo, authService));
  app.use('/api/companies', createCompanyRoutes(companyRepo, auditRepo, authService));
  app.use('/api/problems', createProblemRoutes(problemRepo, auditRepo, authService));
  app.use('/api/teams', createTeamRoutes(teamService, teamRepo, authService));
  app.use('/api/submissions', createSubmissionRoutes(submissionService, submissionRepo, authService));
  app.use('/api/evaluations', createEvaluationRoutes(evalService, evalRepo, authService));
  app.use('/api/leaderboard', createLeaderboardRoutes(leaderboardRepo, auditRepo, authService));
  app.use('/api/talent', createTalentRoutes(talentRepo, authService));
  app.use('/api/hiring', createHiringRoutes(hiringRepo, auditRepo, notifRepo, authService));
  app.use('/api/audit', createAuditRoutes(auditRepo, authService));
  app.use('/api/notifications', createNotificationRoutes(notifRepo, authService));
  app.use('/api/storage', createStorageRoutes(storageService, authService));

  // Error Handler
  app.use(errorHandler);

  return { app, authService, hackathonService, teamService, submissionService, evalService };
}
