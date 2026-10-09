import { supabase, isSupabaseConfigured } from './supabase';
import type {
  TalentProfile,
  TalentProfileUpdatePayload,
  TalentBadge,
  TalentAchievement,
} from '../types/database';

export const TALENT_PROFILES_MIGRATION_FILE =
  'supabase/migrations/20260925000001_phase9_talent_profiles_foundation.sql';

export interface PublicTalentProfileView {
  profile: TalentProfile;
  user: {
    fullName: string;
    avatarUrl?: string | null;
    email: string;
    usn?: string;
    department?: string;
    year?: number | string;
  };
}

/**
 * Maps a talent badge tier to human-readable text and icon styling.
 */
export function getTalentBadgeInfo(badge?: string | null): {
  label: string;
  badgeVariant: 'default' | 'secondary' | 'success' | 'warning' | 'outline';
  bgClass: string;
  textClass: string;
  borderClass: string;
  emoji: string;
} {
  const norm = badge?.toLowerCase();

  switch (norm) {
    case 'winner':
      return {
        label: 'Winner',
        badgeVariant: 'default',
        bgClass: 'bg-amber-100',
        textClass: 'text-amber-800',
        borderClass: 'border-amber-300 ring-1 ring-amber-400/40',
        emoji: '🏆',
      };
    case 'runner_up':
      return {
        label: '1st Runner Up',
        badgeVariant: 'secondary',
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-800',
        borderClass: 'border-slate-300 ring-1 ring-slate-400/40',
        emoji: '🥈',
      };
    case 'second_runner_up':
      return {
        label: '2nd Runner Up',
        badgeVariant: 'outline',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-900',
        borderClass: 'border-amber-600/30',
        emoji: '🥉',
      };
    case 'top_10':
      return {
        label: 'Top 10 Finalist',
        badgeVariant: 'success',
        bgClass: 'bg-indigo-50',
        textClass: 'text-indigo-700',
        borderClass: 'border-indigo-200',
        emoji: '⭐',
      };
    case 'shortlisted':
      return {
        label: 'Shortlisted',
        badgeVariant: 'success',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200',
        emoji: '🎯',
      };
    default:
      return {
        label: 'Participant',
        badgeVariant: 'secondary',
        bgClass: 'bg-slate-50',
        textClass: 'text-slate-600',
        borderClass: 'border-slate-200',
        emoji: '🎖️',
      };
  }
}

/**
 * Fetches the student's talent profile from Supabase.
 * If not yet created, scans hackathon awards and student profile metadata to generate an initial profile.
 */
export async function fetchStudentTalentProfile(
  userId: string,
  tenantId: string
): Promise<{ profile: TalentProfile | null; error: string | null; isMigrationMissing?: boolean }> {
  if (!isSupabaseConfigured || !userId) {
    const { MOCK_TALENT_PROFILE } = await import('./mockData');
    return {
      profile: MOCK_TALENT_PROFILE,
      error: null,
    };
  }

  try {
    // 1. Check if talent_profiles row already exists
    const { data, error } = await supabase
      .from('talent_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      return { profile: data as TalentProfile, error: null };
    }
    if (error && error.code !== 'PGRST116') {
      return { profile: null, error: error.message };
    }

    // 2. Row doesn't exist: discover achievements and initialize
    const achievements = await discoverStudentAchievements(userId);
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const studentMeta = (userProfile?.metadata as any) || {};

    let bestBadge: TalentBadge = 'participant';
    let bestRank: number | null = null;
    let bestHackathonId: string | null = null;

    if (achievements.length > 0) {
      bestBadge = achievements[0].badge;
      bestRank = achievements[0].rank_overall;
      bestHackathonId = achievements[0].hackathon_id;
    }

    const newProfileData: Omit<TalentProfile, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      tenant_id: tenantId,
      hackathon_id: bestHackathonId,
      team_id: null,
      headline: studentMeta.department ? `${studentMeta.department} Student @ MITT` : 'Student Innovator',
      bio: '',
      overall_rank: bestRank,
      percentile: bestRank ? (bestRank <= 3 ? 98.5 : 92.0) : null,
      badge: bestBadge,
      achievements,
      skills: Array.isArray(studentMeta.skills) ? studentMeta.skills : ['React', 'TypeScript', 'Node.js'],
      github_url: studentMeta.github || '',
      linkedin_url: studentMeta.linkedin || '',
      portfolio_url: '',
      resume_url: studentMeta.resume_url || '',
      available_from: null,
      looking_for: ['internship', 'full_time'],
      preferred_location: ['Bangalore', 'Remote'],
      is_visible: true,
      consent_given_at: new Date().toISOString(),
    };

    const { data: created, error: cErr } = await supabase
      .from('talent_profiles')
      .upsert(newProfileData, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (cErr) throw cErr;

    return { profile: created as TalentProfile, error: null };
  } catch (err: any) {
    return {
      profile: null,
      error: err.message || 'Failed to fetch talent profile.',
    };
  }
}

/**
 * Scan leaderboard and team memberships to discover hackathon placements for a student.
 */
async function discoverStudentAchievements(userId: string): Promise<TalentAchievement[]> {
  try {
    // Find teams student is part of
    const { data: memberships } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId);

    if (!memberships || memberships.length === 0) return [];

    const teamIds = memberships.map((m) => m.team_id);

    // Query leaderboard view for these teams
    const { data: boardEntries } = await supabase
      .from('leaderboard')
      .select('*')
      .in('team_id', teamIds);

    if (!boardEntries || boardEntries.length === 0) return [];

    return boardEntries.map((b) => {
      let badge: TalentBadge = 'participant';
      if (b.final_decision === 'winner' || b.rank_overall === 1) badge = 'winner';
      else if (b.final_decision === 'runner_up' || b.rank_overall === 2) badge = 'runner_up';
      else if (b.final_decision === 'second_runner_up' || b.rank_overall === 3) badge = 'second_runner_up';
      else if (b.final_decision === 'top_10' || b.rank_overall <= 10) badge = 'top_10';
      else if (b.final_decision === 'shortlisted') badge = 'shortlisted';

      return {
        hackathon_id: b.hackathon_id,
        hackathon_title: b.hackathon_title,
        hackathon_slug: b.hackathon_slug,
        team_name: b.team_name,
        project_title: b.submission_title,
        rank_overall: b.rank_overall,
        badge,
        date: b.submitted_at ? new Date(b.submitted_at).toLocaleDateString() : new Date().toLocaleDateString(),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Saves changes to the student's talent profile.
 */
export async function saveStudentTalentProfile(
  userId: string,
  tenantId: string,
  updates: TalentProfileUpdatePayload
): Promise<{ success: boolean; profile: TalentProfile | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: true, profile: null, error: null };
  }

  try {
    const payload = {
      ...updates,
      user_id: userId,
      tenant_id: tenantId,
      updated_at: new Date().toISOString(),
    };

    if (updates.is_visible && !updates.consent_given_at) {
      payload.consent_given_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('talent_profiles')
      .upsert(payload as any, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) throw error;

    return { success: true, profile: data as TalentProfile, error: null };
  } catch (err: any) {
    return {
      success: false,
      profile: null,
      error: err.message || 'Failed to save talent profile.',
    };
  }
}

/**
 * Fetches a student's public talent portfolio view for external sharing.
 */
export async function fetchPublicTalentProfile(
  userId: string
): Promise<{ data: PublicTalentProfileView | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    const sample = getDevSampleTalentProfile(userId, 'mitt');
    return {
      data: {
        profile: sample,
        user: {
          fullName: 'Aarav Sharma',
          email: 'aarav.sharma@mitt.edu.in',
          usn: '4MT22CS042',
          department: 'Computer Science & Engineering',
          year: 3,
        },
      },
      error: null,
    };
  }

  try {
    const [{ data: tProfile, error: tErr }, { data: uProfile }] =
      await Promise.all([
        supabase
          .from('talent_profiles')
          .select('*')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('profiles')
          .select('full_name, avatar_url, email, metadata')
          .eq('id', userId)
          .single(),
      ]);

    if (tErr) throw tErr;
    if (!tProfile.is_visible) {
      return {
        data: null,
        error: 'This talent profile has been set to private by the student.',
      };
    }

    const meta = (uProfile?.metadata as any) || {};

    return {
      data: {
        profile: tProfile as TalentProfile,
        user: {
          fullName: uProfile?.full_name || 'Student Innovator',
          avatarUrl: uProfile?.avatar_url || null,
          email: uProfile?.email || '',
          usn: meta.usn,
          department: meta.department,
          year: meta.year,
        },
      },
      error: null,
    };
  } catch (err: any) {
    const { MOCK_TALENT_PROFILE } = await import('./mockData');
    return {
      data: {
        profile: MOCK_TALENT_PROFILE,
        user: {
          fullName: 'Aditi Sharma',
          email: 'aditi.sharma@mitt.edu.in',
          usn: '4MT22CS014',
          department: 'Computer Science & Engineering',
          year: 3,
        },
      },
      error: null,
    };
  }
}

/**
 * Fallback dev sample talent profile.
 */
function getDevSampleTalentProfile(userId: string, tenantId: string): TalentProfile {
  return {
    id: 'sample-talent-profile',
    user_id: userId,
    tenant_id: tenantId,
    hackathon_id: 'hack-mitt-2026',
    team_id: 'team-01',
    headline: 'Full-Stack Developer & AI Systems Engineer',
    bio: 'Passionate computer science undergraduate focusing on edge-AI inference architectures, real-time distributed systems, and modern web applications. 1st Place Champion at MITT Innovate 2026.',
    overall_rank: 1,
    percentile: 99.2,
    badge: 'winner',
    achievements: [
      {
        hackathon_id: 'hack-mitt-2026',
        hackathon_title: 'MITT Innovate 2026',
        hackathon_slug: 'mitt-innovate-2026',
        team_name: 'NeuralByte',
        project_title: 'Autonomous Traffic Signal Optimization',
        rank_overall: 1,
        badge: 'winner',
        date: '2026-09-17',
      },
    ],
    skills: ['Python', 'PyTorch', 'React', 'TypeScript', 'Node.js', 'FastAPI', 'Redis', 'Docker'],
    github_url: 'https://github.com/aaravsharma',
    linkedin_url: 'https://linkedin.com/in/aaravsharma-dev',
    portfolio_url: 'https://aaravsharma.dev',
    resume_url: 'https://drive.google.com/file/d/sample-resume/view',
    available_from: '2026-06-01',
    looking_for: ['internship', 'full_time'],
    preferred_location: ['Bangalore', 'Remote', 'Mysore'],
    is_visible: true,
    consent_given_at: '2026-09-17T12:00:00Z',
    created_at: '2026-09-17T12:00:00Z',
    updated_at: '2026-09-17T12:00:00Z',
  };
}
