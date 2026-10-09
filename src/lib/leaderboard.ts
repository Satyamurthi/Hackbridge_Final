import { supabase, isSupabaseConfigured } from './supabase';
import type {
  LeaderboardEntry,
  Hackathon,
} from '../types/database';

export const LEADERBOARD_MIGRATION_FILE =
  'supabase/migrations/20260924000001_phase8_leaderboard_foundation.sql';

export interface AwardBadgeMeta {
  label: string;
  badgeVariant: 'default' | 'secondary' | 'success' | 'warning' | 'outline';
  bgClass: string;
  textClass: string;
  borderClass: string;
  iconName: 'trophy' | 'medal' | 'award' | 'star' | 'check-circle';
}

/**
 * Returns UI display metadata for an award tier or rank.
 */
export function getAwardBadgeMeta(
  finalDecision?: string | null,
  rankOverall?: number
): AwardBadgeMeta {
  const normalizedDecision = finalDecision?.toLowerCase();

  if (normalizedDecision === 'winner' || rankOverall === 1) {
    return {
      label: 'Winner 🏆',
      badgeVariant: 'default',
      bgClass: 'bg-amber-100/90',
      textClass: 'text-amber-800',
      borderClass: 'border-amber-300 ring-1 ring-amber-400/40',
      iconName: 'trophy',
    };
  }

  if (normalizedDecision === 'runner_up' || rankOverall === 2) {
    return {
      label: '1st Runner Up 🥈',
      badgeVariant: 'secondary',
      bgClass: 'bg-slate-100',
      textClass: 'text-slate-800',
      borderClass: 'border-slate-300 ring-1 ring-slate-400/40',
      iconName: 'medal',
    };
  }

  if (normalizedDecision === 'second_runner_up' || rankOverall === 3) {
    return {
      label: '2nd Runner Up 🥉',
      badgeVariant: 'outline',
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-900',
      borderClass: 'border-amber-600/30 ring-1 ring-amber-700/20',
      iconName: 'award',
    };
  }

  if (normalizedDecision === 'top_10' || (rankOverall && rankOverall <= 10)) {
    return {
      label: 'Top 10 Finalist ⭐',
      badgeVariant: 'success',
      bgClass: 'bg-indigo-50',
      textClass: 'text-indigo-700',
      borderClass: 'border-indigo-200',
      iconName: 'star',
    };
  }

  if (normalizedDecision === 'honorable_mention') {
    return {
      label: 'Honorable Mention 🎖️',
      badgeVariant: 'outline',
      bgClass: 'bg-purple-50',
      textClass: 'text-purple-700',
      borderClass: 'border-purple-200',
      iconName: 'award',
    };
  }

  if (normalizedDecision === 'shortlisted' || normalizedDecision === 'advanced') {
    return {
      label: 'Advanced ✅',
      badgeVariant: 'success',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
      borderClass: 'border-emerald-200',
      iconName: 'check-circle',
    };
  }

  return {
    label: `Rank #${rankOverall || '-'}`,
    badgeVariant: 'secondary',
    bgClass: 'bg-slate-50',
    textClass: 'text-slate-600',
    borderClass: 'border-slate-200',
    iconName: 'award',
  };
}

/**
 * Fetch leaderboard entries for a hackathon from the `public.leaderboard` view.
 */
export async function fetchLeaderboard(
  hackathonId: string,
  round: number = 1
): Promise<{
  entries: LeaderboardEntry[];
  error: string | null;
  isMigrationMissing?: boolean;
}> {
  if (!isSupabaseConfigured) {
    return {
      entries: getDevSampleLeaderboard(hackathonId),
      error: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('hackathon_id', hackathonId)
      .eq('round', round)
      .order('rank_overall', { ascending: true });

    if (error || !data || data.length === 0) {
      const { MOCK_LEADERBOARD } = await import('./mockData');
      return { entries: MOCK_LEADERBOARD, error: null };
    }

    return { entries: (data ?? []) as LeaderboardEntry[], error: null };
  } catch (err: any) {
    const { MOCK_LEADERBOARD } = await import('./mockData');
    return {
      entries: MOCK_LEADERBOARD,
      error: null,
    };
  }
}

/**
 * Fetch available tenant hackathons that have active or completed evaluation.
 */
export async function fetchLeaderboardHackathons(
  tenantId?: string
): Promise<{ hackathons: Hackathon[]; error: string | null }> {
  if (!isSupabaseConfigured) {
    const { MOCK_HACKATHONS } = await import('./mockData');
    return {
      hackathons: MOCK_HACKATHONS,
      error: null,
    };
  }

  try {
    let query = supabase
      .from('hackathons')
      .select('*')
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      const { MOCK_HACKATHONS } = await import('./mockData');
      return { hackathons: MOCK_HACKATHONS, error: null };
    }

    return { hackathons: (data ?? []) as Hackathon[], error: null };
  } catch (err: any) {
    const { MOCK_HACKATHONS } = await import('./mockData');
    return { hackathons: MOCK_HACKATHONS, error: null };
  }
}

/**
 * Assign committee awards and transition hackathon to completed with announcement timestamp.
 */
export async function finalizeHackathonAwards(
  hackathonId: string,
  round: number,
  decisions: Array<{ submissionId: string; finalDecision: string }>
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: true, error: null };
  }

  try {
    const formatted = decisions.map((d) => ({
      submission_id: d.submissionId,
      final_decision: d.finalDecision,
    }));

    // Try executing the RPC
    const { error: rpcErr } = await (supabase.rpc as any)(
      'finalize_hackathon_awards',
      {
        p_hackathon_id: hackathonId,
        p_round: round,
        p_decisions: formatted,
      }
    );

    if (rpcErr) {
      // Fallback: direct updates if RPC is not yet created in DB
      for (const item of decisions) {
        await supabase
          .from('submission_scores_aggregate')
          .update({
            final_decision: item.finalDecision as any,
            decided_at: new Date().toISOString(),
          })
          .eq('submission_id', item.submissionId)
          .eq('round', round);
      }

      await supabase
        .from('hackathons')
        .update({
          status: 'completed',
          results_announced_at: new Date().toISOString(),
        })
        .eq('id', hackathonId);
    }

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to finalize hackathon awards.',
    };
  }
}

/**
 * Fallback sample leaderboard data for offline development preview.
 */
function getDevSampleLeaderboard(hackathonId: string): LeaderboardEntry[] {
  return [
    {
      hackathon_id: hackathonId,
      tenant_id: 'mitt',
      hackathon_title: 'MITT Innovate 2026',
      hackathon_slug: 'mitt-innovate-2026',
      hackathon_status: 'completed',
      results_announced_at: '2026-09-17T12:00:00Z',
      submission_id: 'sub-01',
      submission_title: 'NeuralByte: Autonomous Traffic Signal Optimization',
      submission_abstract:
        'Computer vision edge-inference system prioritizing emergency response vehicles and dynamically balancing metropolitan intersection throughput.',
      demo_url: 'https://traffic-demo.hackbridge.dev',
      repo_url: 'https://github.com/neuralbyte/edge-traffic',
      presentation_url: 'https://slides.com/neuralbyte/mitt2026',
      video_url: 'https://youtube.com/watch?v=neuralbyte',
      tech_stack: ['Python', 'YOLOv8', 'PyTorch', 'FastAPI', 'Redis'],
      submitted_at: '2026-09-17T08:30:00Z',
      team_id: 'team-01',
      team_name: 'NeuralByte',
      team_status: 'shortlisted',
      problem_id: 'prob-01',
      problem_title: 'Real-time Autonomous Traffic Signal Synchronization',
      problem_domain: 'Smart Cities',
      problem_difficulty: 'hard',
      company_id: 'comp-01',
      company_name: 'Bosch Engineering',
      company_logo_url: null,
      round: 1,
      score: 95.2,
      avg_score: 9.4,
      score_variance: 0.12,
      evaluator_count: 3,
      advance_votes: 3,
      reject_votes: 0,
      borderline_votes: 0,
      criterion_averages: {
        'Innovation & Novelty': 9.8,
        'Technical Complexity': 9.6,
        'Feasibility & Impact': 9.2,
        'Presentation & Demo': 9.5,
      },
      final_decision: 'winner',
      rank_overall: 1,
      rank_in_problem: 1,
    },
    {
      hackathon_id: hackathonId,
      tenant_id: 'mitt',
      hackathon_title: 'MITT Innovate 2026',
      hackathon_slug: 'mitt-innovate-2026',
      hackathon_status: 'completed',
      results_announced_at: '2026-09-17T12:00:00Z',
      submission_id: 'sub-02',
      submission_title: 'QuantEdge: Fraud Detection in Micro-Lending Transactions',
      submission_abstract:
        'Graph neural network fraud detection pipeline monitoring sub-second UPI micro-lending transactions with explainable SHAP risk factors.',
      demo_url: 'https://quantedge-fintech.dev',
      repo_url: 'https://github.com/quantedge/upi-fraud',
      presentation_url: 'https://slides.com/quantedge/deck',
      video_url: 'https://youtube.com/watch?v=quantedge',
      tech_stack: ['Python', 'Neo4j', 'PyTorch Geometric', 'Next.js'],
      submitted_at: '2026-09-17T09:00:00Z',
      team_id: 'team-02',
      team_name: 'QuantEdge',
      team_status: 'shortlisted',
      problem_id: 'prob-02',
      problem_title: 'Fraud Detection in Micro-Lending Transactions',
      problem_domain: 'FinTech',
      problem_difficulty: 'hard',
      company_id: 'comp-02',
      company_name: 'Razorpay',
      company_logo_url: null,
      round: 1,
      score: 92.4,
      avg_score: 9.1,
      score_variance: 0.18,
      evaluator_count: 3,
      advance_votes: 3,
      reject_votes: 0,
      borderline_votes: 0,
      criterion_averages: {
        'Innovation & Novelty': 9.2,
        'Technical Complexity': 9.5,
        'Feasibility & Impact': 9.0,
        'Presentation & Demo': 9.1,
      },
      final_decision: 'runner_up',
      rank_overall: 2,
      rank_in_problem: 1,
    },
    {
      hackathon_id: hackathonId,
      tenant_id: 'mitt',
      hackathon_title: 'MITT Innovate 2026',
      hackathon_slug: 'mitt-innovate-2026',
      hackathon_status: 'completed',
      results_announced_at: '2026-09-17T12:00:00Z',
      submission_id: 'sub-03',
      submission_title: 'EcoTrack: Decentralized Carbon Offset Verification',
      submission_abstract:
        'Zero-knowledge proof carbon verification network connecting industrial IoT sensors directly with auditable credit retirement pools.',
      demo_url: 'https://ecotrack.network',
      repo_url: 'https://github.com/ecotrack/ledger',
      presentation_url: 'https://slides.com/ecotrack/mitt',
      video_url: 'https://youtube.com/watch?v=ecotrack',
      tech_stack: ['Solidity', 'Circom', 'Node.js', 'PostgreSQL'],
      submitted_at: '2026-09-17T09:15:00Z',
      team_id: 'team-03',
      team_name: 'EcoTrack',
      team_status: 'shortlisted',
      problem_id: 'prob-03',
      problem_title: 'Decentralized Carbon Offset Verification Ledger',
      problem_domain: 'Sustainability',
      problem_difficulty: 'medium',
      company_id: 'comp-03',
      company_name: 'Infosys ESG',
      company_logo_url: null,
      round: 1,
      score: 89.6,
      avg_score: 8.8,
      score_variance: 0.25,
      evaluator_count: 3,
      advance_votes: 2,
      reject_votes: 0,
      borderline_votes: 1,
      criterion_averages: {
        'Innovation & Novelty': 9.0,
        'Technical Complexity': 8.8,
        'Feasibility & Impact': 8.7,
        'Presentation & Demo': 9.2,
      },
      final_decision: 'second_runner_up',
      rank_overall: 3,
      rank_in_problem: 1,
    },
    {
      hackathon_id: hackathonId,
      tenant_id: 'mitt',
      hackathon_title: 'MITT Innovate 2026',
      hackathon_slug: 'mitt-innovate-2026',
      hackathon_status: 'completed',
      results_announced_at: '2026-09-17T12:00:00Z',
      submission_id: 'sub-04',
      submission_title: 'PulseMedix: Edge-AI Arrhythmia Detection from Wearable ECG',
      submission_abstract:
        'Ultra-low power TinyML model deployed on wearable microcontrollers detecting 12 distinct cardiovascular anomalies with 98.4% accuracy.',
      demo_url: 'https://pulsemedix.health',
      repo_url: 'https://github.com/pulsemedix/tinyml-ecg',
      presentation_url: 'https://slides.com/pulsemedix/deck',
      video_url: 'https://youtube.com/watch?v=pulsemedix',
      tech_stack: ['C++', 'TinyML', 'TensorFlow Lite', 'Flutter'],
      submitted_at: '2026-09-17T09:30:00Z',
      team_id: 'team-04',
      team_name: 'PulseMedix',
      team_status: 'shortlisted',
      problem_id: 'prob-04',
      problem_title: 'Edge-AI Early Arrhythmia Detection',
      problem_domain: 'HealthTech',
      problem_difficulty: 'hard',
      company_id: 'comp-04',
      company_name: 'Siemens Healthineers',
      company_logo_url: null,
      round: 1,
      score: 87.1,
      avg_score: 8.6,
      score_variance: 0.15,
      evaluator_count: 3,
      advance_votes: 2,
      reject_votes: 0,
      borderline_votes: 1,
      criterion_averages: {
        'Innovation & Novelty': 8.8,
        'Technical Complexity': 9.1,
        'Feasibility & Impact': 8.4,
        'Presentation & Demo': 8.5,
      },
      final_decision: 'top_10',
      rank_overall: 4,
      rank_in_problem: 1,
    },
    {
      hackathon_id: hackathonId,
      tenant_id: 'mitt',
      hackathon_title: 'MITT Innovate 2026',
      hackathon_slug: 'mitt-innovate-2026',
      hackathon_status: 'completed',
      results_announced_at: '2026-09-17T12:00:00Z',
      submission_id: 'sub-05',
      submission_title: 'AgroSense: Hyperlocal Soil Moisture Predictive Modeling',
      submission_abstract:
        'Satellite imagery combined with ground IoT mesh nodes generating precision irrigation recommendations for drought-prone farming clusters.',
      demo_url: 'https://agrosense.farm',
      repo_url: 'https://github.com/agrosense/iot-mesh',
      presentation_url: 'https://slides.com/agrosense/slides',
      video_url: 'https://youtube.com/watch?v=agrosense',
      tech_stack: ['Python', 'LoRaWAN', 'GeoPandas', 'React'],
      submitted_at: '2026-09-17T09:45:00Z',
      team_id: 'team-05',
      team_name: 'AgroSense',
      team_status: 'shortlisted',
      problem_id: 'prob-05',
      problem_title: 'Hyperlocal Soil Moisture Predictive Modeling',
      problem_domain: 'AgriTech',
      problem_difficulty: 'medium',
      company_id: 'comp-05',
      company_name: 'CropIn Tech',
      company_logo_url: null,
      round: 1,
      score: 85.3,
      avg_score: 8.4,
      score_variance: 0.19,
      evaluator_count: 3,
      advance_votes: 2,
      reject_votes: 0,
      borderline_votes: 1,
      criterion_averages: {
        'Innovation & Novelty': 8.4,
        'Technical Complexity': 8.5,
        'Feasibility & Impact': 8.8,
        'Presentation & Demo': 8.3,
      },
      final_decision: 'top_10',
      rank_overall: 5,
      rank_in_problem: 1,
    },
  ];
}
