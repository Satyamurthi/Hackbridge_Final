export type UserRole =
  | 'super_admin'
  | 'college_admin'
  | 'committee_member'
  | 'evaluator'
  | 'company_rep'
  | 'student'
  | 'mentor';

export interface TenantSettings {
  institution_code?: string;
  location?: string;
  max_hackathons?: number;
  max_participants?: number;
  allowed_modules?: string[];
  require_college_email?: boolean;
  allowed_email_domains?: string[];
  [key: string]: any;
}

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  custom_domain?: string | null;
  subdomain?: string | null;
  logo_url?: string | null;
  primary_color: string;
  secondary_color: string;
  plan: 'starter' | 'pro' | 'enterprise';
  plan_expires_at?: string | null;
  settings: TenantSettings;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export interface StudentMetadata {
  usn?: string;
  department?: string;
  year?: number | string;
  resume_url?: string;
  skills?: string[];
  linkedin?: string;
  github?: string;
}

export interface CompanyRepMetadata {
  company_id?: string;
  company_name?: string;
  designation?: string;
  industry?: string;
}

export interface EvaluatorMetadata {
  expertise?: string[];
  affiliation?: string;
  designation?: string;
}

export type ProfileMetadata = StudentMetadata & CompanyRepMetadata & EvaluatorMetadata & Record<string, any>;

export type Profile = {
  id: string;
  tenant_id?: string | null;
  email: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: UserRole;
  is_active: boolean;
  metadata: ProfileMetadata;
  company_id?: string | null;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type TenantMembership = {
  id: string;
  tenant_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
};

/* ------------------------------------------------------------------
 * Phase 2A — hackathon foundation (the first real domain entity).
 * Mirrors supabase/migrations/20260918000001_phase2a_hackathon_foundation.sql
 * Lifecycle terminology comes from HackBridge.pdf section 3.6.
 * ------------------------------------------------------------------ */

/** HackBridge.pdf lifecycle: draft → … → completed → archived. */
export type HackathonStatus =
  | 'draft'
  | 'problem_intake'
  | 'registration'
  | 'hacking'
  | 'evaluation'
  | 'completed'
  | 'archived';

/** HackBridge.pdf: `hackathons.visibility`. */
export type HackathonVisibility = 'public' | 'private';

/** HackBridge.pdf: `evaluation_rubric` JSONB element shape. */
export interface EvaluationRubricCriterion {
  criterion: string;
  name?: string;
  weight: number;
  description?: string;
  max_score?: number;
}

/** HackBridge.pdf: `evaluation_rounds` JSONB element shape. */
export interface EvaluationRound {
  round: number;
  name: string;
  evaluators_per_team?: number;
}

/** HackBridge.pdf: `prizes` JSONB element shape. */
export interface HackathonPrize {
  rank: number;
  amount?: number;
  description?: string;
}

/** Row shape of `public.hackathons` (Phase 2A schema). */
export type Hackathon = {
  id: string;
  tenant_id: string;
  created_by?: string | null;
  slug: string;
  title: string;
  tagline?: string | null;
  description?: string | null;
  banner_url?: string | null;
  problem_submission_opens?: string | null;
  problem_submission_closes?: string | null;
  registration_opens?: string | null;
  registration_closes?: string | null;
  team_formation_closes?: string | null;
  hacking_starts?: string | null;
  hacking_ends?: string | null;
  evaluation_starts?: string | null;
  evaluation_ends?: string | null;
  results_announced_at?: string | null;
  min_team_size: number;
  max_team_size: number;
  max_teams_per_problem: number;
  allow_solo: boolean;
  require_college_email: boolean;
  evaluation_rubric: EvaluationRubricCriterion[];
  evaluation_rounds: EvaluationRound[];
  prizes: HackathonPrize[];
  status: HackathonStatus;
  visibility: HackathonVisibility;
  created_at: string;
  updated_at: string;
};

/* ------------------------------------------------------------------
 * Phase 2C — companies foundation (the second real domain entity).
 * Mirrors supabase/migrations/20260919000001_phase2c_companies_foundation.sql
 * ------------------------------------------------------------------ */

/** Row shape of `public.companies` (Phase 2C schema). */
export type Company = {
  id: string;
  tenant_id: string;
  created_by?: string | null;
  name: string;
  website?: string | null;
  logo_url?: string | null;
  description?: string | null;
  industry?: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
};

/* ------------------------------------------------------------------
 * Phase 2C — write surface of `public.companies`.
 *
 * The Phase 2C table is the single source of truth. These types describe
 * exactly what the admin console may write, so the security columns can
 * never be part of a payload:
 *   * never writable: id, tenant_id (set once on insert), created_by
 *     (derived from auth.uid() by the Phase 2C trigger), created_at,
 *     updated_at (maintained by the Phase 2C trigger).
 *   * verified is not part of the company_rep payload: it is written only
 *     by admins (college_admin / committee_member / super_admin) through
 *     the admin companies page.
 * ------------------------------------------------------------------ */

/** Columns the company_rep form is allowed to write (Phase 2C). */
export type CompanyWritableColumns =
  | 'name'
  | 'website'
  | 'logo_url'
  | 'description'
  | 'industry';

/** The exact column set the company form produces (no tenant, no owner, no verified). */
export type CompanyWritableFields = Pick<Company, CompanyWritableColumns>;

/**
 * INSERT payload as the table accepts it. The data layer builds this by adding
 * `tenant_id` from the caller's resolved tenant row; `verified` is omitted so
 * the column default (false) applies.
 */
export type CompanyInsertPayload = CompanyWritableFields & {
  tenant_id: string;
};

/** UPDATE payload for the company_rep edit form (never verified, tenant_id, created_by). */
export type CompanyEditPayload = Partial<CompanyWritableFields>;

/** UPDATE payload for the admin verify/reject action (only verified). */
export type CompanyAdminPayload = Pick<Company, 'verified'>;

/* ------------------------------------------------------------------
 * Phase 3A — problem statements foundation.
 * Mirrors supabase/migrations/20260920000001_phase3a_problem_statements.sql
 * Review lifecycle from HackBridge.pdf section 2 "PROBLEM STATEMENTS".
 * ------------------------------------------------------------------ */

/** HackBridge.pdf review lifecycle for problem statements. */
export type ProblemStatementStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'published';

/** HackBridge.pdf: `problem_statements.difficulty`. */
export type ProblemStatementDifficulty = 'easy' | 'medium' | 'hard';

/** HackBridge.pdf: `problem_statements.hiring_potential`. */
export type HiringPotential = 'immediate_hire' | 'internship' | 'possible' | 'none';

/** Row shape of `public.problem_statements` (Phase 3A schema). */
export type ProblemStatement = {
  id: string;
  hackathon_id: string;
  company_id: string;
  submitted_by?: string | null;
  title: string;
  domain?: string | null;
  difficulty: ProblemStatementDifficulty;
  problem_description: string;
  expected_outcome?: string | null;
  constraints?: string | null;
  datasets_provided: boolean;
  datasets_info?: string | null;
  tech_preferences: string[];
  evaluation_criteria?: string | null;
  hiring_potential?: HiringPotential | null;
  open_positions: number;
  position_description?: string | null;
  status: ProblemStatementStatus;
  review_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
};

/** Columns a company_rep form is allowed to write (Phase 3A). */
export type ProblemStatementWritableColumns =
  | 'title'
  | 'domain'
  | 'difficulty'
  | 'problem_description'
  | 'expected_outcome'
  | 'constraints'
  | 'datasets_provided'
  | 'datasets_info'
  | 'tech_preferences'
  | 'evaluation_criteria'
  | 'hiring_potential'
  | 'open_positions'
  | 'position_description';

/** The exact column set the problem statement form produces (no owner, no status). */
export type ProblemStatementWritableFields = Pick<ProblemStatement, ProblemStatementWritableColumns>;

/**
 * INSERT payload. The data layer adds `hackathon_id` and `company_id`;
 * `submitted_by` is derived from auth.uid() by the Phase 3A trigger.
 */
export type ProblemStatementInsertPayload = ProblemStatementWritableFields & {
  hackathon_id: string;
  company_id: string;
};

/** UPDATE payload for the company_rep edit form (never status, owner, or parent IDs). */
export type ProblemStatementEditPayload = Partial<ProblemStatementWritableFields>;

/**
 * UPDATE payload for admin review actions (status + review_notes).
 * reviewed_by / reviewed_at / published_at are stamped by the Phase 3A trigger.
 */
export type ProblemStatementAdminPayload = {
  status: ProblemStatementStatus;
  review_notes?: string | null;
};

/* ------------------------------------------------------------------
 * Phase 2B — write surface of `public.hackathons`.
 *
 * The Phase 2A table is the single source of truth. These types describe
 * exactly what the admin console may write, so the security columns can
 * never be part of a payload:
 *   * never writable: id, tenant_id (set once on insert), created_by
 *     (derived from auth.uid() by the Phase 2A trigger), created_at,
 *     updated_at (maintained by the Phase 2A trigger).
 *   * status is not part of the edit payload: it is written only by
 *     `updateHackathonStatus`, which lets the Phase 2A state-machine
 *     trigger validate the transition.
 * ------------------------------------------------------------------ */

/** Columns the admin form is allowed to write (Phase 2B). */
export type HackathonWritableColumns =
  | 'slug'
  | 'title'
  | 'tagline'
  | 'description'
  | 'banner_url'
  | 'problem_submission_opens'
  | 'problem_submission_closes'
  | 'registration_opens'
  | 'registration_closes'
  | 'team_formation_closes'
  | 'hacking_starts'
  | 'hacking_ends'
  | 'evaluation_starts'
  | 'evaluation_ends'
  | 'results_announced_at'
  | 'min_team_size'
  | 'max_team_size'
  | 'max_teams_per_problem'
  | 'allow_solo'
  | 'require_college_email'
  | 'evaluation_rubric'
  | 'evaluation_rounds'
  | 'prizes'
  | 'visibility';

/** The exact column set the admin form produces (no tenant, no owner, no status). */
export type HackathonWritableFields = Pick<Hackathon, HackathonWritableColumns>;

/**
 * INSERT payload as the table accepts it. The data layer builds this by adding
 * `tenant_id` from the caller's resolved tenant row; `status` is omitted so the
 * column default ('draft') applies, exactly as HackBridge.pdf does.
 */
export type HackathonInsertPayload = HackathonWritableFields & {
  tenant_id: string;
};

/** UPDATE payload for the normal "Edit Hackathon" form (never status). */
export type HackathonEditPayload = Partial<HackathonWritableFields>;

/**
 * UPDATE payload accepted by the table. `status` may only be supplied by
 * `updateHackathonStatus()` so every lifecycle change passes through the
 * Phase 2A trigger `trg_hackathons_status_transition`.
 */
export type HackathonUpdatePayload = HackathonEditPayload & {
  status?: HackathonStatus;
};

/* ------------------------------------------------------------------
 * Phase 4 — student teams & registrations foundation.
 * Mirrors supabase/migrations/20260921000001_phase4_teams_foundation.sql
 * ------------------------------------------------------------------ */

export type TeamStatus =
  | 'forming'
  | 'registered'
  | 'submitted'
  | 'evaluated'
  | 'shortlisted'
  | 'rejected';

export type TeamMemberRole = 'leader' | 'member';

/** Row shape of `public.teams` (Phase 4 schema). */
export type Team = {
  id: string;
  hackathon_id: string;
  problem_id?: string | null;
  name: string;
  description?: string | null;
  invite_code: string;
  is_open: boolean;
  status: TeamStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

/** Row shape of `public.team_members` (Phase 4 schema). */
export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  joined_at: string;
};

/** TeamMember joined with profile information. */
export type TeamMemberWithProfile = TeamMember & {
  profile?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string | null;
    metadata: ProfileMetadata;
  } | null;
};

/** Full composite team object with members and optional chosen problem statement. */
export type TeamWithDetails = Team & {
  members: TeamMemberWithProfile[];
  problem_statement?: ProblemStatement | null;
  hackathon?: Pick<Hackathon, 'id' | 'title' | 'slug' | 'status' | 'min_team_size' | 'max_team_size'> | null;
};

export type TeamInsertPayload = {
  hackathon_id: string;
  name: string;
  description?: string | null;
  invite_code: string;
  is_open?: boolean;
};

export type TeamUpdatePayload = {
  name?: string;
  description?: string | null;
  problem_id?: string | null;
  is_open?: boolean;
  status?: TeamStatus;
};

export type TeamMemberInsertPayload = {
  team_id: string;
  user_id: string;
  role?: TeamMemberRole;
};

/* ------------------------------------------------------------------
 * Phase 5 — multi-format project submissions.
 * Mirrors supabase/migrations/20260922000001_phase5_submissions_foundation.sql
 * ------------------------------------------------------------------ */

export type Submission = {
  id: string;
  team_id: string;
  hackathon_id: string;
  problem_id?: string | null;
  title: string;
  abstract: string;
  approach?: string | null;
  demo_url?: string | null;
  repo_url?: string | null;
  presentation_url?: string | null;
  video_url?: string | null;
  files: Json[];
  tech_stack: string[];
  ai_summary?: string | null;
  ai_scores: Record<string, any>;
  ai_flags: string[];
  submission_round: number;
  submitted_by?: string | null;
  submitted_at: string;
  last_edited_at: string;
  is_final: boolean;
  created_at: string;
};

export type SubmissionWithDetails = Submission & {
  team?: TeamWithDetails | null;
  problem_statement?: ProblemStatement | null;
  hackathon?: Hackathon | null;
};

export type SubmissionInsertPayload = {
  team_id: string;
  hackathon_id: string;
  problem_id?: string | null;
  title: string;
  abstract: string;
  approach?: string | null;
  demo_url?: string | null;
  repo_url?: string | null;
  presentation_url?: string | null;
  video_url?: string | null;
  files?: Json[];
  tech_stack?: string[];
  submission_round?: number;
  is_final?: boolean;
};

export type SubmissionUpdatePayload = Partial<{
  problem_id: string | null;
  title: string;
  abstract: string;
  approach: string | null;
  demo_url: string | null;
  repo_url: string | null;
  presentation_url: string | null;
  video_url: string | null;
  files: Json[];
  tech_stack: string[];
  is_final: boolean;
}>;

/* ------------------------------------------------------------------
 * Phase 7 — double-blind evaluation engine & rubric scoring.
 * Mirrors supabase/migrations/20260923000001_phase7_evaluation_foundation.sql
 * ------------------------------------------------------------------ */

export type EvaluationAssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'recused';
export type EvaluationRecommendation = 'advance' | 'reject' | 'borderline';
export type EvaluationFinalDecision = 'advanced' | 'rejected' | 'waitlisted' | 'winner';

export type EvaluationAssignment = {
  id: string;
  submission_id: string;
  evaluator_id: string;
  round: number;
  assigned_at: string;
  due_at?: string | null;
  completed_at?: string | null;
  status: EvaluationAssignmentStatus;
};

export type EvaluationScore = {
  id: string;
  assignment_id: string;
  submission_id: string;
  evaluator_id: string;
  round: number;
  scores: Record<string, number>;
  total_score?: number | null;
  weighted_score?: number | null;
  strengths?: string | null;
  weaknesses?: string | null;
  recommendation?: EvaluationRecommendation | null;
  private_notes?: string | null;
  public_feedback?: string | null;
  coi_declared: boolean;
  coi_reason?: string | null;
  submitted_at: string;
};

export type SubmissionScoresAggregate = {
  id: string;
  submission_id: string;
  round: number;
  avg_score?: number | null;
  weighted_avg?: number | null;
  score_variance?: number | null;
  evaluator_count: number;
  criterion_averages: Record<string, number>;
  rank_in_problem?: number | null;
  rank_overall?: number | null;
  advance_votes: number;
  reject_votes: number;
  borderline_votes: number;
  final_decision?: EvaluationFinalDecision | null;
  decided_by?: string | null;
  decided_at?: string | null;
  computed_at: string;
};

export type EvaluationAssignmentWithDetails = EvaluationAssignment & {
  submission: SubmissionWithDetails;
  existing_score?: EvaluationScore | null;
};

/* ------------------------------------------------------------------
 * Phase 8 — dynamic live leaderboards & award determinations.
 * Mirrors supabase/migrations/20260924000001_phase8_leaderboard_foundation.sql
 * ------------------------------------------------------------------ */

export type AwardTier =
  | 'winner'
  | 'runner_up'
  | 'second_runner_up'
  | 'top_10'
  | 'shortlisted'
  | 'honorable_mention'
  | 'participant';

export type LeaderboardEntry = {
  hackathon_id: string;
  tenant_id: string;
  hackathon_title: string;
  hackathon_slug: string;
  hackathon_status: HackathonStatus;
  results_announced_at?: string | null;

  submission_id: string;
  submission_title: string;
  submission_abstract: string;
  submission_approach?: string | null;
  demo_url?: string | null;
  repo_url?: string | null;
  presentation_url?: string | null;
  video_url?: string | null;
  tech_stack?: string[] | null;
  submitted_at: string;

  team_id: string;
  team_name: string;
  team_status: TeamStatus;

  problem_id?: string | null;
  problem_title?: string | null;
  problem_domain?: string | null;
  problem_difficulty?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  company_logo_url?: string | null;

  round: number;
  score: number | null;
  avg_score: number | null;
  score_variance: number | null;
  evaluator_count: number;
  advance_votes: number;
  reject_votes: number;
  borderline_votes: number;
  criterion_averages: Record<string, number>;
  final_decision?: string | null;
  decided_at?: string | null;

  rank_overall: number;
  rank_in_problem: number;
}

/* ------------------------------------------------------------------
 * Phase 9 — student talent pool & verified portfolios.
 * Mirrors supabase/migrations/20260925000001_phase9_talent_profiles_foundation.sql
 * ------------------------------------------------------------------ */

export type TalentBadge =
  | 'winner'
  | 'runner_up'
  | 'second_runner_up'
  | 'top_10'
  | 'shortlisted'
  | 'participant';

export type JobTypePreference =
  | 'full_time'
  | 'internship'
  | 'part_time'
  | 'contract';

export interface TalentAchievement {
  hackathon_id: string;
  hackathon_title: string;
  hackathon_slug: string;
  team_name: string;
  project_title: string;
  rank_overall: number;
  badge: TalentBadge;
  date: string;
}

export type TalentProfile = {
  id: string;
  user_id: string;
  tenant_id: string;
  hackathon_id?: string | null;
  team_id?: string | null;
  headline?: string | null;
  bio?: string | null;
  overall_rank?: number | null;
  percentile?: number | null;
  badge: TalentBadge;
  achievements: TalentAchievement[];
  skills: string[];
  github_url?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  resume_url?: string | null;
  available_from?: string | null;
  looking_for: JobTypePreference[];
  preferred_location: string[];
  is_visible: boolean;
  consent_given_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type TalentProfileInsertPayload = Omit<
  TalentProfile,
  'id' | 'created_at' | 'updated_at'
>;

export type TalentProfileUpdatePayload = Partial<
  Omit<TalentProfile, 'id' | 'user_id' | 'tenant_id' | 'created_at' | 'updated_at'>
>;

/* ------------------------------------------------------------------
 * Phase 10 — hiring pipeline & recruiter portal foundation.
 * Mirrors supabase/migrations/20260926000001_phase10_hiring_pipeline_foundation.sql
 * ------------------------------------------------------------------ */

export type HiringInterestType =
  | 'shortlisted'
  | 'interview_requested'
  | 'offer_made'
  | 'hired';

export type StudentHiringResponse = 'pending' | 'accepted' | 'declined';

export type HiringInterest = {
  id: string;
  company_id: string;
  talent_profile_id: string;
  expressed_by: string;
  interest_type: HiringInterestType;
  role_title: string;
  message?: string | null;
  compensation_range?: string | null;
  student_response: StudentHiringResponse;
  student_notes?: string | null;
  responded_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type HiringInterestInsertPayload = Omit<
  HiringInterest,
  'id' | 'created_at' | 'updated_at' | 'student_response' | 'student_notes' | 'responded_at'
> & {
  student_response?: StudentHiringResponse;
  student_notes?: string | null;
};

export type HiringInterestUpdatePayload = Partial<
  Pick<HiringInterest, 'interest_type' | 'role_title' | 'message' | 'compensation_range' | 'student_response' | 'student_notes' | 'responded_at'>
>;

/* ------------------------------------------------------------------
 * Phase 11 — persistent audit logging & notification center foundation.
 * Mirrors supabase/migrations/20260927000001_phase11_audit_and_notifications_foundation.sql
 * ------------------------------------------------------------------ */

export type AuditLog = {
  id: string;
  tenant_id: string;
  actor_id?: string | null;
  action: string;
  target_type: string;
  target_id?: string | null;
  details: Record<string, any>;
  ip_address?: string | null;
  created_at: string;
};

export type AuditLogInsertPayload = Omit<AuditLog, 'id' | 'created_at'>;

export type NotificationType =
  | 'team_invite'
  | 'submission_confirmed'
  | 'evaluation_assigned'
  | 'awards_announced'
  | 'hiring_interest'
  | 'general';

export type AppNotification = {
  id: string;
  user_id: string;
  tenant_id: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
};

export type NotificationInsertPayload = Omit<
  AppNotification,
  'id' | 'created_at' | 'is_read' | 'read_at'
> & {
  is_read?: boolean;
  read_at?: string | null;
};

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * Supabase schema envelope consumed by `createClient<Database>()`.
 *
 * NOTE (Phase 2B): the row shapes above are declared as `type` aliases rather
 * than `interface`s on purpose. The installed supabase-js release constrains
 * each table entry to `Record<string, unknown>`, and TypeScript only gives
 * *type aliases* an implicit index signature. With `interface` rows the whole
 * schema failed that constraint, so postgrest resolved every table (and every
 * write payload) to `never`. The members are unchanged — only the declaration
 * form differs — so existing code is unaffected and inserts/updates are now
 * typed from the real Phase 2A columns.
 */
export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: Tenant;
        Insert: Partial<Tenant> & { slug: string; name: string };
        Update: Partial<Tenant>;
        // Required by supabase-js >= 2.43 GenericTable; harmless on older 2.x.
        Relationships: never[];
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; email: string; full_name: string };
        Update: Partial<Profile>;
        Relationships: never[];
      };
      tenant_memberships: {
        Row: TenantMembership;
        Insert: { tenant_id: string; user_id: string; role: UserRole };
        Update: Partial<TenantMembership>;
        Relationships: never[];
      };
      /** Phase 2A/2B — real hackathon entity (tenant-scoped, RLS protected). */
      hackathons: {
        Row: Hackathon;
        Insert: HackathonInsertPayload;
        Update: HackathonUpdatePayload;
        Relationships: never[];
      };
      /** Phase 2C — real company entity (tenant-scoped, RLS protected). */
      companies: {
        Row: Company;
        Insert: CompanyInsertPayload;
        Update: CompanyEditPayload | CompanyAdminPayload;
        Relationships: never[];
      };
      /** Phase 3A — real problem statement entity (hackathon-scoped, RLS protected). */
      problem_statements: {
        Row: ProblemStatement;
        Insert: ProblemStatementInsertPayload;
        Update: ProblemStatementEditPayload | ProblemStatementAdminPayload;
        Relationships: never[];
      };
      /** Phase 4 — real student teams (hackathon-scoped, RLS protected). */
      teams: {
        Row: Team;
        Insert: TeamInsertPayload;
        Update: TeamUpdatePayload;
        Relationships: never[];
      };
      /** Phase 4 — real team members (team-scoped, RLS protected). */
      team_members: {
        Row: TeamMember;
        Insert: TeamMemberInsertPayload;
        Update: Partial<TeamMember>;
        Relationships: never[];
      };
      /** Phase 5 — real project submissions (team-scoped, RLS protected). */
      submissions: {
        Row: Submission;
        Insert: SubmissionInsertPayload;
        Update: SubmissionUpdatePayload;
        Relationships: never[];
      };
      /** Phase 7 — real evaluation assignments (evaluator-scoped, RLS protected). */
      evaluation_assignments: {
        Row: EvaluationAssignment;
        Insert: Omit<EvaluationAssignment, 'id' | 'assigned_at'>;
        Update: Partial<EvaluationAssignment>;
        Relationships: never[];
      };
      /** Phase 7 — real evaluation rubric scores (evaluator-scoped, RLS protected). */
      evaluation_scores: {
        Row: EvaluationScore;
        Insert: Omit<EvaluationScore, 'id' | 'submitted_at'>;
        Update: Partial<EvaluationScore>;
        Relationships: never[];
      };
      /** Phase 7 — real aggregated submission scores (tenant-scoped, RLS protected). */
      submission_scores_aggregate: {
        Row: SubmissionScoresAggregate;
        Insert: Omit<SubmissionScoresAggregate, 'id' | 'computed_at'>;
        Update: Partial<SubmissionScoresAggregate>;
        Relationships: never[];
      };
      /** Phase 9 — real student talent profiles (student-managed, recruiter RLS). */
      talent_profiles: {
        Row: TalentProfile;
        Insert: TalentProfileInsertPayload;
        Update: TalentProfileUpdatePayload;
        Relationships: never[];
      };
      /** Phase 10 — real hiring interests (recruiter outreach, student response). */
      hiring_interests: {
        Row: HiringInterest;
        Insert: HiringInterestInsertPayload;
        Update: HiringInterestUpdatePayload;
        Relationships: never[];
      };
      /** Phase 11 — real audit logs (tenant-scoped, immutable, admin RLS). */
      audit_logs: {
        Row: AuditLog;
        Insert: AuditLogInsertPayload;
        Update: never;
        Relationships: never[];
      };
      /** Phase 11 — real notifications (user-scoped, in-app alerts). */
      notifications: {
        Row: AppNotification;
        Insert: NotificationInsertPayload;
        Update: Partial<Pick<AppNotification, 'is_read' | 'read_at'>>;
        Relationships: never[];
      };
    };
    Views: {
      leaderboard: {
        Row: LeaderboardEntry;
        Relationships: never[];
      };
    };
    Functions: {
      get_current_user_role: {
        Args: Record<string, never>;
        Returns: UserRole;
      };
      get_current_user_tenant_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_super_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_college_admin: {
        Args: { target_tenant_id: string };
        Returns: boolean;
      };
      finalize_hackathon_awards: {
        Args: {
          p_hackathon_id: string;
          p_round: number;
          p_decisions: Array<{ submission_id: string; final_decision: string }>;
        };
        Returns: {
          success: boolean;
          hackathon_id: string;
          updated_count: number;
          results_announced_at: string;
        };
      };
    };
    Enums: {
      user_role: UserRole;
      /** Phase 2A lifecycle enum (public.hackathon_status). */
      hackathon_status: HackathonStatus;
      /** Phase 3A review lifecycle enum (public.problem_statement_status). */
      problem_statement_status: ProblemStatementStatus;
      /** Phase 4 team lifecycle enum (public.team_status). */
      team_status: TeamStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

