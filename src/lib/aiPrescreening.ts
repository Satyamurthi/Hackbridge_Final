import { supabase, isSupabaseConfigured } from './supabase';
import type { Submission, SubmissionWithDetails, ProblemStatement } from '../types/database';

export interface AIScores {
  relevance: number;      // 1.0 - 10.0
  completeness: number;   // 1.0 - 10.0
  innovation: number;     // 1.0 - 10.0
  overall: number;        // weighted average
}

export interface AIPrescreeningResult {
  scores: AIScores;
  summary: string;
  flags: string[];
}

export interface PrescreeningSummaryStats {
  totalSubmissions: number;
  screenedCount: number;
  averageScore: number;
  flaggedCount: number;
}

/**
 * Domain keyword mapping for semantic cross-referencing against problem statements.
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  ai: ['ai', 'ml', 'machine learning', 'deep learning', 'neural', 'nlp', 'vision', 'llm', 'model', 'dataset', 'pytorch', 'tensorflow'],
  healthcare: ['health', 'medical', 'doctor', 'patient', 'hospital', 'clinical', 'diagnosis', 'treatment', 'disease', 'care', 'telemedicine'],
  fintech: ['finance', 'payment', 'banking', 'fraud', 'crypto', 'blockchain', 'ledger', 'wallet', 'transaction', 'defi', 'credit'],
  edtech: ['education', 'learning', 'student', 'teacher', 'course', 'quiz', 'classroom', 'pedagogy', 'academic', 'curriculum', 'school'],
  smart_city: ['traffic', 'transit', 'iot', 'sensor', 'urban', 'parking', 'waste', 'city', 'infrastructure', 'energy', 'water'],
  agritech: ['crop', 'farmer', 'farm', 'soil', 'irrigation', 'weather', 'harvest', 'agriculture', 'yield', 'pest', 'fertilizer'],
  cybersecurity: ['security', 'auth', 'encryption', 'vulnerability', 'threat', 'firewall', 'attack', 'breach', 'zero-trust', 'audit'],
};

/**
 * Modern high-impact technology keywords that indicate advanced technical architecture.
 */
const HIGH_IMPACT_TECH = [
  'pytorch', 'tensorflow', 'langchain', 'openai', 'fastapi', 'docker', 'kubernetes',
  'opencv', 'transformers', 'graphql', 'webrtc', 'redis', 'kafka', 'solidity',
  'rust', 'go', 'webassembly', 'next.js', 'react', 'supabase', 'flutter'
];

/**
 * Pure heuristic and natural language analyzer that produces preliminary
 * AI pre-screening scores, executive synthesis, and anomaly flags.
 */
export function analyzeSubmission(
  submission: Submission,
  problem?: ProblemStatement | null
): AIPrescreeningResult {
  const flags: string[] = [];
  const textContent = `${submission.title} ${submission.abstract} ${submission.approach || ''}`.toLowerCase();
  const techStack = (submission.tech_stack || []).map((t) => t.toLowerCase());

  // ── 1. Completeness Score (1.0 - 10.0) ────────────────────────────────────
  let completenessScore = 3.0; // Base score for having title + abstract

  // Word count assessment
  const wordCount = submission.abstract.trim().split(/\s+/).length;
  if (wordCount >= 120) {
    completenessScore += 2.0;
  } else if (wordCount >= 50) {
    completenessScore += 1.0;
  } else {
    flags.push('brief_abstract_under_50_words');
  }

  // Technical approach provided
  if (submission.approach && submission.approach.trim().length > 60) {
    completenessScore += 1.5;
  } else {
    flags.push('minimal_technical_approach');
  }

  // Multi-format artifacts check
  let deliverableCount = 0;
  if (submission.repo_url) {
    completenessScore += 1.5;
    deliverableCount++;
  } else {
    flags.push('missing_source_repository');
  }

  if (submission.demo_url) {
    completenessScore += 1.0;
    deliverableCount++;
  } else {
    flags.push('missing_live_demo');
  }

  if (submission.presentation_url) {
    completenessScore += 0.5;
    deliverableCount++;
  }

  if (submission.video_url) {
    completenessScore += 0.5;
    deliverableCount++;
  }

  if (deliverableCount >= 3) {
    flags.push('comprehensive_deliverables');
  }

  completenessScore = Math.min(10.0, Math.max(1.0, completenessScore));

  // ── 2. Relevance Score (1.0 - 10.0) ──────────────────────────────────────
  let relevanceScore = 6.0; // Neutral baseline

  if (problem) {
    const problemDomain = (problem.domain || '').toLowerCase().replace(/\s+/g, '_');

    // Domain keyword matching
    const keywords = DOMAIN_KEYWORDS[problemDomain] || [];
    let domainMatches = 0;
    for (const kw of keywords) {
      if (textContent.includes(kw)) {
        domainMatches++;
      }
    }

    // Direct title keyword overlap
    const problemWords = problem.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    let titleMatches = 0;
    for (const pw of problemWords) {
      if (textContent.includes(pw)) {
        titleMatches++;
      }
    }

    if (domainMatches >= 3 || titleMatches >= 2) {
      relevanceScore = 8.5;
    } else if (domainMatches >= 1 || titleMatches >= 1) {
      relevanceScore = 7.5;
    } else {
      relevanceScore = 5.0;
      flags.push('low_domain_alignment');
    }

    // Check if preferred tech mentioned in problem matches tech stack
    if (problem.tech_preferences && problem.tech_preferences.length > 0) {
      const matchedTech = problem.tech_preferences.filter((pTech) =>
        techStack.some((t) => t.includes(pTech.toLowerCase()) || pTech.toLowerCase().includes(t))
      );
      if (matchedTech.length > 0) {
        relevanceScore = Math.min(10.0, relevanceScore + 1.0);
      }
    }
  } else {
    // Open innovation submission
    relevanceScore = 7.5;
  }

  relevanceScore = Math.min(10.0, Math.max(1.0, relevanceScore));

  // ── 3. Innovation Score (1.0 - 10.0) ─────────────────────────────────────
  let innovationScore = 5.5; // Baseline

  // Advanced tech stack bonus
  const matchedHighImpact = techStack.filter((tech) =>
    HIGH_IMPACT_TECH.some((hit) => tech.includes(hit))
  );
  if (matchedHighImpact.length >= 3) {
    innovationScore += 2.5;
    flags.push('advanced_tech_stack');
  } else if (matchedHighImpact.length >= 1) {
    innovationScore += 1.5;
  }

  // Problem difficulty factor
  if (problem?.difficulty === 'hard') {
    innovationScore += 1.5;
  } else if (problem?.difficulty === 'medium') {
    innovationScore += 0.5;
  }

  if (innovationScore >= 8.0) {
    flags.push('high_innovation_potential');
  }

  innovationScore = Math.min(10.0, Math.max(1.0, innovationScore));

  // ── 4. Composite Score (Weighted) ────────────────────────────────────────
  // Relevance (40%) + Completeness (35%) + Innovation (25%)
  const overall = Number(
    (relevanceScore * 0.4 + completenessScore * 0.35 + innovationScore * 0.25).toFixed(1)
  );

  // ── 5. Executive Synthesis Summary ───────────────────────────────────────
  const summaryParts: string[] = [];
  summaryParts.push(`**Core Solution:** ${submission.title}.`);
  summaryParts.push(
    `**Abstract Scope:** ${wordCount} words addressing ${
      problem ? `"${problem.title}"` : 'open innovation challenge'
    }.`
  );

  if (techStack.length > 0) {
    summaryParts.push(`**Architecture Stack:** ${submission.tech_stack.join(', ')}.`);
  }

  summaryParts.push(
    `**Deliverables Audit:** ${submission.repo_url ? '✓ Code Repo' : '✗ Missing Repo'} | ${
      submission.demo_url ? '✓ Live Demo' : '✗ Missing Demo'
    } | ${submission.presentation_url ? '✓ Slide Deck' : '✗ No Slides'} | ${
      submission.video_url ? '✓ Video Walkthrough' : '✗ No Video'
    }.`
  );

  if (flags.some((f) => f.includes('missing') || f.includes('low') || f.includes('brief'))) {
    summaryParts.push(
      `**Committee Attention:** Preliminary automated review identified potential deliverable or domain gaps.`
    );
  } else {
    summaryParts.push(
      `**Pre-Screening Readiness:** Submission satisfies deliverable criteria and is primed for human rubric evaluation.`
    );
  }

  return {
    scores: {
      relevance: Number(relevanceScore.toFixed(1)),
      completeness: Number(completenessScore.toFixed(1)),
      innovation: Number(innovationScore.toFixed(1)),
      overall,
    },
    summary: summaryParts.join(' '),
    flags,
  };
}

/**
 * Run AI pre-screening on a single submission and persist results to Supabase.
 */
export async function runSubmissionPrescreening(
  submissionId: string
): Promise<{ success: boolean; result: AIPrescreeningResult | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, result: null, error: 'Supabase is not configured.' };
  }

  try {
    // 1. Fetch submission with details
    const { data: sub, error: fetchErr } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (fetchErr || !sub) {
      return { success: false, result: null, error: fetchErr?.message || 'Submission not found.' };
    }

    // 2. Fetch associated problem statement if any
    let problem: ProblemStatement | null = null;
    if (sub.problem_id) {
      const { data: ps } = await supabase
        .from('problem_statements')
        .select('*')
        .eq('id', sub.problem_id)
        .maybeSingle();
      problem = ps;
    }

    // 3. Compute analysis
    const analysis = analyzeSubmission(sub as Submission, problem);

    // 4. Update Supabase record
    const { error: updateErr } = await supabase
      .from('submissions')
      .update({
        ai_summary: analysis.summary,
        ai_scores: analysis.scores,
        ai_flags: analysis.flags,
      } as any)
      .eq('id', submissionId);

    if (updateErr) {
      return { success: false, result: null, error: updateErr.message };
    }

    return { success: true, result: analysis, error: null };
  } catch (err: any) {
    return { success: false, result: null, error: err.message || 'Error running pre-screening.' };
  }
}

/**
 * Batch run AI pre-screening across all finalized submissions in a hackathon.
 */
export async function batchPrescreenHackathonSubmissions(
  hackathonId: string
): Promise<{ success: boolean; processedCount: number; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, processedCount: 0, error: 'Supabase is not configured.' };
  }

  try {
    // Fetch all finalized submissions for this hackathon
    const { data: submissions, error: listErr } = await supabase
      .from('submissions')
      .select('id, problem_id')
      .eq('hackathon_id', hackathonId)
      .eq('is_final', true);

    if (listErr) throw listErr;
    if (!submissions || submissions.length === 0) {
      return { success: true, processedCount: 0, error: null };
    }

    let processedCount = 0;
    for (const sub of submissions) {
      const res = await runSubmissionPrescreening(sub.id);
      if (res.success) processedCount++;
    }

    return { success: true, processedCount, error: null };
  } catch (err: any) {
    return { success: false, processedCount: 0, error: err.message || 'Batch pre-screening failed.' };
  }
}

/**
 * Fetch all finalized submissions for a hackathon joined with teams and problem statements
 * for the Committee Pre-Screening console.
 */
export async function fetchHackathonPrescreeningSubmissions(
  hackathonId: string
): Promise<{ submissions: SubmissionWithDetails[]; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { submissions: [], error: 'Supabase is not configured.' };
  }

  try {
    const { data: subList, error: subErr } = await supabase
      .from('submissions')
      .select('*')
      .eq('hackathon_id', hackathonId)
      .eq('is_final', true)
      .order('submitted_at', { ascending: false });

    if (subErr) throw subErr;
    if (!subList || subList.length === 0) {
      const { MOCK_SUBMISSIONS } = await import('./mockData');
      return { submissions: MOCK_SUBMISSIONS, error: null };
    }

    const teamIds = Array.from(new Set(subList.map((s) => s.team_id).filter((id): id is string => Boolean(id))));
    const problemIds = Array.from(new Set(subList.map((s) => s.problem_id).filter((id): id is string => Boolean(id))));

    const [{ data: teams }, { data: problems }] = await Promise.all([
      teamIds.length > 0
        ? supabase.from('teams').select('*').in('id', teamIds)
        : Promise.resolve({ data: [] }),
      problemIds.length > 0
        ? supabase.from('problem_statements').select('*').in('id', problemIds)
        : Promise.resolve({ data: [] }),
    ]);

    const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));
    const problemMap = new Map((problems ?? []).map((p) => [p.id, p]));

    const fullList: SubmissionWithDetails[] = subList.map((sub) => {
      const t = teamMap.get(sub.team_id);
      return {
        ...sub,
        team: t ? ({ ...t, members: [] } as any) : null,
        problem_statement: sub.problem_id ? problemMap.get(sub.problem_id) ?? null : null,
      };
    });

    return { submissions: fullList, error: null };
  } catch (err: any) {
    const { MOCK_SUBMISSIONS } = await import('./mockData');
    return { submissions: MOCK_SUBMISSIONS, error: null };
  }
}
