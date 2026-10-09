import { supabase, isSupabaseConfigured } from './supabase';
import type {
  EvaluationScore,
  SubmissionScoresAggregate,
  EvaluationAssignmentWithDetails,
  EvaluationRecommendation,
  SubmissionWithDetails,
  Hackathon,
  EvaluationRubricCriterion,
} from '../types/database';

export const EVALUATION_MIGRATION_FILE =
  'supabase/migrations/20260923000001_phase7_evaluation_foundation.sql';

export interface ScoreSubmissionPayload {
  assignment_id: string;
  submission_id: string;
  evaluator_id: string;
  round: number;
  scores: Record<string, number>;
  rubric: EvaluationRubricCriterion[];
  strengths?: string | null;
  weaknesses?: string | null;
  recommendation?: EvaluationRecommendation | null;
  private_notes?: string | null;
  public_feedback?: string | null;
}

export interface EvaluatorDashboardStats {
  totalAssigned: number;
  completedCount: number;
  pendingCount: number;
  recusedCount: number;
}

/**
 * Calculate total and weighted score from criterion scores and rubric weights.
 */
export function calculateWeightedScores(
  scores: Record<string, number>,
  rubric: EvaluationRubricCriterion[]
): { totalScore: number; weightedScore: number } {
  let total = 0;
  let weighted = 0;
  let totalWeight = 0;

  for (const criterion of rubric) {
    const key = criterion.criterion || criterion.name || '';
    const rawScore = scores[key] ?? 0;
    const maxScore = criterion.max_score || 10;
    const normalizedScore = (rawScore / maxScore) * 10; // Normalized to 10
    const weight = criterion.weight || 0;

    total += rawScore;
    weighted += (normalizedScore * weight) / 100;
    totalWeight += weight;
  }

  // If weights don't sum to 100, normalize by total weight
  const finalWeighted = totalWeight > 0 ? (weighted / (totalWeight / 100)) : total;

  return {
    totalScore: Number(total.toFixed(2)),
    weightedScore: Number(finalWeighted.toFixed(2)),
  };
}

/**
 * Fetch all assignments for a specific evaluator, optionally filtered by hackathon.
 * Masks personal team details for double-blind judging integrity.
 */
export async function fetchEvaluatorAssignments(
  evaluatorId: string,
  hackathonId?: string
): Promise<{ assignments: EvaluationAssignmentWithDetails[]; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { assignments: [], error: 'Supabase is not configured.' };
  }

  try {
    let query = supabase
      .from('evaluation_assignments')
      .select('*')
      .eq('evaluator_id', evaluatorId)
      .order('assigned_at', { ascending: false });

    const { data: rawAssignments, error: aErr } = await query;
    if (aErr) throw aErr;
    if (!rawAssignments || rawAssignments.length === 0) {
      return { assignments: [], error: null };
    }

    const subIds = rawAssignments.map((a) => a.submission_id);

    // Fetch submissions
    const { data: subs, error: sErr } = await supabase
      .from('submissions')
      .select('*')
      .in('id', subIds);

    if (sErr) throw sErr;

    // Filter by hackathon if provided
    const filteredSubs = (subs ?? []).filter((s) => !hackathonId || s.hackathon_id === hackathonId);
    const validSubIds = new Set(filteredSubs.map((s) => s.id));
    const activeAssignments = rawAssignments.filter((a) => validSubIds.has(a.submission_id));

    // Fetch existing scores for these assignments
    const assignIds = activeAssignments.map((a) => a.id);
    const { data: scores } = await supabase
      .from('evaluation_scores')
      .select('*')
      .in('assignment_id', assignIds);

    const scoreMap = new Map((scores ?? []).map((sc) => [sc.assignment_id, sc as EvaluationScore]));

    // Fetch problem statements
    const problemIds = Array.from(new Set(filteredSubs.map((s) => s.problem_id).filter((id): id is string => Boolean(id))));
    const { data: problems } = problemIds.length > 0
      ? await supabase.from('problem_statements').select('*').in('id', problemIds)
      : { data: [] };

    const problemMap = new Map((problems ?? []).map((p) => [p.id, p]));
    const subMap = new Map(filteredSubs.map((s) => [s.id, s]));

    const result: EvaluationAssignmentWithDetails[] = activeAssignments.map((assignment) => {
      const sub = subMap.get(assignment.submission_id)!;
      const problem = sub.problem_id ? problemMap.get(sub.problem_id) : null;

      // Anonymize team details for double-blind judging
      const anonymizedSubmission: SubmissionWithDetails = {
        ...sub,
        team: {
          id: sub.team_id,
          hackathon_id: sub.hackathon_id,
          name: `Entry #SUB-${sub.id.substring(0, 6).toUpperCase()}`, // Masked team name
          invite_code: '******',
          status: 'submitted',
          is_open: false,
          created_at: sub.created_at,
          updated_at: sub.last_edited_at,
          members: [], // Hidden roster
        },
        problem_statement: problem ?? null,
      };

      return {
        ...assignment,
        submission: anonymizedSubmission,
        existing_score: scoreMap.get(assignment.id) ?? null,
      };
    });

    return { assignments: result, error: null };
  } catch (err: any) {
    return { assignments: [], error: err?.message || 'Failed to fetch assignments.' };
  }
}

/**
 * Fetch a single assignment detail with the hackathon's real configured rubric.
 */
export async function fetchAssignmentDetail(
  assignmentId: string
): Promise<{
  assignment: EvaluationAssignmentWithDetails | null;
  hackathon: Hackathon | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    const { MOCK_EVALUATOR_ASSIGNMENTS, MOCK_HACKATHONS } = await import('./mockData');
    const matched = MOCK_EVALUATOR_ASSIGNMENTS.find((a) => a.id === assignmentId) || MOCK_EVALUATOR_ASSIGNMENTS[0];
    return {
      assignment: matched,
      hackathon: MOCK_HACKATHONS[0],
      error: null,
    };
  }

  try {
    const { data: assignment, error: aErr } = await supabase
      .from('evaluation_assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();

    if (aErr || !assignment) throw aErr || new Error('Assignment not found.');

    const [{ data: sub }, { data: existingScore }] = await Promise.all([
      supabase.from('submissions').select('*').eq('id', assignment.submission_id).single(),
      supabase.from('evaluation_scores').select('*').eq('assignment_id', assignmentId).maybeSingle(),
    ]);

    if (!sub) throw new Error('Submission not found.');

    const [{ data: problem }, { data: hackathon }] = await Promise.all([
      sub.problem_id
        ? supabase.from('problem_statements').select('*').eq('id', sub.problem_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('hackathons').select('*').eq('id', sub.hackathon_id).single(),
    ]);

    const anonymizedSubmission: SubmissionWithDetails = {
      ...sub,
      team: {
        id: sub.team_id,
        hackathon_id: sub.hackathon_id,
        name: `Entry #SUB-${sub.id.substring(0, 6).toUpperCase()}`,
        invite_code: '******',
        status: 'submitted',
        is_open: false,
        created_at: sub.created_at,
        updated_at: sub.last_edited_at,
        members: [],
      },
      problem_statement: problem ?? null,
    };

    return {
      assignment: {
        ...assignment,
        submission: anonymizedSubmission,
        existing_score: existingScore ?? null,
      },
      hackathon: hackathon ?? null,
      error: null,
    };
  } catch (err: any) {
    return {
      assignment: null,
      hackathon: null,
      error: err?.message || 'Failed to load assignment details.',
    };
  }
}

/**
 * Submit or update an evaluation rubric score.
 */
export async function submitEvaluationScore(
  payload: ScoreSubmissionPayload
): Promise<{ success: boolean; score: EvaluationScore | null; error: string | null }> {
  const { totalScore, weightedScore } = calculateWeightedScores(payload.scores, payload.rubric);

  if (!isSupabaseConfigured) {
    const mockScore: EvaluationScore = {
      id: `score-${Date.now()}`,
      assignment_id: payload.assignment_id,
      submission_id: payload.submission_id,
      evaluator_id: payload.evaluator_id,
      round: payload.round,
      scores: payload.scores,
      total_score: totalScore,
      weighted_score: weightedScore,
      strengths: payload.strengths?.trim() || null,
      weaknesses: payload.weaknesses?.trim() || null,
      recommendation: payload.recommendation || null,
      private_notes: payload.private_notes?.trim() || null,
      public_feedback: payload.public_feedback?.trim() || null,
      coi_declared: false,
      coi_reason: null,
      submitted_at: new Date().toISOString(),
    };
    return { success: true, score: mockScore, error: null };
  }

  try {
    const scoreRow = {
      assignment_id: payload.assignment_id,
      submission_id: payload.submission_id,
      evaluator_id: payload.evaluator_id,
      round: payload.round,
      scores: payload.scores,
      total_score: totalScore,
      weighted_score: weightedScore,
      strengths: payload.strengths?.trim() || null,
      weaknesses: payload.weaknesses?.trim() || null,
      recommendation: payload.recommendation || null,
      private_notes: payload.private_notes?.trim() || null,
      public_feedback: payload.public_feedback?.trim() || null,
      coi_declared: false,
      coi_reason: null,
    };

    const { data: saved, error: saveErr } = await supabase
      .from('evaluation_scores')
      .upsert(scoreRow, { onConflict: 'assignment_id' })
      .select('*')
      .single();

    if (saveErr) throw saveErr;

    return { success: true, score: saved as EvaluationScore, error: null };
  } catch (err: any) {
    return { success: false, score: null, error: err.message || 'Failed to submit evaluation score.' };
  }
}

/**
 * Declare Conflict of Interest (COI) and recuse judge from evaluating the submission.
 */
export async function declareConflictOfInterest(
  assignmentId: string,
  submissionId: string,
  evaluatorId: string,
  round: number,
  reason: string
): Promise<{ success: boolean; error: string | null }> {
  if (!reason.trim()) {
    return { success: false, error: 'A valid reason for recusal is required.' };
  }

  if (!isSupabaseConfigured) {
    return { success: true, error: null };
  }

  if (!reason.trim()) {
    return { success: false, error: 'A valid reason for recusal is required.' };
  }

  try {
    const coiRow = {
      assignment_id: assignmentId,
      submission_id: submissionId,
      evaluator_id: evaluatorId,
      round,
      scores: {},
      total_score: 0,
      weighted_score: 0,
      coi_declared: true,
      coi_reason: reason.trim(),
    };

    const { error: coiErr } = await supabase
      .from('evaluation_scores')
      .upsert(coiRow, { onConflict: 'assignment_id' });

    if (coiErr) throw coiErr;

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to submit recusal.' };
  }
}

/**
 * Fetch all submission score aggregates for the Committee Results Matrix.
 */
export async function fetchHackathonEvaluationResults(
  hackathonId: string,
  round: number = 1
): Promise<{ results: any[]; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { results: [], error: 'Supabase is not configured.' };
  }

  try {
    // 1. Fetch submissions for this hackathon
    const { data: subs, error: sErr } = await supabase
      .from('submissions')
      .select('id, team_id, problem_id, title, abstract, is_final, submitted_at')
      .eq('hackathon_id', hackathonId)
      .eq('is_final', true);

    if (sErr || !subs || subs.length === 0) {
      const { MOCK_LEADERBOARD } = await import('./mockData');
      const mockResults = MOCK_LEADERBOARD.map((item) => ({
        submission_id: item.submission_id,
        title: item.submission_title,
        team_name: item.team_name,
        problem_title: item.problem_title,
        domain: item.problem_domain,
        submitted_at: item.submitted_at,
        avg_score: item.avg_score,
        weighted_avg: (item.score ?? 0) / 10,
        score_variance: item.score_variance,
        evaluator_count: item.evaluator_count,
        advance_votes: item.advance_votes,
        reject_votes: item.reject_votes,
        borderline_votes: item.borderline_votes,
        final_decision: item.final_decision,
      }));
      return { results: mockResults, error: null };
    }

    const subIds = subs.map((s) => s.id);
    const teamIds = subs.map((s) => s.team_id).filter((id): id is string => Boolean(id));
    const problemIds = subs.map((s) => s.problem_id).filter((id): id is string => Boolean(id));

    // 2. Fetch aggregates, teams, and problem statements in parallel
    const [{ data: aggregates }, { data: teams }, { data: problems }] = await Promise.all([
      supabase.from('submission_scores_aggregate').select('*').in('submission_id', subIds).eq('round', round),
      supabase.from('teams').select('id, name, status').in('id', teamIds),
      supabase.from('problem_statements').select('id, title, domain').in('id', problemIds),
    ]);

    const aggMap = new Map((aggregates ?? []).map((a) => [a.submission_id, a as SubmissionScoresAggregate]));
    const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));
    const probMap = new Map((problems ?? []).map((p) => [p.id, p]));

    const combined = subs.map((s) => {
      const agg = aggMap.get(s.id);
      return {
        submission_id: s.id,
        title: s.title,
        team_name: teamMap.get(s.team_id)?.name || 'Unknown Team',
        problem_title: s.problem_id ? probMap.get(s.problem_id)?.title : 'Open Innovation',
        domain: s.problem_id ? probMap.get(s.problem_id)?.domain : 'General',
        submitted_at: s.submitted_at,
        avg_score: agg?.avg_score ?? null,
        weighted_avg: agg?.weighted_avg ?? null,
        score_variance: agg?.score_variance ?? null,
        evaluator_count: agg?.evaluator_count ?? 0,
        advance_votes: agg?.advance_votes ?? 0,
        reject_votes: agg?.reject_votes ?? 0,
        borderline_votes: agg?.borderline_votes ?? 0,
        final_decision: agg?.final_decision ?? null,
      };
    });

    // Sort by weighted average descending
    combined.sort((a, b) => (b.weighted_avg ?? 0) - (a.weighted_avg ?? 0));

    return { results: combined, error: null };
  } catch (err: any) {
    return { results: [], error: err.message || 'Failed to fetch evaluation results.' };
  }
}

/**
 * Helper to auto-assign evaluators in the tenant to finalized submissions evenly.
 */
export async function autoAssignEvaluators(
  hackathonId: string,
  tenantId: string,
  evaluatorsPerSubmission: number = 2,
  round: number = 1
): Promise<{ success: boolean; assignedCount: number; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, assignedCount: 0, error: 'Supabase is not configured.' };
  }

  try {
    // 1. Fetch eligible evaluators in this tenant
    const { data: evaluators, error: eErr } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .eq('role', 'evaluator');

    if (eErr) throw eErr;
    if (!evaluators || evaluators.length === 0) {
      return { success: false, assignedCount: 0, error: 'No evaluator profiles found in this college tenant.' };
    }

    // 2. Fetch finalized submissions for this hackathon
    const { data: subs, error: sErr } = await supabase
      .from('submissions')
      .select('id')
      .eq('hackathon_id', hackathonId)
      .eq('is_final', true);

    if (sErr) throw sErr;
    if (!subs || subs.length === 0) {
      return { success: false, assignedCount: 0, error: 'No finalized submissions available to assign.' };
    }

    // 3. Create round-robin assignments
    const assignmentsToInsert: any[] = [];
    let evalIdx = 0;

    for (const sub of subs) {
      for (let i = 0; i < Math.min(evaluatorsPerSubmission, evaluators.length); i++) {
        const evaluator = evaluators[(evalIdx + i) % evaluators.length];
        assignmentsToInsert.push({
          submission_id: sub.id,
          evaluator_id: evaluator.id,
          round,
          status: 'pending',
        });
      }
      evalIdx++;
    }

    const { error: insErr } = await supabase
      .from('evaluation_assignments')
      .upsert(assignmentsToInsert, { onConflict: 'submission_id,evaluator_id,round' });

    if (insErr) throw insErr;

    return { success: true, assignedCount: assignmentsToInsert.length, error: null };
  } catch (err: any) {
    return { success: false, assignedCount: 0, error: err.message || 'Auto-assignment failed.' };
  }
}
