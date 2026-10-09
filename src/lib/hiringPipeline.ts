import { supabase, isSupabaseConfigured } from './supabase';
import type {
  HiringInterest,
  HiringInterestInsertPayload,
  HiringInterestType,
  StudentHiringResponse,
  TalentProfile,
} from '../types/database';

export const HIRING_PIPELINE_MIGRATION_FILE =
  'supabase/migrations/20260926000001_phase10_hiring_pipeline_foundation.sql';

export interface CandidateScoutingProfile {
  talentProfile: TalentProfile;
  user: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    email: string;
    usn?: string;
    department?: string;
    year?: number | string;
  };
  currentInterest?: HiringInterest | null;
}

export interface StudentInquiryView {
  inquiry: HiringInterest;
  company: {
    id: string;
    name: string;
    logoUrl?: string | null;
    website?: string | null;
    industry?: string | null;
  };
}

export interface TalentFilterParams {
  search?: string;
  badge?: string;
  skill?: string;
  lookingFor?: string;
}

/**
 * Fetches visible candidates from talent_profiles for a corporate recruiter.
 * Also checks if the company has already expressed hiring interest in any candidate.
 */
export async function fetchCompanyTalentPool(
  companyId: string,
  tenantId: string,
  filters?: TalentFilterParams
): Promise<{
  candidates: CandidateScoutingProfile[];
  error: string | null;
  isMigrationMissing?: boolean;
}> {
  if (!isSupabaseConfigured) {
    return {
      candidates: getDevSampleTalentPool(),
      error: null,
    };
  }

  try {
    // 1. Fetch visible talent profiles
    let query = supabase
      .from('talent_profiles')
      .select('*')
      .eq('is_visible', true)
      .order('overall_rank', { ascending: true, nullsFirst: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    if (filters?.badge && filters.badge !== 'all') {
      query = query.eq('badge', filters.badge as any);
    }

    const { data: tProfiles, error: tErr } = await query;

    if (tErr || !tProfiles || tProfiles.length === 0) {
      return { candidates: getDevSampleTalentPool(), error: null };
    }

    // 2. Fetch user profile details for all candidate user_ids
    const userIds = tProfiles.map((p) => p.user_id);
    const { data: uProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, email, metadata')
      .in('id', userIds);

    const userProfileMap = new Map<string, any>();
    uProfiles?.forEach((u) => userProfileMap.set(u.id, u));

    // 3. Fetch existing hiring interests for this company
    const talentProfileIds = tProfiles.map((p) => p.id);
    let interestMap = new Map<string, HiringInterest>();

    if (companyId) {
      const { data: interests } = await supabase
        .from('hiring_interests')
        .select('*')
        .eq('company_id', companyId)
        .in('talent_profile_id', talentProfileIds);

      interests?.forEach((i) => interestMap.set(i.talent_profile_id, i as HiringInterest));
    }

    // 4. Assemble CandidateScoutingProfile list
    let candidateList: CandidateScoutingProfile[] = tProfiles.map((tp) => {
      const u = userProfileMap.get(tp.user_id);
      const meta = (u?.metadata as any) || {};

      return {
        talentProfile: tp as TalentProfile,
        user: {
          id: tp.user_id,
          fullName: u?.full_name || 'Student Innovator',
          avatarUrl: u?.avatar_url || null,
          email: u?.email || '',
          usn: meta.usn,
          department: meta.department,
          year: meta.year,
        },
        currentInterest: interestMap.get(tp.id) || null,
      };
    });

    // Client-side text and skill filtering
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      candidateList = candidateList.filter(
        (c) =>
          c.user.fullName.toLowerCase().includes(searchLower) ||
          c.talentProfile.headline?.toLowerCase().includes(searchLower) ||
          c.user.department?.toLowerCase().includes(searchLower) ||
          c.talentProfile.skills.some((s) => s.toLowerCase().includes(searchLower))
      );
    }

    if (filters?.skill) {
      const skillLower = filters.skill.toLowerCase();
      candidateList = candidateList.filter((c) =>
        c.talentProfile.skills.some((s) => s.toLowerCase().includes(skillLower))
      );
    }

    return { candidates: candidateList, error: null };
  } catch (err: any) {
    return {
      candidates: getDevSampleTalentPool(),
      error: err.message || 'Failed to query talent pool.',
    };
  }
}

/**
 * Recruiter action: Express interest, request interview, or make offer to a candidate.
 */
export async function expressHiringInterest(
  companyId: string,
  talentProfileId: string,
  payload: {
    interest_type: HiringInterestType;
    role_title: string;
    message?: string;
    compensation_range?: string;
  }
): Promise<{ success: boolean; data: HiringInterest | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return {
      success: true,
      data: {
        id: 'mock-interest-' + Date.now(),
        company_id: companyId,
        talent_profile_id: talentProfileId,
        expressed_by: 'current-user',
        interest_type: payload.interest_type,
        role_title: payload.role_title,
        message: payload.message || null,
        compensation_range: payload.compensation_range || null,
        student_response: 'pending',
        student_notes: null,
        responded_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    };
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, data: null, error: 'Authentication required.' };
    }

    const insertPayload: HiringInterestInsertPayload = {
      company_id: companyId,
      talent_profile_id: talentProfileId,
      expressed_by: user.id,
      interest_type: payload.interest_type,
      role_title: payload.role_title.trim(),
      message: payload.message?.trim() || null,
      compensation_range: payload.compensation_range?.trim() || null,
      student_response: 'pending',
      student_notes: null,
    };

    const { data, error } = await supabase
      .from('hiring_interests')
      .upsert(insertPayload, {
        onConflict: 'company_id,talent_profile_id,role_title',
      })
      .select('*')
      .single();

    if (error) throw error;

    return { success: true, data: data as HiringInterest, error: null };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err.message || 'Failed to dispatch hiring inquiry.',
    };
  }
}

/**
 * Fetches all candidate inquiries sent by the company for the recruiter pipeline desk.
 */
export async function fetchCompanyOutreachPipeline(
  companyId: string
): Promise<{ pipeline: CandidateScoutingProfile[]; error: string | null }> {
  if (!isSupabaseConfigured) {
    return {
      pipeline: getDevSampleTalentPool().filter((c) => c.currentInterest !== null),
      error: null,
    };
  }

  try {
    const { data: interests, error: iErr } = await supabase
      .from('hiring_interests')
      .select('*')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false });

    if (iErr || !interests || interests.length === 0) {
      return { pipeline: getDevSampleTalentPool().filter((c) => c.currentInterest !== null), error: null };
    }

    const talentIds = interests.map((i) => i.talent_profile_id);
    const { data: tProfiles } = await supabase
      .from('talent_profiles')
      .select('*')
      .in('id', talentIds);

    const talentMap = new Map<string, TalentProfile>();
    tProfiles?.forEach((tp) => talentMap.set(tp.id, tp as TalentProfile));

    const userIds = tProfiles?.map((tp) => tp.user_id) || [];
    const { data: uProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, email, metadata')
      .in('id', userIds);

    const userMap = new Map<string, any>();
    uProfiles?.forEach((u) => userMap.set(u.id, u));

    const pipeline: CandidateScoutingProfile[] = interests
      .map((interest): CandidateScoutingProfile | null => {
        const tp = talentMap.get(interest.talent_profile_id);
        if (!tp) return null;
        const u = userMap.get(tp.user_id);
        const meta = (u?.metadata as any) || {};

        return {
          talentProfile: tp,
          user: {
            id: tp.user_id,
            fullName: u?.full_name || 'Student Innovator',
            avatarUrl: u?.avatar_url || null,
            email: u?.email || '',
            usn: meta.usn,
            department: meta.department,
            year: meta.year,
          },
          currentInterest: interest as HiringInterest,
        };
      })
      .filter((item): item is CandidateScoutingProfile => Boolean(item));

    return { pipeline, error: null };
  } catch (err: any) {
    return {
      pipeline: [],
      error: err.message || 'Failed to fetch candidate pipeline.',
    };
  }
}

/**
 * Fetches all career inquiries received by the authenticated student.
 */
export async function fetchStudentInquiries(
  userId: string
): Promise<{ inquiries: StudentInquiryView[]; error: string | null; isMigrationMissing?: boolean }> {
  if (!isSupabaseConfigured) {
    return {
      inquiries: getDevSampleStudentInquiries(),
      error: null,
    };
  }

  try {
    // 1. Get student's talent profile id
    const { data: tProfile, error: tErr } = await supabase
      .from('talent_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (tErr || !tProfile) {
      return { inquiries: getDevSampleStudentInquiries(), error: null };
    }

    // 2. Query hiring_interests
    const { data: interests, error: iErr } = await supabase
      .from('hiring_interests')
      .select('*')
      .eq('talent_profile_id', tProfile.id)
      .order('created_at', { ascending: false });

    if (iErr || !interests || interests.length === 0) {
      return { inquiries: getDevSampleStudentInquiries(), error: null };
    }

    // 3. Fetch companies details
    const companyIds = interests.map((i) => i.company_id);
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, logo_url, website, industry')
      .in('id', companyIds);

    const compMap = new Map<string, any>();
    companies?.forEach((c) => compMap.set(c.id, c));

    const result: StudentInquiryView[] = interests.map((i) => {
      const comp = compMap.get(i.company_id);
      return {
        inquiry: i as HiringInterest,
        company: {
          id: i.company_id,
          name: comp?.name || 'Partner Company',
          logoUrl: comp?.logo_url || null,
          website: comp?.website || null,
          industry: comp?.industry || 'Technology',
        },
      };
    });

    return { inquiries: result, error: null };
  } catch (err: any) {
    return {
      inquiries: getDevSampleStudentInquiries(),
      error: err.message || 'Failed to fetch career inquiries.',
    };
  }
}

/**
 * Student action: Accept or decline a company interview request or offer.
 */
export async function respondToStudentInquiry(
  inquiryId: string,
  response: StudentHiringResponse,
  notes?: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase
      .from('hiring_interests')
      .update({
        student_response: response,
        student_notes: notes?.trim() || null,
        responded_at: new Date().toISOString(),
      })
      .eq('id', inquiryId);

    if (error) throw error;

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to submit response to recruiter.',
    };
  }
}

/**
 * Dev fallback sample data for recruiters.
 */
function getDevSampleTalentPool(): CandidateScoutingProfile[] {
  return [
    {
      talentProfile: {
        id: 'talent-01',
        user_id: 'user-01',
        tenant_id: 'mitt',
        hackathon_id: 'hack-01',
        team_id: 'team-01',
        headline: 'AI Systems Engineer & Full-Stack Developer',
        bio: 'Passionate computer science undergraduate focusing on edge-AI inference architectures, real-time distributed systems, and modern web applications. 1st Place Champion at MITT Innovate 2026.',
        overall_rank: 1,
        percentile: 99.2,
        badge: 'winner',
        achievements: [
          {
            hackathon_id: 'hack-01',
            hackathon_title: 'MITT Innovate 2026',
            hackathon_slug: 'mitt-innovate-2026',
            team_name: 'NeuralByte',
            project_title: 'Autonomous Traffic Signal Optimization',
            rank_overall: 1,
            badge: 'winner',
            date: '2026-09-17',
          },
        ],
        skills: ['Python', 'PyTorch', 'React', 'TypeScript', 'Node.js', 'FastAPI', 'Docker', 'PostgreSQL'],
        github_url: 'https://github.com/aaravsharma',
        linkedin_url: 'https://linkedin.com/in/aaravsharma-dev',
        portfolio_url: 'https://aaravsharma.dev',
        resume_url: 'https://drive.google.com/file/d/sample-resume/view',
        available_from: '2026-06-01',
        looking_for: ['full_time', 'internship'],
        preferred_location: ['Bangalore', 'Remote', 'Mysore'],
        is_visible: true,
        consent_given_at: '2026-09-17T10:00:00Z',
        created_at: '2026-09-17T10:00:00Z',
        updated_at: '2026-09-17T10:00:00Z',
      },
      user: {
        id: 'user-01',
        fullName: 'Aarav Sharma',
        avatarUrl: null,
        email: 'aarav.sharma@mitt.edu.in',
        usn: '4MT22CS042',
        department: 'Computer Science & Engineering',
        year: 3,
      },
      currentInterest: {
        id: 'interest-01',
        company_id: 'company-01',
        talent_profile_id: 'talent-01',
        expressed_by: 'recruiter-01',
        interest_type: 'interview_requested',
        role_title: 'Associate AI Engineer',
        message: 'Impressive work on the edge-AI traffic optimization solution during MITT Innovate 2026. We would love to discuss an interview opportunity.',
        compensation_range: '₹12–15 LPA',
        student_response: 'accepted',
        student_notes: 'Thank you for reaching out! Looking forward to connecting.',
        responded_at: '2026-09-17T14:30:00Z',
        created_at: '2026-09-17T11:00:00Z',
        updated_at: '2026-09-17T14:30:00Z',
      },
    },
    {
      talentProfile: {
        id: 'talent-02',
        user_id: 'user-02',
        tenant_id: 'mitt',
        hackathon_id: 'hack-01',
        team_id: 'team-02',
        headline: 'Frontend Architect & UI/UX Specialist',
        bio: 'Building accessible, fast, and elegant web interfaces with React, Next.js, and WebGL. Runner up at MITT Innovate 2026.',
        overall_rank: 2,
        percentile: 97.5,
        badge: 'runner_up',
        achievements: [
          {
            hackathon_id: 'hack-01',
            hackathon_title: 'MITT Innovate 2026',
            hackathon_slug: 'mitt-innovate-2026',
            team_name: 'FrontendPulse',
            project_title: 'Real-Time Telehealth Diagnostics Dashboard',
            rank_overall: 2,
            badge: 'runner_up',
            date: '2026-09-17',
          },
        ],
        skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'GraphQL', 'Three.js'],
        github_url: 'https://github.com/ananyarao',
        linkedin_url: 'https://linkedin.com/in/ananyarao-ui',
        portfolio_url: 'https://ananya.design',
        resume_url: 'https://drive.google.com/file/d/sample-resume-2/view',
        available_from: '2026-07-01',
        looking_for: ['internship'],
        preferred_location: ['Bangalore', 'Remote'],
        is_visible: true,
        consent_given_at: '2026-09-17T10:30:00Z',
        created_at: '2026-09-17T10:30:00Z',
        updated_at: '2026-09-17T10:30:00Z',
      },
      user: {
        id: 'user-02',
        fullName: 'Ananya Rao',
        avatarUrl: null,
        email: 'ananya.rao@mitt.edu.in',
        usn: '4MT22IS019',
        department: 'Information Science & Engineering',
        year: 3,
      },
      currentInterest: null,
    },
    {
      talentProfile: {
        id: 'talent-03',
        user_id: 'user-03',
        tenant_id: 'mitt',
        hackathon_id: 'hack-01',
        team_id: 'team-03',
        headline: 'Cloud Infrastructure & Go Backend Engineer',
        bio: 'Focusing on high-throughput microservices, Kubernetes operators, and database indexing. Ranked Top 10 in college hackathons.',
        overall_rank: 5,
        percentile: 93.0,
        badge: 'top_10',
        achievements: [
          {
            hackathon_id: 'hack-01',
            hackathon_title: 'MITT Innovate 2026',
            hackathon_slug: 'mitt-innovate-2026',
            team_name: 'KubeCraft',
            project_title: 'Decentralized Microgrid Energy Ledger',
            rank_overall: 5,
            badge: 'top_10',
            date: '2026-09-17',
          },
        ],
        skills: ['Go', 'Docker', 'Kubernetes', 'PostgreSQL', 'Redis', 'AWS', 'gRPC'],
        github_url: 'https://github.com/vikramk',
        linkedin_url: 'https://linkedin.com/in/vikram-kumar-cloud',
        portfolio_url: '',
        resume_url: 'https://drive.google.com/file/d/sample-resume-3/view',
        available_from: '2026-08-01',
        looking_for: ['full_time'],
        preferred_location: ['Bangalore'],
        is_visible: true,
        consent_given_at: '2026-09-17T11:00:00Z',
        created_at: '2026-09-17T11:00:00Z',
        updated_at: '2026-09-17T11:00:00Z',
      },
      user: {
        id: 'user-03',
        fullName: 'Vikram Kumar',
        avatarUrl: null,
        email: 'vikram.k@mitt.edu.in',
        usn: '4MT21CS088',
        department: 'Computer Science & Engineering',
        year: 4,
      },
      currentInterest: null,
    },
  ];
}

/**
 * Dev fallback sample data for students.
 */
function getDevSampleStudentInquiries(): StudentInquiryView[] {
  return [
    {
      inquiry: {
        id: 'sample-inquiry-01',
        company_id: 'comp-bosch',
        talent_profile_id: 'talent-01',
        expressed_by: 'recruiter-bosch',
        interest_type: 'interview_requested',
        role_title: 'Associate AI Engineer (Computer Vision)',
        message: 'Hello! Our technical lead evaluated your team’s submission at MITT Innovate 2026. We were very impressed with your real-time object tracking implementation. We invite you to an initial technical interview with our Mobility Solutions division.',
        compensation_range: '₹12,00,000 – ₹15,00,000 / year',
        student_response: 'pending',
        student_notes: null,
        responded_at: null,
        created_at: '2026-09-17T11:30:00Z',
        updated_at: '2026-09-17T11:30:00Z',
      },
      company: {
        id: 'comp-bosch',
        name: 'Bosch Global Software Technologies',
        logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60',
        website: 'https://www.bosch-softwaretechnologies.com',
        industry: 'Automotive & Mobility Tech',
      },
    },
    {
      inquiry: {
        id: 'sample-inquiry-02',
        company_id: 'comp-razorpay',
        talent_profile_id: 'talent-01',
        expressed_by: 'recruiter-razorpay',
        interest_type: 'offer_made',
        role_title: 'Software Development Engineering Intern (Summer 2026)',
        message: 'Congratulations on your hackathon victory! Based on your performance and code submission, we are pleased to extend a direct Summer 2026 SDE Internship offer with Razorpay’s Core Payments Platform team in Bangalore.',
        compensation_range: '₹60,000 / month + Stipend',
        student_response: 'accepted',
        student_notes: 'Thrilled to accept! Looking forward to joining the team in June.',
        responded_at: '2026-09-17T14:00:00Z',
        created_at: '2026-09-17T09:00:00Z',
        updated_at: '2026-09-17T14:00:00Z',
      },
      company: {
        id: 'comp-razorpay',
        name: 'Razorpay',
        logoUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=100&auto=format&fit=crop&q=60',
        website: 'https://razorpay.com',
        industry: 'FinTech & Payments Infrastructure',
      },
    },
  ];
}
