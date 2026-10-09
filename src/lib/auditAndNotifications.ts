import { supabase, isSupabaseConfigured } from './supabase';
import type {
  AuditLog,
  AuditLogInsertPayload,
  AppNotification,
  NotificationInsertPayload,
} from '../types/database';

export const AUDIT_NOTIFICATIONS_MIGRATION_FILE =
  'supabase/migrations/20260927000001_phase11_audit_and_notifications_foundation.sql';

export interface EnrichedAuditLog extends AuditLog {
  actor?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
}

export interface AuditLogFilterParams {
  action?: string;
  targetType?: string;
  search?: string;
  limit?: number;
}

/**
 * Fetches tenant audit logs with joined actor metadata.
 */
export async function fetchAuditLogs(
  tenantId: string,
  filters?: AuditLogFilterParams
): Promise<{
  logs: EnrichedAuditLog[];
  error: string | null;
  isMigrationMissing?: boolean;
}> {
  if (!isSupabaseConfigured) {
    return {
      logs: getDevSampleAuditLogs(),
      error: null,
    };
  }

  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 50);

    if (filters?.action && filters.action !== 'all') {
      query = query.ilike('action', `%${filters.action}%`);
    }

    if (filters?.targetType && filters.targetType !== 'all') {
      query = query.eq('target_type', filters.targetType);
    }

    const { data: logsData, error: lErr } = await query;

    if (lErr) {
      if (
        lErr.code === '42P01' ||
        lErr.message?.includes('does not exist') ||
        lErr.message?.includes('schema cache')
      ) {
        return {
          logs: getDevSampleAuditLogs(),
          error: `Table public.audit_logs is missing. Please run ${AUDIT_NOTIFICATIONS_MIGRATION_FILE}`,
          isMigrationMissing: true,
        };
      }
      throw lErr;
    }

    if (!logsData || logsData.length === 0) {
      return { logs: [], error: null };
    }

    // Fetch actor profiles
    const actorIds = Array.from(
      new Set(logsData.map((l) => l.actor_id).filter((id): id is string => Boolean(id)))
    );

    let actorMap = new Map<string, any>();
    if (actorIds.length > 0) {
      const { data: actors } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('id', actorIds);

      actors?.forEach((a) => actorMap.set(a.id, a));
    }

    let enrichedLogs: EnrichedAuditLog[] = logsData.map((l) => {
      const act = l.actor_id ? actorMap.get(l.actor_id) : null;
      return {
        ...l,
        actor: act
          ? {
              id: act.id,
              fullName: act.full_name,
              email: act.email,
              role: act.role,
            }
          : null,
      };
    });

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      enrichedLogs = enrichedLogs.filter(
        (l) =>
          l.action.toLowerCase().includes(searchLower) ||
          l.target_type.toLowerCase().includes(searchLower) ||
          l.actor?.fullName.toLowerCase().includes(searchLower) ||
          l.actor?.email.toLowerCase().includes(searchLower)
      );
    }

    return { logs: enrichedLogs, error: null };
  } catch (err: any) {
    return {
      logs: getDevSampleAuditLogs(),
      error: err.message || 'Failed to fetch audit logs.',
    };
  }
}

/**
 * Inserts a new audit log event.
 */
export async function recordAuditLog(
  payload: AuditLogInsertPayload
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase.from('audit_logs').insert(payload);
    if (error) throw error;
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Audit logging failed:', err);
    return { success: false, error: err.message || 'Failed to record audit event.' };
  }
}

/**
 * Fetches user notifications for the in-app notification center.
 */
export async function fetchUserNotifications(
  userId: string
): Promise<{
  notifications: AppNotification[];
  error: string | null;
  isMigrationMissing?: boolean;
}> {
  if (!isSupabaseConfigured) {
    return {
      notifications: getDevSampleNotifications(),
      error: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      if (
        error.code === '42P01' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('schema cache')
      ) {
        return {
          notifications: getDevSampleNotifications(),
          error: `Table public.notifications is missing. Please run ${AUDIT_NOTIFICATIONS_MIGRATION_FILE}`,
          isMigrationMissing: true,
        };
      }
      throw error;
    }

    if (!data || data.length === 0) {
      return { notifications: [], error: null };
    }

    return { notifications: (data as AppNotification[]) || [], error: null };
  } catch (err: any) {
    return {
      notifications: [],
      error: err.message || 'Failed to fetch notifications.',
    };
  }
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    if (error) throw error;
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to mark notification read.' };
  }
}

/**
 * Marks all notifications for a user as read.
 */
export async function markAllNotificationsAsRead(
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to mark all notifications read.' };
  }
}

/**
 * Helper to dispatch a notification to any user.
 */
export async function dispatchNotification(
  payload: NotificationInsertPayload
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase.from('notifications').insert(payload);
    if (error) throw error;
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Notification dispatch failed:', err);
    return { success: false, error: err.message || 'Failed to dispatch notification.' };
  }
}

/**
 * Dev fallback sample audit logs.
 */
function getDevSampleAuditLogs(): EnrichedAuditLog[] {
  return [
    {
      id: 'audit-01',
      tenant_id: 'mitt',
      actor_id: 'admin-01',
      action: 'hackathon.status_changed',
      target_type: 'hackathon',
      target_id: 'hack-mitt-2026',
      details: {
        previous_status: 'evaluation',
        new_status: 'completed',
        reason: 'Final jury deliberation concluded and awards declared.',
      },
      ip_address: '10.12.4.101',
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
      actor: {
        id: 'admin-01',
        fullName: 'Prof. S. R. Ramesh',
        email: 'dean.academic@mitt.edu.in',
        role: 'college_admin',
      },
    },
    {
      id: 'audit-02',
      tenant_id: 'mitt',
      actor_id: 'admin-01',
      action: 'awards.finalized',
      target_type: 'submission',
      target_id: 'sub-01',
      details: {
        winner_team: 'NeuralByte',
        award_tier: 'winner',
        score_weighted: 94.6,
        prize: '₹50,000 First Place Trophy',
      },
      ip_address: '10.12.4.101',
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      actor: {
        id: 'admin-01',
        fullName: 'Prof. S. R. Ramesh',
        email: 'dean.academic@mitt.edu.in',
        role: 'college_admin',
      },
    },
    {
      id: 'audit-03',
      tenant_id: 'mitt',
      actor_id: 'company-rep-01',
      action: 'hiring.interview_requested',
      target_type: 'talent_profile',
      target_id: 'talent-01',
      details: {
        candidate_name: 'Aarav Sharma',
        company_name: 'Bosch Global Software Technologies',
        role_title: 'Associate AI Engineer',
        compensation: '₹12–15 LPA',
      },
      ip_address: '157.48.210.84',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      actor: {
        id: 'company-rep-01',
        fullName: 'Meera Nambiar',
        email: 'meera.nambiar@bosch.com',
        role: 'company_rep',
      },
    },
    {
      id: 'audit-04',
      tenant_id: 'mitt',
      actor_id: 'admin-02',
      action: 'company.verified',
      target_type: 'company',
      target_id: 'comp-01',
      details: {
        company_name: 'Razorpay Software Private Limited',
        domain: 'fintech',
        verification_status: 'verified',
      },
      ip_address: '10.12.4.105',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      actor: {
        id: 'admin-02',
        fullName: 'Dr. K. Manjunath',
        email: 'hackathon.chair@mitt.edu.in',
        role: 'committee_member',
      },
    },
    {
      id: 'audit-05',
      tenant_id: 'mitt',
      actor_id: 'admin-01',
      action: 'problem_statement.approved',
      target_type: 'problem_statement',
      target_id: 'prob-01',
      details: {
        title: 'Autonomous Traffic Signal Optimization with Edge Vision',
        company: 'Bosch',
        difficulty: 'hard',
      },
      ip_address: '10.12.4.101',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      actor: {
        id: 'admin-01',
        fullName: 'Prof. S. R. Ramesh',
        email: 'dean.academic@mitt.edu.in',
        role: 'college_admin',
      },
    },
  ];
}

/**
 * Dev fallback sample notifications.
 */
function getDevSampleNotifications(): AppNotification[] {
  return [
    {
      id: 'notif-01',
      user_id: 'current-user',
      tenant_id: 'mitt',
      title: '🏆 Awards Announced: MITT Innovate 2026',
      message: 'The official jury deliberations are complete and final rankings are published on the live leaderboard.',
      type: 'awards_announced',
      link: '/leaderboard',
      is_read: false,
      read_at: null,
      created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    },
    {
      id: 'notif-02',
      user_id: 'current-user',
      tenant_id: 'mitt',
      title: '💼 New Interview Request Received',
      message: 'Bosch Global Software Technologies has extended an interview invitation for Associate AI Engineer.',
      type: 'hiring_interest',
      link: '/student/offers',
      is_read: false,
      read_at: null,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    {
      id: 'notif-03',
      user_id: 'current-user',
      tenant_id: 'mitt',
      title: '🚀 Project Submission Verified',
      message: 'Your team "NeuralByte" has successfully finalized deliverables for Round 1. AI Pre-screening passed with score 9.4/10.',
      type: 'submission_confirmed',
      link: '/student/submissions',
      is_read: true,
      read_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ];
}
