
# HackBridge — Phase 3A: Problem Statements Foundation

## Background

HackBridge is a multi-stakeholder hackathon SaaS platform. The implementation has completed:

- **Phase 1** — Multi-tenant schema, Supabase Auth, RLS, 7-role system
- **Phase 1.5** — Security hardening (server-side role resolution, privilege-escalation protection)
- **Phase 2A** — Hackathon table, `hackathon_status` lifecycle enum, RLS
- **Phase 2B** — College Admin hackathon create/edit/lifecycle workflow (real Supabase data)
- **Phase 2C** — Companies table, company_rep register/edit flow, admin verification panel

**All 4 migrations are committed.** The last one (Phase 2C) may not be applied yet on the pilot.

---

## What the Spec Defines Next

After companies, the spec (section 2 "Database Schema") defines:

1. `problem_statements` — submitted by companies, approved by committee, published to students
2. `teams` + `team_members` — student team formation with invite codes
3. `submissions` — multi-format project submission
4. `evaluation_assignments` + `evaluation_scores` — rubric scoring engine
5. `talent_profiles` + `hiring_interests` — post-evaluation hiring pipeline

The current `CompanyDashboard` already has a placeholder "Problem Statements feature coming soon" section. The natural next phase is **problem statements** — the bridge between companies and students.

---

## Proposed Scope — Phase 3A

> **Phase 3A is scoped deliberately to the next logical increment only.** It delivers a complete, end-to-end problem-statement workflow without touching teams, submissions, evaluation, or hiring — all of which are still explicitly out of scope.

### What Phase 3A delivers

| Actor | Feature |
|---|---|
| **Company Rep** | Submit a problem statement to a live hackathon (`problem_intake` or later status) |
| **Company Rep** | Edit/retract a draft submission |
| **College Admin / Committee** | Review queue — approve or reject problem statements |
| **All authenticated users** | View published problem statements on the public hackathon detail page |
| **Admin Dashboard** | Sidebar link + badge count for "Problems pending review" |

### What Phase 3A explicitly does NOT do
- Team formation / invitations
- Student registration to a problem
- Submissions, evaluations, scoring, leaderboard, talent pool, hiring
- AI pre-screening (explicitly deferred in AGENTS.md)
- Supabase Storage buckets (file attachments deferred)
- Notifications / audit-log persistence

---

## User Review Required

> [!IMPORTANT]
> **Schema note:** The spec's `problem_statements` table includes columns like `datasets_provided`, `datasets_info`, `attachments` (JSONB), `tech_preferences` (text[]), `hiring_potential`, `open_positions`, and `position_description`. **Attachments require Supabase Storage** (deferred). Phase 3A will store them as metadata text fields only — no file upload widget. Text-based fields like `dataset_info` and `tech_preferences` will be included as plain text inputs. This matches the pattern used in Phase 2B/2C where missing infrastructure was explicitly noted and omitted.

> [!IMPORTANT]
> **Review flow:** The spec defines `submitted → under_review → approved → rejected → published`. Phase 3A will implement the full state machine in the database, but the UI will present it as a single admin action: **Approve** (moves to `approved` + immediately `published`) or **Reject**. A separate "under_review" transition is not exposed in the UI (committee member clicking "Review" would be a Phase 3B addition).

> [!WARNING]
> **Phase 2C migration**: The migration `20260919000001_phase2c_companies_foundation.sql` must be applied before Phase 3A is run, because `problem_statements` references `public.companies(id)`. Confirm it is applied on the Supabase pilot before running the Phase 3A migration.

---

## Open Questions

> [!NOTE]
> **Q1:** Should the problem statement form be embedded inside the existing `CompanyDashboard` page (replacing the placeholder), or on a dedicated route `/company/problems/new`? — **Recommended: dedicated route**, consistent with how Phase 2B put hackathon create on `/admin/hackathons/new`.

> [!NOTE]
> **Q2:** Should `max_teams_per_problem` from the hackathon be shown to the company rep when they submit so they can set expectations? — **Recommended: yes**, show it as read-only context.

---

## Proposed Changes

### Database (Migration 5)

#### [NEW] [`20260920000001_phase3a_problem_statements.sql`](file:///E:/MITT%20PROJECT/V2/supabase/migrations/20260920000001_phase3a_problem_statements.sql)

New migration (idempotent, additive, no seed data). Creates:

- **`problem_statement_status` enum** — `submitted | under_review | approved | rejected | published`
- **`public.problem_statements` table** — exact column set from spec section 2:
  - `id`, `hackathon_id` (FK → hackathons), `company_id` (FK → companies), `submitted_by` (FK → profiles)
  - `title`, `domain`, `difficulty` (`easy | medium | hard`)
  - `problem_description`, `expected_outcome`, `constraints`
  - `datasets_provided` (boolean), `datasets_info` (text)
  - `tech_preferences` (text[])
  - `evaluation_criteria` (text)
  - `hiring_potential` (`immediate_hire | internship | possible | none`)
  - `open_positions` (int), `position_description` (text)
  - `status` (enum, default `submitted`)
  - `review_notes` (text), `reviewed_by` (FK → profiles), `reviewed_at`
  - `published_at`
  - `created_at`, `updated_at`
  - `UNIQUE(hackathon_id, company_id)` — one problem per company per hackathon (can be relaxed later)
- **Indexes** — `idx_problem_statements_hackathon`, `idx_problem_statements_company`, `idx_problem_statements_status`
- **Guards** — `updated_at` trigger; `submitted_by` derived from `auth.uid()` on insert; `hackathon_id` and `company_id` immutable after insert; status state-machine trigger (submitted→under_review→approved/rejected→published, no skips for non-super-admins)
- **RLS** — tenant isolation via hackathon FK; company_rep can insert/update own draft; committee/admin can read all in tenant and write `status`/`review_notes`/`reviewed_by`/`reviewed_at`/`published_at`; all authenticated tenant members can read `published` rows

---

### Data Layer

#### [NEW] [`src/lib/problemStatements.ts`](file:///E:/MITT%20PROJECT/V2/src/lib/problemStatements.ts)

Mirrors `companies.ts` / `hackathons.ts` patterns:

- `fetchProblemStatementsByHackathon(tenantId, hackathonId)` — all published (for public/student view)
- `fetchProblemStatementsByCompany(tenantId, profileId)` — company rep's own submissions
- `fetchPendingReview(tenantId)` — for admin review queue (status in `submitted | under_review`)
- `createProblemStatement(tenantId, payload)` — company_rep only
- `updateProblemStatement(tenantId, id, payload)` — own draft only
- `updateProblemStatementStatus(tenantId, id, status, reviewNotes?)` — admin only
- `describeProblemStatementError(error)` — consistent error messages
- `PROBLEM_STATEMENTS_MIGRATION_FILE` constant

#### [NEW] [`src/lib/problemStatementForm.ts`](file:///E:/MITT%20PROJECT/V2/src/lib/problemStatementForm.ts)

Form model following `hackathonForm.ts` / `companyForm.ts` pattern:

- `emptyProblemStatementFormValues()` — typed default form values
- `validateProblemStatementForm(values)` — client-side validation
- `toProblemStatementInsertPayload(values, hackathonId, companyId)` — maps form → DB columns

---

### Types

#### [MODIFY] [`src/types/database.ts`](file:///E:/MITT%20PROJECT/V2/src/types/database.ts)

Add:
- `ProblemStatementStatus` union type
- `ProblemStatement` row type (exact mirror of the new table)
- `ProblemStatementWritableColumns` union
- `ProblemStatementInsertPayload` / `ProblemStatementEditPayload`
- `ProblemStatementAdminPayload` (status + review_notes + reviewed_at + published_at)
- Update `Database` interface `Tables` to include `problem_statements`

---

### Components

#### [NEW] [`src/components/admin/ProblemStatementReviewCard.tsx`](file:///E:/MITT%20PROJECT/V2/src/components/admin/ProblemStatementReviewCard.tsx)

A card for the admin review queue showing full problem detail + Approve / Reject buttons with review notes textarea.

#### [NEW] [`src/components/company/ProblemStatementForm.tsx`](file:///E:/MITT%20PROJECT/V2/src/components/company/ProblemStatementForm.tsx)

Multi-section form for companies to submit/edit problem statements:
- Section A: Title, domain, difficulty
- Section B: Problem description, expected outcome, constraints
- Section C: Dataset info (text only — no file upload in Phase 3A)
- Section D: Tech preferences, evaluation criteria
- Section E: Hiring intent (hiring_potential, open_positions, position_description)

---

### Pages

#### [NEW] [`src/pages/company/CompanyProblemsPage.tsx`](file:///E:/MITT%20PROJECT/V2/src/pages/company/CompanyProblemsPage.tsx)

Company rep's problem statement workspace:
- Lists company's existing submissions across hackathons (with status badges)
- "Submit New Problem Statement" button → shows hackathon picker + form
- Edit draft (status `submitted` only) 
- Read-only view for approved/published statements

#### [NEW] [`src/pages/admin/AdminProblemReviewPage.tsx`](file:///E:/MITT%20PROJECT/V2/src/pages/admin/AdminProblemReviewPage.tsx)

Admin review queue:
- Lists all `submitted` / `under_review` problem statements in the tenant
- Inline Approve / Reject with review notes
- Filter by hackathon
- "Real database data" badge (same pattern as `AdminCompaniesPage`)

#### [MODIFY] [`src/pages/dashboard/CompanyDashboard.tsx`](file:///E:/MITT%20PROJECT/V2/src/pages/dashboard/CompanyDashboard.tsx)

Replace the "Problem statements feature coming soon" placeholder with:
- A summary card showing count of submitted/approved/published problems (from real data)
- A "Submit Problem Statement" CTA if the company is verified
- Link to `/company/problems` for full workspace

#### [MODIFY] [`src/pages/public/HackathonDetailPage.tsx`](file:///E:/MITT%20PROJECT/V2/src/pages/public/HackathonDetailPage.tsx)

Add a "Problem Statements" section below the hackathon info that lists all `published` problem statements (real data, no longer sample).

---

### Routing & Navigation

#### [MODIFY] [`src/App.tsx`](file:///E:/MITT%20PROJECT/V2/src/App.tsx)

Add routes:
- `/company/problems` — `CompanyProblemsPage` (company_rep + super_admin)
- `/admin/problems` — `AdminProblemReviewPage` (ADMIN_ROLES)

#### [MODIFY] [`src/components/layout/Sidebar.tsx`](file:///E:/MITT%20PROJECT/V2/src/components/layout/Sidebar.tsx)

Add:
- "Problem Statements" link in company sidebar (→ `/company/problems`)
- "Problems Review" link in admin sidebar with pending-count badge (→ `/admin/problems`)

---

## Verification Plan

### Build Check
```
npm run build
```
No TypeScript errors, no unused imports.

### Manual Verification (Supabase not configured → dev mock path)
1. Company rep sees "Problem statements feature coming soon" → replaced by real workflow with "Supabase not configured" notice.
2. Admin sees new "Problems Review" sidebar link.

### Manual Verification (Supabase configured, Phase 3A migration applied)
1. College admin can navigate to `/admin/problems` and see empty state.
2. Company rep (verified company) can navigate to `/company/problems`, click "Submit", fill the form, and submit.
3. Admin sees the submission in the review queue with Approve / Reject actions.
4. Approving a problem immediately publishes it.
5. Published problem appears on the public hackathon detail page.
6. Database RLS: a company rep cannot approve their own problem (DB rejects it with a readable message).

### README Update
Update `README.md` `Implementation Status` table to add Phase 3A row and add a Phase 3A section following the Phase 2B and Phase 2C sections.
