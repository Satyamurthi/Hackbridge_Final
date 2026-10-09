export type UserRole =
  | 'super_admin'
  | 'college_admin'
  | 'committee_member'
  | 'evaluator'
  | 'company_rep'
  | 'student'
  | 'mentor';

export type HackathonStatus =
  | 'draft'
  | 'problem_intake'
  | 'registration'
  | 'hacking'
  | 'evaluation'
  | 'completed'
  | 'archived';

export type ProblemStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'published';

export type TeamStatus = 'forming' | 'ready' | 'submitted' | 'disqualified';

export type EvaluationAssignmentStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'recused';

export type RecommendationType =
  | 'advance'
  | 'shortlist'
  | 'reject'
  | 'borderline';

export type AwardDecision =
  | 'winner'
  | 'runner_up'
  | 'second_runner_up'
  | 'top_10'
  | 'honorable_mention'
  | 'shortlisted'
  | 'participated';

export type HiringInterestType =
  | 'interview_requested'
  | 'offer_extended'
  | 'general_inquiry'
  | 'rejected';

export type HiringStatus =
  | 'pending'
  | 'contacted'
  | 'interviewing'
  | 'offered'
  | 'accepted'
  | 'declined';

export type NotificationType =
  | 'team_invite'
  | 'team_update'
  | 'submission_status'
  | 'evaluation_assigned'
  | 'evaluation_completed'
  | 'hiring_interest'
  | 'announcement'
  | 'system';

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  role: UserRole;
  tenant_id: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  metadata?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  custom_domain?: string | null;
  subdomain?: string | null;
  primary_color: string;
  secondary_color: string;
  logo_url?: string | null;
  plan: 'free' | 'starter' | 'enterprise';
  settings?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  max_score: number;
  weight: number;
}

export interface Hackathon {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  tagline?: string | null;
  description?: string | null;
  banner_url?: string | null;
  status: HackathonStatus;
  registration_start: string;
  registration_end: string;
  hacking_start: string;
  hacking_end: string;
  evaluation_start: string;
  evaluation_end: string;
  results_announced_at?: string | null;
  min_team_size: number;
  max_team_size: number;
  max_teams?: number | null;
  rules?: string | null;
  evaluation_rubric: RubricCriterion[];
  tracks: string[];
  prizes?: Record<string, any>[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  industry?: string | null;
  website?: string | null;
  logo_url?: string | null;
  description?: string | null;
  verified: boolean;
  verified_at?: string | null;
  verified_by?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProblemStatement {
  id: string;
  hackathon_id: string;
  company_id?: string | null;
  title: string;
  slug: string;
  description: string;
  track?: string | null;
  difficulty?: 'easy' | 'medium' | 'hard';
  dataset_url?: string | null;
  submission_guidelines?: string | null;
  max_teams?: number | null;
  status: ProblemStatus;
  review_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: 'leader' | 'member';
  joined_at: string;
  user?: User;
}

export interface Team {
  id: string;
  hackathon_id: string;
  name: string;
  invite_code: string;
  problem_id?: string | null;
  status: TeamStatus;
  is_open: boolean;
  max_members: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  members?: TeamMember[];
  problem_statement?: ProblemStatement | null;
}

export interface Submission {
  id: string;
  hackathon_id: string;
  team_id: string;
  problem_id?: string | null;
  submission_round: number;
  title: string;
  abstract: string;
  approach: string;
  repo_url?: string | null;
  demo_url?: string | null;
  presentation_url?: string | null;
  video_url?: string | null;
  tech_stack: string[];
  is_locked: boolean;
  lock_timestamp?: string | null;
  submitted_by: string;
  created_at: string;
  last_edited_at: string;
  ai_flags?: string[];
  ai_readiness_score?: number;
  team?: Team | null;
  problem_statement?: ProblemStatement | null;
}

export interface EvaluationAssignment {
  id: string;
  hackathon_id: string;
  evaluator_id: string;
  submission_id: string;
  round: number;
  status: EvaluationAssignmentStatus;
  assigned_at: string;
  conflict_of_interest: boolean;
  submission?: Submission;
  evaluator?: User;
}

export interface EvaluationScore {
  id: string;
  assignment_id: string;
  scores: Record<string, number>;
  total_score: number;
  normalized_score?: number;
  strengths?: string | null;
  weaknesses?: string | null;
  recommendation: RecommendationType;
  private_notes?: string | null;
  is_locked: boolean;
  scored_at: string;
}

export interface SubmissionScoreAggregate {
  submission_id: string;
  round: number;
  average_score: number;
  normalized_average: number;
  evaluator_count: number;
  score_variance: number;
  final_decision?: AwardDecision | null;
  decided_at?: string | null;
  decided_by?: string | null;
}

export interface LeaderboardEntry {
  hackathon_id: string;
  submission_id: string;
  team_id: string;
  team_name: string;
  submission_title: string;
  round: number;
  average_score: number;
  evaluator_count: number;
  rank_overall: number;
  final_decision?: AwardDecision | null;
  repo_url?: string | null;
  demo_url?: string | null;
  problem_title?: string | null;
}

export interface TalentProfile {
  id: string;
  user_id: string;
  tenant_id: string;
  headline?: string | null;
  bio?: string | null;
  skills: string[];
  github_url?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  resume_url?: string | null;
  achievements: Record<string, any>[];
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface HiringInterest {
  id: string;
  company_id: string;
  student_id: string;
  role_title: string;
  compensation_range?: string | null;
  interest_type: HiringInterestType;
  message?: string | null;
  status: HiringStatus;
  created_at: string;
  updated_at: string;
  company?: Company;
  student?: User;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  actor_id?: string | null;
  action: string;
  target_type: string;
  target_id?: string | null;
  payload?: Record<string, any>;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}
