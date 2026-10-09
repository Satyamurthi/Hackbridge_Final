# HackBridge — Multi-Stakeholder Hackathon Platform

HackBridge is a multi-stakeholder hackathon platform built for engineering colleges in Karnataka. It provides a white-label SaaS foundation starting with a pilot at **Maharaja Institute of Technology Thandavapura (MITT)** and architected for expansion across universities.

---

## 📊 Implementation Status (100% Complete — All 12 Phases)

| Area | Status |
| --- | --- |
| Multi-tenant schema (`tenants`, `profiles`, `tenant_memberships`) + `user_role` enum with all 7 roles | ✅ Migration 1 |
| Supabase Auth (sign-up, sign-in, sign-out, session persistence/refresh, password recovery) | ✅ |
| Row Level Security on all three tables + security-definer helper functions | ✅ |
| Privilege-escalation protection (`role` / `tenant_id` / `is_active` are not self-editable) | ✅ Migration 2 |
| Server-side role + tenant resolution at sign-up (client metadata is never trusted) | ✅ Migration 2 |
| Tenant resolution: custom domain → subdomain → configured slug → `mitt` row | ✅ |
| White-label branding through CSS variables (`--brand-primary`, `--brand-secondary`) | ✅ |
| Role-based route guarding for all 7 roles | ✅ |
| Password reset request + completion pages (`/forgot-password`, `/reset-password`) | ✅ |
| Stakeholder dashboards | ✅ Fully operational across all 7 roles |
| `hackathons` table + `hackathon_status` lifecycle enum, tenant-scoped RLS and lifecycle guards | ✅ Migration 4 (Phase 2A) |
| College Admin console reads real hackathons from Supabase | ✅ Phase 2A |
| College Admin can create, view and edit hackathons through the UI (sections A–F, validation, slug uniqueness, lifecycle control) | ✅ Phase 2B |
| Lifecycle changes go through the database state machine only (invalid jumps rejected with a readable message) | ✅ Phase 2B |
| `companies` table + tenant-scoped RLS + company_rep register/edit + admin verify workflow | ✅ Migration 5 (Phase 2C) |
| `problem_statements` table + `problem_statement_status` enum + review state machine + RLS | ✅ Migration 6 (Phase 3A) |
| Company rep can submit/edit problem statements; admin/committee can approve/reject/publish | ✅ Phase 3A |
| Published problem statements visible to all tenant members on hackathon detail page | ✅ Phase 3A |
| `teams` & `team_members` tables + `team_status` enum + single-team & capacity guards + RLS | ✅ Migration 7 (Phase 4) |
| Student team creation, unique invite code generation, join flow, and roster management | ✅ Phase 4 |
| Student challenge directory & direct team problem statement locking | ✅ Phase 4 |
| Student Dashboard connected to real team data | ✅ Phase 4 |
| `submissions` table + URL validation + team-round unique constraint + final lock immutability guard + team status auto-sync trigger + RLS | ✅ Migration 8 (Phase 5) |
| Student multi-format submission workspace (repo, live demo, slides, video, tech stack chips, draft saving, final lock modal, and receipt) | ✅ Phase 5 |
| Student Dashboard connected to real submission status and deliverables | ✅ Phase 5 |
| AI Pre-Screening Engine (relevance, completeness, innovation scores, automated summary, anomaly flags) | ✅ Phase 6 |
| Committee AI Pre-Screening & Triage Desk (KPIs, batch screening, flags, inspection scorecard modal) | ✅ Phase 6 |
| `evaluation_assignments`, `evaluation_scores`, `submission_scores_aggregate` tables + auto-assignment sync trigger + aggregate recompute trigger + double-blind RLS | ✅ Migration 9 (Phase 7) |
| Evaluator queue desk (`/evaluator/assignments`) with double-blind masked entries, deliverable links, and filter tabs | ✅ Phase 7 |
| Dynamic rubric scoring workspace (`/evaluator/score/:id`) with hackathon rubric criteria, live weighted score, and COI recusal | ✅ Phase 7 |
| Evaluator Dashboard connected to real assignment counts and active queue | ✅ Phase 7 |
| Committee Results & Judging Matrix (`/admin/results`) with live weighted averages, score variance alerts, jury votes, and auto-assigner | ✅ Phase 7 |
| `public.leaderboard` database view + dynamic `DENSE_RANK()` + `public.finalize_hackathon_awards` RPC | ✅ Migration 10 (Phase 8) |
| Public Championship Leaderboard (`/leaderboard`) with Top-3 Podium (Gold 🥇, Silver 🥈, Bronze 🥉), real-time search, domain filter tabs, and deep project inspection modal | ✅ Phase 8 |
| Committee award finalization & official results declaration controller (`/admin/results`) | ✅ Phase 8 |
| `public.talent_profiles` table + recruiter visibility consent + skills inventory + external links + RLS | ✅ Migration 11 (Phase 9) |
| Student Talent Profile Workspace (`/student/portfolio`) with automatic awards discovery, skill adder, and recruiter consent toggle | ✅ Phase 9 |
| Public Candidate Showcase (`/portfolio/:userId`) for external sharing on LinkedIn and resumes | ✅ Phase 9 |
| `public.hiring_interests` table + recruiter outreach + student response tracking + RLS | ✅ Migration 12 (Phase 10) |
| Recruiter Candidate Scouting Desk (`/company/talent-pool`) with badge/skill filters, in-app outreach modal, and pipeline tracker | ✅ Phase 10 |
| Student Career Inquiries & Offer Desk (`/student/offers`) with accept/decline action modal and notes | ✅ Phase 10 |
| `public.audit_logs` & `public.notifications` tables + append-only trigger + RLS | ✅ Migration 13 (Phase 11) |
| Global Notification Center Bell (`NotificationBell.tsx`) in Navbar with unread badges & mark-as-read | ✅ Phase 11 |
| Institutional Audit Trail Viewer (`/admin/audit`) with action domain filters & JSON export | ✅ Phase 11 |
| Supabase Storage Buckets (`hackathon-banners`, `company-logos`, `problem-datasets`, `student-submissions`, `resumes`) + RLS | ✅ Migration 14 (Phase 12) |
| Drag-and-drop file upload dropzone (`FileUploadDropzone.tsx`) & Storage client (`storage.ts`) | ✅ Phase 12 |
| BullMQ / Redis background worker architecture interface (`backgroundJobs.ts`) | ✅ Phase 12 |
| Multi-stage production `Dockerfile`, `docker-compose.yml`, and `nginx.conf` with SPA routing & security headers | ✅ Phase 12 |

> 🏆 **100% Complete:** All 12 phases from `HackBridge.pdf` are fully implemented!

---

## 🔐 Phase 1.5 Security Hardening

1. **Profile privilege escalation is blocked in the database.**
   `public.enforce_profile_field_protection()` (a `BEFORE INSERT OR UPDATE`
   trigger on `public.profiles`) refuses any change a non-super-admin makes to
   their own `role`, `tenant_id`, `is_active`, `email` or identity columns, and
   refuses to move a profile into or out of a tenant. Self-service editing of
   `full_name`, `phone`, `avatar_url`, `metadata` and `last_login_at` still
   works, same-tenant college admins keep full management of their tenant's
   profiles, and super admins keep global access.
2. **Roles and tenants are resolved server-side at sign-up.**
   `public.handle_new_user()` accepts only self-service roles (`student`,
   `company_rep`, `evaluator`, `mentor`), validates any client-supplied
   `tenant_id` against an *active* tenant row plus that tenant's
   `require_college_email` / `allowed_email_domains` policy, and otherwise
   resolves the tenant from the verified email domain before falling back to the
   `mitt` row. It never fabricates an identifier.
3. **No placeholder tenant identifiers.** The frontend sends a `tenant_id` only
   when it came from a real `public.tenants` row (`tenantId`); if resolution
   fails the field is omitted, the database resolves it, and the UI states that
   the account will be created without a tenant assignment.
4. **Protected routes fail closed.** `ProtectedRoute` renders a configuration
   error screen in production whenever Supabase is missing or mis-configured.
   The mock-data bypass exists only in `vite dev` (`import.meta.env.DEV`, inlined
   as `false` by `vite build`), is labelled on screen, and its navigation helper
   is a no-op in production.
5. **The pilot tenant has no college-email domain (demo).** The MITT pilot row
   keeps `require_college_email = true` with `allowed_email_domains = []`. No
   college email domain is configured for this demo, so a client-supplied
   `tenant_id` is rejected in step 3b of `handle_new_user()` and the tenant is
   resolved server-side by the `mitt` slug fallback in step 3d — the tenant is
   never taken from client metadata, and no domain is invented.

---

## 🧱 Phase 2A — Hackathon Foundation (real database + lifecycle)

Migration `supabase/migrations/20260918000001_phase2a_hackathon_foundation.sql`
introduces the first real domain entity, taken from HackBridge.pdf section
*"HACKATHONS (Core entity)"* and the lifecycle defined in section *3.6 Hackathon
Module*:

- **`public.hackathon_status`** — the specification lifecycle
  `draft → problem_intake → registration → hacking → evaluation → completed → archived`.
- **`public.hackathons`** — tenant-aware table with the PDF's columns: identity
  (`slug`, `title`, `tagline`, `description`, `banner_url`), the full timeline
  (problem submission → registration → team formation → hacking → evaluation →
  results), participation configuration (`min_team_size`, `max_team_size`,
  `max_teams_per_problem`, `allow_solo`, `require_college_email`),
  `evaluation_rubric` / `evaluation_rounds` / `prizes` JSONB, `status`,
  `visibility`, `created_by`, timestamps and `UNIQUE(tenant_id, slug)`.
- **Indexes** — `idx_hackathons_tenant` and `idx_hackathons_status`
  (`tenant_id, status`), exactly as named in the PDF.
- **Guards** — `updated_at` is maintained by trigger; `created_by` is always
  derived from the authenticated session (never from client input); a hackathon
  can never be moved to another tenant; and the lifecycle state machine from the
  PDF's `validTransitions` is enforced in the database (super admins may correct
  a stuck event).
- **RLS** — tenant isolation with explicit `WITH CHECK` clauses: members of a
  tenant can read only that tenant's hackathons, college admins of that tenant
  can create/update them, super admins have global oversight, and anonymous or
  tenant-less sessions read nothing. There is deliberately no public/anonymous
  read policy and no delete policy in Phase 2A.
- **No seed data** — the migration inserts zero rows, so the admin console can
  show a genuine empty state.

The College Admin console (`/admin`) now renders a **live, read-only** panel
(`src/components/admin/TenantHackathonsPanel.tsx`) that reads
`public.hackathons` for the resolved tenant, shows the real lifecycle phase of
each event, and states plainly when the table is empty, unreachable or when
Supabase is not configured. Everywhere else the console (and the public
directory) still shows representative **sample data**, which is now labelled as
such on screen.

**Out of scope in Phase 2A (unchanged, later phases):** companies, problem
statements, teams, invitations, registrations, submissions, evaluator
assignments, scoring, leaderboards, talent pool/hiring, AI pre-screening,
notifications, background jobs, audit-log persistence and storage buckets.

---

## 🛠️ Phase 2B — College Admin hackathon workflow

**No database migration is required for Phase 2B.** Migration 4 (Phase 2A)
already provides every column the workflow writes: nothing in this phase adds,
alters or drops a table, column, policy, trigger or function.

Three routes, all inside the existing `ProtectedRoute` admin guard
(`super_admin`, `college_admin`, `committee_member`):

| Route | Purpose |
| --- | --- |
| `/admin/hackathons` | List of this tenant's hackathons, read from `public.hackathons` |
| `/admin/hackathons/new` | Create form, sections A–F |
| `/admin/hackathons/:id` | Detail, edit form and the lifecycle control |

What the admin can do:

- **Create** a hackathon: title, slug, tagline, description, banner URL, the ten
  timeline fields, team-size rules, `allow_solo`, `require_college_email`,
  evaluation rounds, rubric, prizes and visibility. It is always inserted as
  **Draft** — the same behaviour as HackBridge.pdf's `hackathonService.create`.
- **Edit** those writable columns later. `id`, `tenant_id`, `created_by`,
  `created_at` and `updated_at` are never part of an edit payload.
- **Advance the lifecycle** through `draft → problem_intake → registration →
  hacking → evaluation → completed → archived`. The status select deliberately
  allows picking an out-of-order phase too, so the database rejection can be
  demonstrated: the Phase 2A trigger refuses it and the UI shows the database's
  message (including the next allowed phase).

Security posture:

- `tenant_id` comes from `useAuth()` (the tenant row Phase 1 resolved from the
  database) and is **never** a form field; the Phase 2A RLS policy
  `is_college_admin(tenant_id)` re-checks it server-side.
- `created_by` is never sent: the Phase 2A `trg_hackathons_ownership` trigger
  derives it from `auth.uid()`.
- The UI mirrors the RLS write rule with `canManageHackathons()`
  (`college_admin` / `super_admin`). A committee member gets a read-only view,
  and the database rejects any write regardless of the UI.
- No new policy, no "authenticated can do everything" policy, no service-role
  key — the browser client still uses the publishable anon key only.

Slug handling: generated from the title (editable, with a "From title" helper),
validated against the same pattern as the Phase 2A CHECK constraint, and
pre-checked for uniqueness per tenant. If it is already taken, the next free
variant (`slug-2`, `slug-3`, …) is saved and the user is told. The database
`UNIQUE(tenant_id, slug)` constraint stays the final authority, and a `23505`
error is still surfaced as a readable message.

### ⚠️ Schema note — brief field names vs the real table

The Phase 2B brief listed columns such as `short_description`, `organizer_name`,
`organizer_email`, `organizer_phone`, `start_at`, `end_at`,
`registration_start_at`, `registration_end_at`, `problem_submission_deadline`,
`team_size_min`, `team_size_max`, `max_participants`, `participation_type`,
`participation_mode`, `location`, `eligibility` and `rules`. **None of them exist**
in the live `public.hackathons` table, in the Phase 2A migration, or in
HackBridge.pdf — verified column-by-column against the live project. Following the
project rule to report a discrepancy instead of silently redesigning the database,
Phase 2B uses the real columns and maps the brief's intent onto them:

| Brief field | Real column used |
| --- | --- |
| short description | `tagline` |
| registration start / end | `registration_opens` / `registration_closes` |
| problem submission deadline | `problem_submission_closes` |
| hackathon start / end | `hacking_starts` / `hacking_ends` |
| min / max team size | `min_team_size` / `max_team_size` |
| organizer name / email / phone, max participants, participation type / mode, location, eligibility, rules | **no column exists** — omitted rather than invented |

Adding those columns would be a schema change (a new additive migration later
than `20260918000001`) and is intentionally **not** part of Phase 2B.

### Frontend files added in Phase 2B

- `src/lib/hackathons.ts` — extended with `createHackathon`, `updateHackathon`,
  `updateHackathonStatus`, `fetchHackathonById`, `fetchTenantHackathonSlugs`,
  slug helpers, error mapping (`describeHackathonError`) and the role helpers.
- `src/lib/hackathonForm.ts` — form model: values, defaults, timezone-safe
  date/time conversion, validation and payload mapping.
- `src/components/admin/HackathonForm.tsx` — the sections A–F form.
- `src/components/admin/TenantHackathonsPanel.tsx` — upgraded from the Phase 2A
  read-only panel into the management list (Create, Refresh, View/Edit).
- `src/pages/dashboard/AdminHackathonsPage.tsx` — list / create / detail-edit
  modes plus the lifecycle control.
- `src/components/ui/Select.tsx`, `src/components/ui/Textarea.tsx` — two
  primitives matching the existing `Input` API (no new UI framework).

---

## 🏛️ Architecture Overview

HackBridge provides dedicated portals for 4 primary stakeholders:
1. **College Admin & Committee**: Lifecycle management, state machine transitions, rubric setup, conflict of interest detection, and real-time dashboard analytics.
2. **Industry Problem Setters (Companies)**: Structured challenge intake, dataset provisioning, and talent pipeline scouting.
3. **Student Innovators**: Team formation with invite codes, multi-format submissions (abstract, GitHub repo, live demo), and verified talent portfolios.
4. **Judges & Evaluators**: Structured rubric scoring across normalized weighted criteria with conflict of interest filtering.

---

## 🔒 Multi-Tenancy & Row Level Security (RLS)

- **Database-Level Isolation**: Multi-tenancy is enforced natively via PostgreSQL Row Level Security (RLS) policies and security definer functions (`get_current_user_tenant_id()`, `is_college_admin()`, `is_super_admin()`).
- **White-Label Customization**: The `tenants` table stores custom domains, subdomains, logos, and primary/secondary hex color palettes injected dynamically into CSS variables (`--brand-primary`, `--brand-secondary`).
- **Automatic Auth Sync**: A PostgreSQL trigger (`handle_new_user`) synchronizes new registrations in `auth.users` directly to `public.profiles` and `public.tenant_memberships`, resolving the role and tenant server-side. Privileged roles and arbitrary tenant ids supplied through client metadata are rejected (see *Phase 1.5 Security Hardening*).
- **Column-Level Write Protection**: A `BEFORE INSERT OR UPDATE` trigger on `public.profiles` blocks self-promotion, self tenant-hopping and self activation/deactivation even when a client bypasses the UI entirely.

---

## 📁 Repository Structure

```
├── .env.example                                      # Environment variable template
├── .gitignore                                        # Git ignore rules (protects secrets)
├── HackBridge.pdf                                    # Primary technical specification
├── index.html                                        # HTML entrypoint
├── package.json                                      # Dependencies and scripts
├── postcss.config.js                                 # PostCSS plugins
├── tailwind.config.js                                # Tailwind CSS config with brand variables
├── tsconfig.json                                     # TypeScript config
├── tsconfig.node.json                                # Vite TS node config
├── vite.config.ts                                    # Vite bundler configuration
├── supabase/
│   └── migrations/
│       ├── 20260915000001_initial_foundation.sql          # Multi-tenant schema, RLS, functions & MITT seed
│       ├── 20260916000001_phase1_5_security_hardening.sql # Phase 1.5 escalation guard + server-side signup resolution
│       ├── 20260917000001_pilot_tenant_mitt.sql           # Data-only: rename the existing pilot tenant row to MITT
│       └── 20260918000001_phase2a_hackathon_foundation.sql # Phase 2A: hackathon table, lifecycle enum, RLS & guards
└── src/
    ├── main.tsx                                      # React DOM root
    ├── App.tsx                                       # Application routing (Public & Protected)
    ├── index.css                                     # Global Tailwind directives
    ├── lib/
    │   ├── supabase.ts                               # Supabase client init + configuration gate
    │   ├── hackathons.ts                             # Lifecycle + tenant-scoped reads/writes (Phase 2A/2B)
    │   └── hackathonForm.ts                          # Phase 2B form model, validation and payload mapping
    ├── vite-env.d.ts                                 # Vite ImportMeta / environment typings
    ├── context/
    │   └── AuthContext.tsx                           # Auth & Multi-tenant state context
    ├── types/
    │   └── database.ts                               # Database schema & role interfaces
    ├── components/
    │   ├── admin/
    │   │   ├── TenantHackathonsPanel.tsx             # Live hackathon list: Create / View / Edit (Phase 2B)
    │   │   └── HackathonForm.tsx                     # Phase 2B create/edit form (sections A–F)
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx                    # Session & RBAC route guard
    │   ├── layout/
    │   │   ├── Navbar.tsx                            # Header with branding & tenant switcher
    │   │   ├── Sidebar.tsx                           # Stakeholder-adaptive sidebar
    │   │   └── AppShell.tsx                          # Base layout shell
    │   └── ui/                                       # Reusable design system primitives
    │       ├── Badge.tsx
    │       ├── Button.tsx
    │       ├── Card.tsx
    │       ├── Input.tsx
    │       ├── Select.tsx                            # Phase 2B primitive (Input-consistent API)
    │       └── Textarea.tsx                          # Phase 2B primitive (Input-consistent API)
    └── pages/
        ├── auth/
        │   ├── ForgotPasswordPage.tsx                # Password reset request
        │   ├── LoginPage.tsx                         # Sign in (+ dev-only workspace preview)
        │   ├── RegisterPage.tsx                      # Multi-role student/company/evaluator signup
        │   └── ResetPasswordPage.tsx                 # Password recovery completion (Supabase recovery session)
        ├── dashboard/
        │   ├── AdminDashboard.tsx                    # College Admin foundation console
        │   ├── AdminHackathonsPage.tsx               # Phase 2B hackathon list / create / edit + lifecycle
        │   ├── CompanyDashboard.tsx                  # Problem setter challenge manager
        │   ├── EvaluatorDashboard.tsx                # Rubric scoring & evaluation desk
        │   └── StudentDashboard.tsx                  # Team & project submission portal
        └── public/
            ├── HackathonDetailPage.tsx               # Event lifecycle & rubrics overview
            ├── HackathonsPage.tsx                    # College hackathon directory
            ├── LandingPage.tsx                       # High-impact institution landing
            ├── LeaderboardPage.tsx                   # Normalized scores & award rankings
            └── UnauthorizedPage.tsx                  # 403 Access restricted guard
```

---

## 🚀 Getting Started

### 1. Database Setup (Supabase)

Migrations are **committed but never applied automatically** — run them manually in
the **SQL Editor** of the existing HackBridge Supabase project, in filename order:

1. `supabase/migrations/20260915000001_initial_foundation.sql`
2. `supabase/migrations/20260916000001_phase1_5_security_hardening.sql`
3. `supabase/migrations/20260917000001_pilot_tenant_mitt.sql` (data-only: renames an
   existing `rvce` pilot row to `mitt`; a no-op on a freshly seeded database)
4. `supabase/migrations/20260918000001_phase2a_hackathon_foundation.sql`
   (Phase 2A: `hackathon_status` enum + tenant-scoped `hackathons` table)
5. `supabase/migrations/20260919000001_phase2c_companies_foundation.sql`
   (Phase 2C: `companies` table + company_rep RLS + admin verify workflow)
6. `supabase/migrations/20260920000001_phase3a_problem_statements.sql`
   (Phase 3A: `problem_statement_status` enum + `problem_statements` table +
   5-state review state machine + strict tenant-isolation RLS)
7. `supabase/migrations/20260921000001_phase4_teams_foundation.sql`
   (Phase 4: `team_status` enum + `teams` and `team_members` tables +
   single-team-per-hackathon trigger + capacity guards + RLS)

All scripts are idempotent (`CREATE OR REPLACE` / `IF NOT EXISTS` /
`DROP … IF EXISTS` only), so re-running them is safe. None of them drops,
truncates or resets existing tables, rows or the MITT tenant.

> ✅ **Migrations 1–4 are applied on the pilot project.** `public.hackathons` exists
> with all 31 Phase 2A columns, Row Level Security enabled and zero rows (verified
> read-only against the live project during Phase 2B), so the admin console shows a
> genuine empty state rather than sample data.
>
> ✅ **Phase 2B needs no migration at all.** It writes only to columns migration 4
> created, so there is nothing further to run in the SQL Editor.

> ⚠️ **Keep this order, and never re-run migration 1 after migration 2.**
> `20260915000001_initial_foundation.sql` also `CREATE OR REPLACE`s
> `public.handle_new_user()` with its original, unhardened body, so re-running it
> after Phase 1.5 would overwrite the server-side role whitelist and tenant
> validation for new sign-ups. If migration 1 is ever re-run, run migration 2
> again immediately afterwards.

Together they create:

- `tenants` table with the MITT pilot seed row (+ its real UUID, which the
  pilot rename migration preserves).
- `profiles` table with a foreign key to `auth.users`.
- `tenant_memberships` table.
- `user_role` enum containing all 7 roles.
- Security helper functions (`is_super_admin()`, `get_current_user_tenant_id()`, `is_college_admin()`, `get_current_user_role()`).
- Trigger `on_auth_user_created` for user onboarding (server-side role + tenant resolution).
- Trigger `trg_profiles_field_protection` blocking profile privilege escalation.
- Strict Row Level Security policies on all three tables.
- `hackathon_status` enum (`draft → problem_intake → registration → hacking →
  evaluation → completed → archived`) and the tenant-scoped `hackathons` table with
  `UNIQUE(tenant_id, slug)`, the `idx_hackathons_tenant` / `idx_hackathons_status`
  indexes, the `updated_at` / ownership / lifecycle-transition guards and
  tenant-isolation RLS policies (Phase 2A).

### 2. Supabase Auth Settings

In **Authentication → URL Configuration**:

- Set the **Site URL** to the deployed app origin.
- Add `https://<your-app-origin>/reset-password` to **Redirect URLs**, otherwise
  Supabase ignores the `redirectTo` sent by `/forgot-password` and the recovery
  link will not return to the app.

In **Authentication → Providers → Email**, either disable *Confirm email* for the
pilot or configure SMTP, so newly registered users can sign in immediately.

### 3. Frontend Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Populate `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase Project Settings (API).
3. Requires Node.js + npm, then:
   ```bash
   npm install
   npm run dev
   ```
4. Access `http://localhost:5173`.

### 4. Production Docker Deployment

HackBridge includes a multi-stage production container setup with Nginx reverse proxy:

```bash
# Build and run container with docker-compose
docker-compose up --build -d
```
The application will be served at `http://localhost:8080` with SPA routing and security headers.

---

## 🔌 Portable Backend & Database Layer (`/backend`)

HackBridge features a fully decoupled, portable backend in `/backend` allowing deployment on any standard PostgreSQL instance, AWS RDS, GCP Cloud SQL, Neon, or self-hosted database without client-side database coupling:

```
Frontend (React + Vite) ──► /api (Express + JWT) ──► Services ──► IDatabaseAdapter ──► PostgreSQL / MySQL
```

### Starting the Portable Backend
```bash
cd backend
npm install
npm run dev
```

The backend server runs on `http://localhost:4000` with the following routes:
- `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`
- `GET /api/hackathons`, `POST /api/hackathons`, `POST /api/hackathons/:id/transition`
- `GET /api/companies`, `POST /api/companies`, `POST /api/companies/:id/verify`
- `GET /api/problems`, `POST /api/problems`, `POST /api/problems/:id/review`
- `GET /api/teams/my`, `POST /api/teams/create`, `POST /api/teams/join`, `POST /api/teams/:id/problem`
- `GET /api/submissions/team/:teamId`, `POST /api/submissions/draft`, `POST /api/submissions/:id/lock`
- `GET /api/evaluations/assignments`, `POST /api/evaluations/score`, `POST /api/evaluations/auto-assign`
- `GET /api/leaderboard/:hackathonId`, `POST /api/leaderboard/:hackathonId/finalize`
- `GET /api/talent/me`, `GET /api/talent/profile/:userId`, `POST /api/talent/me`, `GET /api/talent/pool`
- `POST /api/hiring/outreach`, `GET /api/hiring/student`, `GET /api/hiring/company/:id`
- `GET /api/audit/logs`
- `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`

### Migrating to Another Database Provider
All SQL schemas and migrations are organized in `/backend/database/`:
- `schema/schema.sql` — Standard ANSI-SQL / PostgreSQL DDL
- `migrations/001` to `005` — Incremental ordered migrations
- `seed/seed_data.sql` — Initial institution and user seed dataset
- `queries/queries.sql` — Parameterized SQL query catalog

To point the frontend to this decoupled backend, set `VITE_API_BASE_URL=http://localhost:4000` in `.env`.
