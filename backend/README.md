# HackBridge Backend Service & Database Layer

The `/backend` service is a portable, decoupled Node.js / Express / TypeScript backend and database abstraction layer designed to run HackBridge on any standard relational database without vendor lock-in.

---

## 🏗️ Architecture Overview

The backend enforces a clean 3-tier architecture:
```
Frontend (React + Vite) ──► API Layer (Express + JWT + RBAC) ──► Domain Services ──► Repositories (SQL Abstraction) ──► PostgreSQL / MySQL / Supabase
```

### Directory Structure
```
/backend
├── package.json              # Express, JWT, bcryptjs, pg dependencies
├── tsconfig.json             # TypeScript configuration
├── server.ts                 # Server entry point & graceful shutdown
├── config/
│   └── index.ts              # Environment configuration loader
├── models/
│   └── index.ts              # Domain entities (User, Tenant, Hackathon, Team, etc.)
├── repositories/
│   ├── dbAdapter.ts          # IDatabaseAdapter interface + In-Memory Adapter
│   ├── postgresAdapter.ts    # PostgreSQL connection pool & transaction manager
│   ├── userRepository.ts     # User & profile data access
│   ├── hackathonRepository.ts# Hackathons & lifecycle queries
│   ├── teamRepository.ts     # Concurrency-safe team formation
│   ├── submissionRepository.ts # Multi-format submissions & locking
│   ├── evaluationRepository.ts # Double-blind rubric scoring
│   ├── leaderboardRepository.ts # Dynamic ranking aggregation
│   └── hiringRepository.ts   # Recruiter outreach pipeline
├── services/
│   ├── authService.ts        # PBKDF2 hashing, JWT signing, role whitelist
│   ├── hackathonService.ts   # State machine validation
│   ├── teamService.ts        # Atomic invite code joins
│   ├── submissionService.ts  # Validation & AI pre-screening triage
│   ├── aiPrescreeningService.ts # Automated heuristics & completeness analysis
│   ├── evaluationService.ts  # Weighted rubric scoring & auto-assign
│   └── storageService.ts     # File validation & secure local/disk storage
├── api/
│   ├── middleware/
│   │   ├── auth.ts           # JWT bearer token & role checks
│   │   └── errorHandler.ts   # Production error logger & safe responses
│   └── routes/
│       ├── authRoutes.ts
│       ├── hackathonRoutes.ts
│       ├── teamRoutes.ts
│       ├── submissionRoutes.ts
│       ├── evaluationRoutes.ts
│       ├── leaderboardRoutes.ts
│       ├── talentRoutes.ts
│       ├── hiringRoutes.ts
│       ├── notificationRoutes.ts
│       └── storageRoutes.ts
└── database/
    ├── schema/
    │   ├── schema.sql        # Portable ANSI-SQL / PostgreSQL DDL
    │   └── supabase_extensions.sql # Documentation of Supabase RLS & Auth differences
    ├── migrations/           # Step-by-step ordered SQL migrations (001 - 005)
    ├── seed/
    │   └── seed_data.sql     # Realistic test data (MITT pilot tenant & users)
    └── queries/
        └── queries.sql       # Canonical parameterized SQL queries
```

---

## 🚀 Running the Backend

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or run with in-memory adapter automatically if `DATABASE_URL` is omitted)

### Setup & Launch
```bash
cd backend
npm install
npm run dev
```

The server will start on `http://localhost:4000`.

### Healthcheck
```bash
curl http://localhost:4000/health
```

---

## 🔒 Security & Data Integrity

1. **Server-Side Role Protection**:
   - `AuthService.register()` rejects client attempts to self-register as `super_admin` or `college_admin`.
   - Only `student`, `company_rep`, `evaluator`, and `mentor` roles can self-register.
2. **Double-Blind Rubric Judging**:
   - Team rosters and student identities are masked in `/api/evaluations/assignments`. Evaluators evaluate anonymized entries `#SUB-XXXXXX`.
   - Once submitted, scores are permanently locked (`is_locked = true`).
3. **Atomic Team Joins**:
   - `TeamRepository.joinTeamWithCode` locks the team row (`FOR UPDATE`) to prevent capacity overflow from concurrent requests.
4. **Submission Final Lock**:
   - Once locked, submissions are immutable. Edits and draft overwrites are rejected.

---

## 🗄️ Database Portability: Migrating from Supabase to Self-Hosted Postgres / MySQL

1. Apply the migration scripts in `/backend/database/migrations/` in sequential order:
   - `001_initial_core.sql`
   - `002_hackathons_companies.sql`
   - `003_problems_teams.sql`
   - `004_submissions_evaluations.sql`
   - `005_leaderboard_talent_audit.sql`
2. Run `seed_data.sql` to populate default institution tenants and test users.
3. Configure `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/hackbridge
   JWT_SECRET=your-secure-random-32-char-secret
   ```
4. Point the frontend to the backend API:
   ```env
   VITE_API_BASE_URL=http://localhost:4000/api
   ```
