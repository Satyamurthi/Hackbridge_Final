import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Public & Auth Pages
import { LandingPage } from './pages/public/LandingPage';
import { HackathonsPage } from './pages/public/HackathonsPage';
import { HackathonDetailPage } from './pages/public/HackathonDetailPage';
import { LeaderboardPage } from './pages/public/LeaderboardPage';
import { UnauthorizedPage } from './pages/public/UnauthorizedPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

// Admin Pages (Phases 2C, 3A, 6, 7, 11)
import { AdminCompaniesPage } from './pages/admin/AdminCompaniesPage';
import { AdminProblemReviewPage } from './pages/admin/AdminProblemReviewPage';
import { AdminPrescreeningPage } from './pages/admin/AdminPrescreeningPage';
import { AdminResultsPage } from './pages/admin/AdminResultsPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { AdminEvaluatorsPage } from './pages/admin/AdminEvaluatorsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

// Evaluator Pages (Phase 7)
import { EvaluatorAssignmentsPage } from './pages/evaluator/EvaluatorAssignmentsPage';
import { EvaluatorScoringPage } from './pages/evaluator/EvaluatorScoringPage';

// Company Pages (Phases 2C, 3A, 10)
import { CompanyRegisterPage } from './pages/company/CompanyRegisterPage';
import { CompanyProblemsPage } from './pages/company/CompanyProblemsPage';
import { CompanyTalentPoolPage } from './pages/company/CompanyTalentPoolPage';

// Student Pages (Phases 4, 5, 9, 10)
import { StudentTeamPage } from './pages/student/StudentTeamPage';
import { StudentProblemsPage } from './pages/student/StudentProblemsPage';
import { StudentSubmissionsPage } from './pages/student/StudentSubmissionsPage';
import { StudentPortfolioPage } from './pages/student/StudentPortfolioPage';
import { StudentOffersPage } from './pages/student/StudentOffersPage';
import { PublicPortfolioPage } from './pages/public/PublicPortfolioPage';

// Stakeholder Dashboard Foundation Shells
import { AdminDashboard } from './pages/dashboard/AdminDashboard';
import { AdminHackathonsPage } from './pages/dashboard/AdminHackathonsPage';
import { StudentDashboard } from './pages/dashboard/StudentDashboard';
import { EvaluatorDashboard } from './pages/dashboard/EvaluatorDashboard';
import { CompanyDashboard } from './pages/dashboard/CompanyDashboard';
import type { UserRole } from './types/database';

/**
 * Roles allowed to open the admin workspace (Phase 2A RLS: every member of the
 * owning tenant may read; only college_admin / super_admin may write, which the
 * UI mirrors and the database enforces).
 */
const ADMIN_ROLES: UserRole[] = ['super_admin', 'college_admin', 'committee_member'];

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Layout Routes (No Sidebar) */}
          <Route element={<AppShell showSidebar={false} />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/hackathons" element={<HackathonsPage />} />
            <Route path="/hackathons/:slug" element={<HackathonDetailPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/portfolio/:userId" element={<PublicPortfolioPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
          </Route>

          {/* Stakeholder Dashboard Routes (With Sidebar & RBAC Protection) */}
          <Route element={<AppShell showSidebar={true} />}>
            {/* College Admin & Committee */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allowedRoles={['super_admin', 'college_admin', 'committee_member']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Phase 2B — College Admin hackathon workspace (real Supabase data).
                Declared after /admin/* on purpose: react-router ranks the more
                specific paths (/admin/hackathons, /new, /:id) above the wildcard. */}
            <Route
              path="/admin/hackathons"
              element={
                <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                  <AdminHackathonsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/hackathons/new"
              element={
                <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                  <AdminHackathonsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/hackathons/:hackathonId"
              element={
                <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                  <AdminHackathonsPage />
                </ProtectedRoute>
              }
            />

            {/* Student Innovator */}
            <Route
              path="/student/*"
              element={
                <ProtectedRoute allowedRoles={['student', 'mentor', 'super_admin']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />

            {/* Phase 4 — Student team & problems workspace (real Supabase data). */}
            <Route
              path="/student/team"
              element={
                <ProtectedRoute allowedRoles={['student', 'mentor', 'super_admin']}>
                  <StudentTeamPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/problems"
              element={
                <ProtectedRoute allowedRoles={['student', 'mentor', 'super_admin']}>
                  <StudentProblemsPage />
                </ProtectedRoute>
              }
            />
            {/* Phase 5 — Student project submission desk (real Supabase data). */}
            <Route
              path="/student/submissions"
              element={
                <ProtectedRoute allowedRoles={['student', 'mentor', 'super_admin']}>
                  <StudentSubmissionsPage />
                </ProtectedRoute>
              }
            />
            {/* Phase 9 — Student Verified Talent Profile Workspace (real Supabase data). */}
            <Route
              path="/student/portfolio"
              element={
                <ProtectedRoute allowedRoles={['student', 'mentor', 'super_admin']}>
                  <StudentPortfolioPage />
                </ProtectedRoute>
              }
            />
            {/* Phase 10 — Student Career Inquiries & Offer Review Desk (real Supabase data). */}
            <Route
              path="/student/offers"
              element={
                <ProtectedRoute allowedRoles={['student', 'mentor', 'super_admin']}>
                  <StudentOffersPage />
                </ProtectedRoute>
              }
            />

            {/* Evaluator / Judge Desk */}
            <Route
              path="/evaluator/*"
              element={
                <ProtectedRoute allowedRoles={['evaluator', 'super_admin']}>
                  <EvaluatorDashboard />
                </ProtectedRoute>
              }
            />
            {/* Phase 7 — Evaluator Assigned Submissions Queue (real Supabase data). */}
            <Route
              path="/evaluator/assignments"
              element={
                <ProtectedRoute allowedRoles={['evaluator', 'super_admin']}>
                  <EvaluatorAssignmentsPage />
                </ProtectedRoute>
              }
            />
            {/* Phase 7 — Evaluator Double-Blind Scoring Desk (real Supabase data). */}
            <Route
              path="/evaluator/score"
              element={
                <ProtectedRoute allowedRoles={['evaluator', 'super_admin']}>
                  <EvaluatorScoringPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evaluator/score/:assignmentId"
              element={
                <ProtectedRoute allowedRoles={['evaluator', 'super_admin']}>
                  <EvaluatorScoringPage />
                </ProtectedRoute>
              }
            />

            {/* Industry Problem Setter / Company */}
            <Route
              path="/company/*"
              element={
                <ProtectedRoute allowedRoles={['company_rep', 'super_admin']}>
                  <CompanyDashboard />
                </ProtectedRoute>
              }
            />

            {/* Phase 2C — Company registration (real Supabase data).
                Declared after /company/* on purpose: react-router ranks the more
                specific path (/company/register) above the wildcard. */}
            <Route
              path="/company/register"
              element={
                <ProtectedRoute allowedRoles={['company_rep', 'super_admin']}>
                  <CompanyRegisterPage />
                </ProtectedRoute>
              }
            />

            {/* Phase 2C — Admin companies workspace (real Supabase data). */}
            <Route
              path="/admin/companies"
              element={
                <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                  <AdminCompaniesPage />
                </ProtectedRoute>
              }
            />

            {/* Phase 3A — Admin problem statements review (real Supabase data). */}
            <Route
              path="/admin/problems"
              element={
                <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                  <AdminProblemReviewPage />
                </ProtectedRoute>
              }
            />

            {/* Phase 6 — Admin AI Pre-Screening & Triage Desk (real Supabase data). */}
            <Route
              path="/admin/prescreening"
              element={
                <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                  <AdminPrescreeningPage />
                </ProtectedRoute>
              }
            />

            {/* Phase 7 — Admin Results & Judging Matrix (real Supabase data). */}
            <Route
              path="/admin/results"
              element={
                <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                  <AdminResultsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit"
              element={
                <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                  <AdminAuditPage />
                </ProtectedRoute>
              }
            />
            {/* Admin Evaluators & Judging Panel */}
            <Route
              path="/admin/evaluators"
              element={
                <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                  <AdminEvaluatorsPage />
                </ProtectedRoute>
              }
            />
            {/* Admin Tenant Settings */}
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                  <AdminSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Phase 3A — Company problem statement workspace (real Supabase data). */}
            <Route
              path="/company/problems"
              element={
                <ProtectedRoute allowedRoles={['company_rep', 'super_admin']}>
                  <CompanyProblemsPage />
                </ProtectedRoute>
              }
            />
            {/* Phase 10 — Recruiter Candidate Scouting Desk (real Supabase data). */}
            <Route
              path="/company/talent-pool"
              element={
                <ProtectedRoute allowedRoles={['company_rep', 'super_admin']}>
                  <CompanyTalentPoolPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
