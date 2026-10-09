/**
 * HackBridge Unified API Client
 * Seamlessly connects the React frontend to the portable /backend API server,
 * providing a single point of integration for Auth, Hackathons, Teams, Submissions,
 * Rubric Judging, Leaderboards, and Recruiter Outreach.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const isBackendApiConfigured = Boolean(API_BASE_URL);

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('hackbridge_token');
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('hackbridge_token', token);
  }
}

export function clearToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('hackbridge_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `API request failed with status ${res.status}`);
  }

  return data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: any; tenant: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }),
    register: (payload: any) =>
      request<{ token: string; user: any; tenant: any }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    me: () => request<{ user: any }>('/api/auth/me')
  },
  hackathons: {
    list: (tenantId?: string) =>
      request<{ hackathons: any[] }>(`/api/hackathons?tenantId=${tenantId || 'mitt'}`),
    get: (idOrSlug: string) =>
      request<{ hackathon: any }>(`/api/hackathons/${idOrSlug}`),
    create: (payload: any) =>
      request<{ hackathon: any }>('/api/hackathons', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    transition: (id: string, nextStatus: string) =>
      request<{ hackathon: any }>(`/api/hackathons/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ nextStatus })
      })
  },
  teams: {
    my: (hackathonId: string) =>
      request<{ team: any }>(`/api/teams/my?hackathonId=${hackathonId}`),
    create: (hackathonId: string, name: string) =>
      request<{ team: any }>('/api/teams/create', {
        method: 'POST',
        body: JSON.stringify({ hackathonId, name })
      }),
    join: (hackathonId: string, inviteCode: string) =>
      request<{ team: any }>('/api/teams/join', {
        method: 'POST',
        body: JSON.stringify({ hackathonId, inviteCode })
      }),
    selectProblem: (teamId: string, problemId: string) =>
      request<{ team: any }>(`/api/teams/${teamId}/problem`, {
        method: 'POST',
        body: JSON.stringify({ problemId })
      })
  },
  submissions: {
    forTeam: (teamId: string, round: number = 1) =>
      request<{ submission: any }>(`/api/submissions/team/${teamId}?round=${round}`),
    saveDraft: (payload: any) =>
      request<{ submission: any }>('/api/submissions/draft', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    lock: (id: string) =>
      request<{ submission: any }>(`/api/submissions/${id}/lock`, {
        method: 'POST'
      }),
    listForHackathon: (hackathonId: string, round: number = 1) =>
      request<{ submissions: any[] }>(`/api/submissions/hackathon/${hackathonId}?round=${round}`)
  },
  evaluations: {
    myAssignments: (hackathonId?: string) =>
      request<{ assignments: any[] }>(
        `/api/evaluations/assignments${hackathonId ? `?hackathonId=${hackathonId}` : ''}`
      ),
    submitScore: (payload: any) =>
      request<{ score: any }>('/api/evaluations/score', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    autoAssign: (hackathonId: string, targetPerSubmission: number = 2) =>
      request<{ assignedCount: number }>('/api/evaluations/auto-assign', {
        method: 'POST',
        body: JSON.stringify({ hackathonId, targetPerSubmission })
      })
  },
  leaderboard: {
    get: (hackathonId: string, round: number = 1) =>
      request<{ entries: any[] }>(`/api/leaderboard/${hackathonId}?round=${round}`),
    finalize: (hackathonId: string, round: number, decisions: any[]) =>
      request<{ success: boolean }>(`/api/leaderboard/${hackathonId}/finalize`, {
        method: 'POST',
        body: JSON.stringify({ round, decisions })
      })
  },
  talent: {
    me: () => request<{ profile: any }>('/api/talent/me'),
    getPublic: (userId: string) => request<{ profile: any }>(`/api/talent/profile/${userId}`),
    update: (payload: any) =>
      request<{ profile: any }>('/api/talent/me', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    pool: () => request<{ candidates: any[] }>('/api/talent/pool')
  },
  hiring: {
    outreach: (payload: any) =>
      request<{ interest: any }>('/api/hiring/outreach', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    myOffers: () => request<{ offers: any[] }>('/api/hiring/student'),
    companyPipeline: (companyId: string) =>
      request<{ pipeline: any[] }>(`/api/hiring/company/${companyId}`),
    updateStatus: (id: string, status: string) =>
      request<{ interest: any }>(`/api/hiring/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status })
      })
  },
  audit: {
    list: (params?: { action?: string; targetType?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.action) q.set('action', params.action);
      if (params?.targetType) q.set('targetType', params.targetType);
      if (params?.limit) q.set('limit', params.limit.toString());
      return request<{ logs: any[] }>(`/api/audit/logs?${q.toString()}`);
    }
  },
  notifications: {
    list: () => request<{ notifications: any[] }>('/api/notifications'),
    markRead: (id: string) => request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),
    markAllRead: () => request<{ success: boolean }>('/api/notifications/read-all', { method: 'POST' })
  }
};
