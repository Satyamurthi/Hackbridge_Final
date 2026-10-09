# HackBridge — Agent Instructions

Multi-stakeholder hackathon SaaS platform. React + Vite frontend, Supabase
(Postgres + Auth + RLS) backend, Tailwind CSS. Pilot tenant: MITT (Maharaja
Institute of Technology Thandavapura). Architected for multi-university
white-label expansion.

Current phase: **Phase 12 complete (100% Full Specification Parity Achieved)**.
All 12 phases from `HackBridge.pdf` are implemented: multi-tenant core, server-side RBAC,
hackathon lifecycle, corporate verification, problem statement workflow, student team formation,
multi-format submissions & AI pre-screening, double-blind rubric evaluation, live championship
leaderboard, student talent portfolios, industry recruiter outreach pipeline, persistent immutable
audit logs, in-app notification center, and Supabase Storage buckets + production Docker infrastructure.
See memory.md and README.md at project root for full status, transaction ledger,
and the milestone roadmap. Read them before making any change, as they are the
source of truth for what is "real" vs "sample data" in the UI.

## Hard rules — do not violate these

1. **Never re-run `20260915000001_initial_foundation.sql` after
   `20260916000001_phase1_5_security_hardening.sql` has been applied.**
   Migration 1 does `CREATE OR REPLACE` on `handle_new_user()` with its
   original, unhardened body and would silently remove the server-side
   role whitelist and tenant validation added in Phase 1.5. If it is ever
   re-run, migration 2 (`phase1_5_security_hardening.sql`) must be re-run
   immediately after.
2. **Migrations are committed but never applied automatically.** Never
   write code that tries to auto-run SQL migrations against Supabase.
   They are run manually, in filename order, in the Supabase SQL Editor.
   Migrations 1–14 are already created; 1–4 are live on the pilot project.
3. **`role`, `tenant_id`, `is_active`, `email` and identity columns on
   `profiles` are never client-editable**, even by the owning user. This
   is enforced by the `enforce_profile_field_protection()` trigger. Don't
   add UI or API code that writes these fields directly from client
   input — role/tenant changes must go through super-admin paths only.
4. **Never fabricate or accept a client-supplied `tenant_id`.** The
   frontend only sends `tenantId` when it came from a real
   `public.tenants` row; otherwise the field is omitted and the database
   resolves the tenant server-side (verified email domain → `mitt`
   fallback). Do not "helpfully" default a tenant_id in new code.
5. **Hackathon and problem statement lifecycles are enforced in the database**
   (`hackathons`: `draft → problem_intake → registration → hacking → evaluation →
   completed → archived`; `problem_statements`: `submitted → under_review →
   approved/rejected → published`). Don't add client-side logic that allows
   skipping states — invalid jumps must surface the database's rejection
   message, not be prevented or silently reordered client-side.
6. **`ProtectedRoute` must fail closed in production.** If Supabase is
   missing/misconfigured, it renders a configuration error screen. The
   mock-data bypass only exists in `vite dev` (`import.meta.env.DEV`) and
   must compile out of production builds — never weaken this gate.
7. **All 12 Phases are backed by real database tables & storage buckets.**
   Hackathons, Companies, Problem Statements, Teams, Submissions, AI Triage,
   Double-Blind Evaluations, Leaderboard Standings, Talent Profiles, Hiring Interests,
   Audit Logs, Notifications, and Storage Buckets all read/write real Supabase assets.

## Out of scope

All requirements from HackBridge.pdf are completed. Future university white-label tenants
follow the same migration sequence.

## Where things live

- `memory.md` — master system memory, transaction ledger & halfway roadmap
- `supabase/migrations/` — SQL migrations, applied manually and in order
- `src/lib/hackathons.ts` — hackathon lifecycle + tenant-scoped reads/writes
- `src/lib/hackathonForm.ts` — Phase 2B hackathon form model & validation
- `src/lib/companies.ts` — Phase 2C company reads, edits & admin verify
- `src/lib/problemStatements.ts` — Phase 3A problem statement intake & review
- `src/lib/teams.ts` — Phase 4 student team formation & registration queries
- `src/lib/submissions.ts` — Phase 5 student project submissions & draft saving
- `src/lib/aiPrescreening.ts` — Phase 6 AI pre-screening heuristic pipeline & batch runner
- `src/lib/evaluations.ts` — Phase 7 double-blind scoring & score aggregation
- `src/lib/leaderboard.ts` — Phase 8 dynamic leaderboard & awards queries
- `src/lib/talentProfiles.ts` — Phase 9 student talent profiles & verified awards scanner
- `src/lib/hiringPipeline.ts` — Phase 10 recruiter outreach & student offers data layer
- `src/lib/auditAndNotifications.ts` — Phase 11 persistent audit logging & notification center data layer
- `src/lib/storage.ts` — Phase 12 Supabase Storage buckets, file validation & asset upload pipeline
- `src/lib/backgroundJobs.ts` — Phase 12 BullMQ / Redis background worker queue architecture
- `src/components/ui/FileUploadDropzone.tsx` — Phase 12 drag-and-drop file upload component
- `src/components/layout/NotificationBell.tsx` — Phase 11 global notification center bell
- `Dockerfile`, `docker-compose.yml`, `nginx.conf` — Phase 12 production containerization & SPA proxy
- `src/components/admin/TenantHackathonsPanel.tsx` — live hackathon list (real data)
- `src/components/admin/HackathonForm.tsx` — Phase 2B create/edit form
- `src/components/admin/CompanyForm.tsx` — Phase 2C company form
- `src/components/admin/ProblemStatementReviewCard.tsx` — Phase 3A review card
- `src/pages/public/LeaderboardPage.tsx` — Phase 8 championship podium & public leaderboard (real data)
- `src/pages/public/PublicPortfolioPage.tsx` — Phase 9 public verified candidate showcase (real data)
- `src/pages/admin/AdminPrescreeningPage.tsx` — Phase 6 AI pre-screening & triage console
- `src/pages/admin/AdminResultsPage.tsx` — Phase 7 & 8 judging matrix & award deliberation
- `src/pages/admin/AdminAuditPage.tsx` — Phase 11 institutional compliance audit trail viewer
- `src/pages/company/CompanyTalentPoolPage.tsx` — Phase 10 recruiter candidate scouting & outreach desk
- `src/pages/student/StudentTeamPage.tsx` — Phase 4 student team creation & invite code desk
- `src/pages/student/StudentProblemsPage.tsx` — Phase 4 challenge selection desk
- `src/pages/student/StudentSubmissionsPage.tsx` — Phase 5 & 6 deliverables & AI readiness desk
- `src/pages/student/StudentPortfolioPage.tsx` — Phase 9 verified credentials & portfolio desk
- `src/pages/student/StudentOffersPage.tsx` — Phase 10 student career opportunities & offers desk
- `src/pages/evaluator/EvaluatorAssignmentsPage.tsx` — Phase 7 evaluator assignment queue desk
- `src/pages/evaluator/EvaluatorScoringPage.tsx` — Phase 7 double-blind rubric scoring workspace
- `src/components/auth/ProtectedRoute.tsx` — session + RBAC guard, fail-closed
- `src/context/AuthContext.tsx` — auth + multi-tenant state
- `src/types/database.ts` — schema/role types

## Working style

- Match the existing idempotent-migration style (`CREATE OR REPLACE`,
  `IF NOT EXISTS`, `DROP … IF EXISTS` only) for any new SQL — never a
  destructive migration.
- Keep RLS `WITH CHECK` clauses explicit; no policy should implicitly
  allow cross-tenant reads/writes.
- `created_by` and similar ownership columns are always derived from the
  authenticated session server-side, never trusted from client input.
