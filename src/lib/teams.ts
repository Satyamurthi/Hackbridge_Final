import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Team,
  TeamWithDetails,
  TeamMemberWithProfile,
  ProblemStatement,
} from '../types/database';

export const TEAMS_MIGRATION_FILE =
  'supabase/migrations/20260921000001_phase4_teams_foundation.sql';

export type TeamErrorKind =
  | 'not_configured'
  | 'no_hackathon'
  | 'not_found'
  | 'missing_table'
  | 'duplicate_name'
  | 'already_in_team'
  | 'capacity_reached'
  | 'team_closed'
  | 'permission'
  | 'constraint'
  | 'network'
  | 'unknown';

export interface TeamErrorInfo {
  kind: TeamErrorKind;
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

export const describeTeamError = (error: unknown): TeamErrorInfo => {
  const { message, code } = asErrorLike(error);
  const text = (message ?? '').toLowerCase();

  if (code === '42P01' || text.includes('relation') && text.includes('does not exist')) {
    return {
      kind: 'missing_table',
      message: `The teams table does not exist yet. Apply ${TEAMS_MIGRATION_FILE} in the Supabase SQL Editor.`,
    };
  }

  if (code === '23505') {
    if (text.includes('teams_hackathon_name_unique') || text.includes('name')) {
      return {
        kind: 'duplicate_name',
        message: 'A team with this name already exists in this hackathon. Choose a different name.',
      };
    }
    if (text.includes('invite_code')) {
      return {
        kind: 'constraint',
        message: 'A collision occurred with the invite code. Please try again.',
      };
    }
    if (text.includes('team_members_team_user_unique')) {
      return {
        kind: 'already_in_team',
        message: 'You are already registered in this team.',
      };
    }
  }

  if (code === '23514' || text.includes('already a member of team')) {
    return {
      kind: 'already_in_team',
      message: message ?? 'You already belong to a team in this hackathon. Leave your current team first.',
    };
  }

  if (text.includes('maximum size limit') || text.includes('capacity')) {
    return {
      kind: 'capacity_reached',
      message: message ?? 'This team has already reached its maximum participant limit.',
    };
  }

  if (code === '42501' || code === 'PGRST301') {
    return {
      kind: 'permission',
      message: 'You do not have permission to perform this team operation.',
    };
  }

  if (text.includes('fetch') || text.includes('network') || text.includes('failed to fetch')) {
    return {
      kind: 'network',
      message: 'Network error. Please check your connection and try again.',
    };
  }

  return {
    kind: 'unknown',
    message: message ?? 'An unexpected error occurred while managing the team.',
  };
};

/**
 * Generate a clean, unique alphanumeric invite code (e.g., MITT-8X4K).
 */
export function generateInviteCode(prefix: string = 'MITT'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'HB';
  return `${cleanPrefix}-${code}`;
}

export interface TeamResult {
  team: TeamWithDetails | null;
  error: string | null;
  errorKind: TeamErrorKind | null;
}

export interface TeamListResult {
  teams: Team[];
  error: string | null;
  errorKind: TeamErrorKind | null;
}

/**
 * Fetch the active team for a specific student in a specific hackathon.
 */
export async function fetchMyTeam(
  hackathonId: string,
  userId: string
): Promise<TeamResult> {
  if (!isSupabaseConfigured || !userId) {
    const { MOCK_TEAMS } = await import('./mockData');
    return {
      team: MOCK_TEAMS[0],
      error: null,
      errorKind: null,
    };
  }

  try {
    // 1. Find the user's membership for this hackathon
    const { data: membershipData, error: memError } = await supabase
      .from('team_members')
      .select('team_id, role, joined_at')
      .eq('user_id', userId);

    if (memError) {
      return { team: null, error: memError.message, errorKind: 'unknown' };
    }
    if (!membershipData || membershipData.length === 0) {
      return { team: null, error: null, errorKind: null };
    }

    const teamIds = membershipData.map((m) => m.team_id);

    // 2. Find which team belongs to this hackathon
    const { data: teamRows, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .in('id', teamIds)
      .eq('hackathon_id', hackathonId)
      .limit(1);

    if (teamError) {
      return { team: null, error: teamError.message, errorKind: 'unknown' };
    }
    if (!teamRows || teamRows.length === 0) {
      return { team: null, error: null, errorKind: null };
    }

    const team = teamRows[0] as Team;

    // 3. Fetch all team members for this team with profile info
    const { data: allMembers, error: membersError } = await supabase
      .from('team_members')
      .select('id, team_id, user_id, role, joined_at')
      .eq('team_id', team.id)
      .order('joined_at', { ascending: true });

    if (membersError) throw membersError;

    // 4. Fetch profiles for all members
    const memberUserIds = (allMembers ?? []).map((m) => m.user_id);
    let memberProfiles: Record<string, any> = {};

    if (memberUserIds.length > 0) {
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, metadata')
        .in('id', memberUserIds);

      if (!profError && profiles) {
        memberProfiles = profiles.reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    const enrichedMembers: TeamMemberWithProfile[] = (allMembers ?? []).map((m) => ({
      ...m,
      role: m.role as 'leader' | 'member',
      profile: memberProfiles[m.user_id] ?? null,
    }));

    // 5. Fetch chosen problem statement if selected
    let problemStatement: ProblemStatement | null = null;
    if (team.problem_id) {
      const { data: psData } = await supabase
        .from('problem_statements')
        .select('*')
        .eq('id', team.problem_id)
        .maybeSingle();

      if (psData) {
        problemStatement = psData as ProblemStatement;
      }
    }

    // 6. Fetch parent hackathon basic configuration
    const { data: hackathonData } = await supabase
      .from('hackathons')
      .select('id, title, slug, status, min_team_size, max_team_size')
      .eq('id', hackathonId)
      .maybeSingle();

    const fullTeam: TeamWithDetails = {
      ...team,
      members: enrichedMembers,
      problem_statement: problemStatement,
      hackathon: hackathonData ?? null,
    };

    return { team: fullTeam, error: null, errorKind: null };
  } catch (err) {
    const info = describeTeamError(err);
    return { team: null, error: info.message, errorKind: info.kind };
  }
}

/**
 * Fetch team info by invite code for previewing before joining.
 */
export async function fetchTeamByInviteCode(
  inviteCode: string
): Promise<TeamResult> {
  if (!isSupabaseConfigured) {
    return {
      team: null,
      error: 'Supabase is not configured.',
      errorKind: 'not_configured',
    };
  }

  const cleanCode = inviteCode.trim().toUpperCase();
  if (!cleanCode) {
    return {
      team: null,
      error: 'Please enter a valid invite code.',
      errorKind: 'constraint',
    };
  }

  try {
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('invite_code', cleanCode)
      .maybeSingle();

    if (teamError || !teamData) {
      return {
        team: null,
        error: `No team found with invite code "${cleanCode}".`,
        errorKind: 'not_found',
      };
    }

    const team = teamData as Team;

    // Fetch members count & parent hackathon
    const [{ data: members }, { data: hackathonData }] = await Promise.all([
      supabase
        .from('team_members')
        .select('id, team_id, user_id, role, joined_at')
        .eq('team_id', team.id),
      supabase
        .from('hackathons')
        .select('id, title, slug, status, min_team_size, max_team_size')
        .eq('id', team.hackathon_id)
        .maybeSingle(),
    ]);

    const fullTeam: TeamWithDetails = {
      ...team,
      members: (members ?? []).map((m) => ({
        ...m,
        role: m.role as 'leader' | 'member',
        profile: null,
      })),
      hackathon: hackathonData ?? null,
    };

    return { team: fullTeam, error: null, errorKind: null };
  } catch (err) {
    const info = describeTeamError(err);
    return { team: null, error: info.message, errorKind: info.kind };
  }
}

/**
 * Create a new team. The database trigger automatically adds the creator as team leader.
 */
export async function createTeam(
  hackathonId: string,
  name: string,
  description?: string,
  slugPrefix: string = 'MITT'
): Promise<TeamResult> {
  if (!isSupabaseConfigured) {
    return {
      team: null,
      error: 'Supabase is not configured.',
      errorKind: 'not_configured',
    };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return {
      team: null,
      error: 'Team name cannot be blank.',
      errorKind: 'constraint',
    };
  }

  try {
    // Generate unique code
    let inviteCode = generateInviteCode(slugPrefix);

    const { data: inserted, error: insertError } = await supabase
      .from('teams')
      .insert({
        hackathon_id: hackathonId,
        name: trimmedName,
        description: description?.trim() || null,
        invite_code: inviteCode,
        is_open: true,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Re-fetch full team to get populated trigger results
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      return await fetchMyTeam(hackathonId, user.id);
    }

    return {
      team: {
        ...(inserted as Team),
        members: [],
      },
      error: null,
      errorKind: null,
    };
  } catch (err) {
    const info = describeTeamError(err);
    return { team: null, error: info.message, errorKind: info.kind };
  }
}

/**
 * Join an existing team using its invite code.
 */
export async function joinTeamWithInviteCode(
  inviteCode: string,
  userId: string
): Promise<TeamResult> {
  if (!isSupabaseConfigured) {
    return {
      team: null,
      error: 'Supabase is not configured.',
      errorKind: 'not_configured',
    };
  }

  const cleanCode = inviteCode.trim().toUpperCase();

  try {
    // 1. Fetch team by invite code
    const preview = await fetchTeamByInviteCode(cleanCode);
    if (preview.error || !preview.team) {
      return preview;
    }

    const team = preview.team;

    if (!team.is_open) {
      return {
        team: null,
        error: 'This team is currently closed and not accepting new members.',
        errorKind: 'team_closed',
      };
    }

    // 2. Insert into team_members
    const { error: joinError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: userId,
        role: 'member',
      });

    if (joinError) throw joinError;

    // 3. Return updated team
    return await fetchMyTeam(team.hackathon_id, userId);
  } catch (err) {
    const info = describeTeamError(err);
    return { team: null, error: info.message, errorKind: info.kind };
  }
}

/**
 * Leave a team (or disband if leader is the only member).
 */
export async function leaveTeam(
  teamId: string,
  userId: string,
  isLeader: boolean
): Promise<{ success: boolean; error: string | null; errorKind: TeamErrorKind | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase is not configured.', errorKind: 'not_configured' };
  }

  try {
    if (isLeader) {
      // If leader leaves, delete the team (disbands team)
      const { error: delError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (delError) throw delError;
    } else {
      // Non-leader leaves: remove own membership
      const { error: leaveError } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', userId);

      if (leaveError) throw leaveError;
    }

    return { success: true, error: null, errorKind: null };
  } catch (err) {
    const info = describeTeamError(err);
    return { success: false, error: info.message, errorKind: info.kind };
  }
}

/**
 * Assign or change a team's chosen problem statement.
 */
export async function selectTeamProblem(
  teamId: string,
  problemId: string | null
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  try {
    const { error: updateError } = await supabase
      .from('teams')
      .update({ problem_id: problemId })
      .eq('id', teamId);

    if (updateError) throw updateError;
    return { success: true, error: null };
  } catch (err) {
    const info = describeTeamError(err);
    return { success: false, error: info.message };
  }
}

/**
 * Update team recruitment status or description.
 */
export async function updateTeamSettings(
  teamId: string,
  payload: { name?: string; description?: string | null; is_open?: boolean }
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  try {
    const { error: updateError } = await supabase
      .from('teams')
      .update(payload)
      .eq('id', teamId);

    if (updateError) throw updateError;
    return { success: true, error: null };
  } catch (err) {
    const info = describeTeamError(err);
    return { success: false, error: info.message };
  }
}
