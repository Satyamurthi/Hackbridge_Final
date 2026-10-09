import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Submission,
  SubmissionWithDetails,
  SubmissionInsertPayload,
  SubmissionUpdatePayload,
} from '../types/database';

export const SUBMISSIONS_MIGRATION_FILE =
  'supabase/migrations/20260922000001_phase5_submissions_foundation.sql';

export type SubmissionErrorKind =
  | 'not_configured'
  | 'not_found'
  | 'missing_table'
  | 'locked_final'
  | 'invalid_url'
  | 'not_leader'
  | 'permission'
  | 'constraint'
  | 'network'
  | 'unknown';

export interface SubmissionErrorInfo {
  kind: SubmissionErrorKind;
  message: string;
}

interface PostgrestLikeError {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

const asErrorLike = (error: unknown): PostgrestLikeError => {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as PostgrestLikeError;
    return {
      message: typeof candidate.message === 'string' ? candidate.message : undefined,
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      details: candidate.details ?? null,
      hint: candidate.hint ?? null,
    };
  }
  return { message: typeof error === 'string' ? error : undefined };
};

export const describeSubmissionError = (error: unknown): SubmissionErrorInfo => {
  const { message, code } = asErrorLike(error);
  const text = (message ?? '').toLowerCase();

  if (code === '42P01' || text.includes('relation') && text.includes('does not exist')) {
    return {
      kind: 'missing_table',
      message: `The submissions table does not exist yet. Apply ${SUBMISSIONS_MIGRATION_FILE} in the Supabase SQL Editor.`,
    };
  }

  if (code === '23514' && (text.includes('locked as final') || text.includes('final'))) {
    return {
      kind: 'locked_final',
      message: 'This project submission has already been locked as final and cannot be modified.',
    };
  }

  if (code === '23514' && (text.includes('check') || text.includes('url'))) {
    return {
      kind: 'invalid_url',
      message: 'One or more deliverable links are invalid. Ensure URLs start with http:// or https://',
    };
  }

  if (code === '42501' || code === 'PGRST301') {
    return {
      kind: 'permission',
      message: 'You do not have permission to edit or submit this project.',
    };
  }

  if (text.includes('fetch') || text.includes('network') || text.includes('failed to fetch')) {
    return {
      kind: 'network',
      message: 'Network error. Please check your internet connection and try again.',
    };
  }

  return {
    kind: 'unknown',
    message: message ?? 'An unexpected error occurred while processing the submission.',
  };
};

export interface SubmissionResult {
  submission: SubmissionWithDetails | null;
  error: string | null;
  errorKind: SubmissionErrorKind | null;
}

/**
 * Fetch the submission for a specific team.
 */
export async function fetchTeamSubmission(
  teamId: string,
  round: number = 1
): Promise<SubmissionResult> {
  if (!isSupabaseConfigured) {
    return {
      submission: null,
      error: 'Supabase is not configured.',
      errorKind: 'not_configured',
    };
  }

  try {
    const { data: subData, error: subError } = await supabase
      .from('submissions')
      .select('*')
      .eq('team_id', teamId)
      .eq('submission_round', round)
      .maybeSingle();

    if (subError) {
      return { submission: null, error: subError.message, errorKind: 'unknown' };
    }
    if (!subData) {
      return { submission: null, error: null, errorKind: null };
    }

    const sub = subData as Submission;

    // Fetch team & problem statement for full context
    const [{ data: teamData }, { data: psData }] = await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).maybeSingle(),
      sub.problem_id
        ? supabase.from('problem_statements').select('*').eq('id', sub.problem_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const fullSubmission: SubmissionWithDetails = {
      ...sub,
      team: teamData ? ({ ...teamData, members: [] } as any) : null,
      problem_statement: psData ?? null,
    };

    return { submission: fullSubmission, error: null, errorKind: null };
  } catch (err: any) {
    return { submission: null, error: err?.message || 'Failed to fetch team submission.', errorKind: 'unknown' };
  }
}

/**
 * Save draft of a submission (inserts or updates).
 */
export async function saveSubmissionDraft(
  payload: SubmissionInsertPayload
): Promise<SubmissionResult> {
  if (!isSupabaseConfigured) {
    return {
      submission: null,
      error: 'Supabase is not configured.',
      errorKind: 'not_configured',
    };
  }

  if (!payload.title.trim()) {
    return {
      submission: null,
      error: 'Project title cannot be blank.',
      errorKind: 'constraint',
    };
  }

  if (!payload.abstract.trim()) {
    return {
      submission: null,
      error: 'Project abstract cannot be blank.',
      errorKind: 'constraint',
    };
  }

  const round = payload.submission_round ?? 1;

  try {
    // Check if draft already exists
    const { data: existing } = await supabase
      .from('submissions')
      .select('id, is_final')
      .eq('team_id', payload.team_id)
      .eq('submission_round', round)
      .maybeSingle();

    if (existing?.is_final) {
      return {
        submission: null,
        error: 'This project submission has already been locked as final and cannot be modified.',
        errorKind: 'locked_final',
      };
    }

    if (existing) {
      // Update existing
      const updateData: SubmissionUpdatePayload = {
        title: payload.title.trim(),
        abstract: payload.abstract.trim(),
        approach: payload.approach?.trim() || null,
        demo_url: payload.demo_url?.trim() || null,
        repo_url: payload.repo_url?.trim() || null,
        presentation_url: payload.presentation_url?.trim() || null,
        video_url: payload.video_url?.trim() || null,
        problem_id: payload.problem_id || null,
        tech_stack: payload.tech_stack ?? [],
      };

      const { error: updateError } = await supabase
        .from('submissions')
        .update(updateData)
        .eq('id', existing.id);

      if (updateError) throw updateError;
    } else {
      // Insert new
      const insertData = {
        team_id: payload.team_id,
        hackathon_id: payload.hackathon_id,
        problem_id: payload.problem_id || null,
        title: payload.title.trim(),
        abstract: payload.abstract.trim(),
        approach: payload.approach?.trim() || null,
        demo_url: payload.demo_url?.trim() || null,
        repo_url: payload.repo_url?.trim() || null,
        presentation_url: payload.presentation_url?.trim() || null,
        video_url: payload.video_url?.trim() || null,
        tech_stack: payload.tech_stack ?? [],
        submission_round: round,
        is_final: false,
      };

      const { error: insertError } = await supabase
        .from('submissions')
        .insert(insertData);

      if (insertError) throw insertError;
    }

    return await fetchTeamSubmission(payload.team_id, round);
  } catch (err) {
    const info = describeSubmissionError(err);
    return { submission: null, error: info.message, errorKind: info.kind };
  }
}

/**
 * Lock and finalize the submission for evaluation.
 */
export async function finalizeSubmission(
  submissionId: string,
  userId: string
): Promise<{ success: boolean; error: string | null; errorKind: SubmissionErrorKind | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase is not configured.', errorKind: 'not_configured' };
  }

  try {
    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        is_final: true,
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
      } as any)
      .eq('id', submissionId);

    if (updateError) throw updateError;
    return { success: true, error: null, errorKind: null };
  } catch (err) {
    const info = describeSubmissionError(err);
    return { success: false, error: info.message, errorKind: info.kind };
  }
}
