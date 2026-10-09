import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Award,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Github,
  Globe,
  Presentation,
  Video,
  Layers,
  ShieldAlert,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import {
  fetchAssignmentDetail,
  fetchEvaluatorAssignments,
  submitEvaluationScore,
  declareConflictOfInterest,
  calculateWeightedScores,
} from '../../lib/evaluations';
import type {
  EvaluationAssignmentWithDetails,
  Hackathon,
  EvaluationRubricCriterion,
  EvaluationRecommendation,
} from '../../types/database';

const DEFAULT_RUBRIC: EvaluationRubricCriterion[] = [
  { criterion: 'Innovation & Novelty', name: 'Innovation & Novelty', description: 'Uniqueness of the solution, creativity of the approach.', weight: 25, max_score: 10 },
  { criterion: 'Technical Complexity', name: 'Technical Complexity', description: 'Architecture soundness, code quality, technology stack mastery.', weight: 30, max_score: 10 },
  { criterion: 'Feasibility & Impact', name: 'Feasibility & Impact', description: 'Practical real-world viability, execution completeness, and scalability.', weight: 25, max_score: 10 },
  { criterion: 'Presentation & Demo', name: 'Presentation & Demo', description: 'Clarity of the video walkthrough, slide deck, and live working demo.', weight: 20, max_score: 10 },
];

export const EvaluatorScoringPage: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [allAssignments, setAllAssignments] = useState<EvaluationAssignmentWithDetails[]>([]);
  const [assignment, setAssignment] = useState<EvaluationAssignmentWithDetails | null>(null);
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [rubric, setRubric] = useState<EvaluationRubricCriterion[]>(DEFAULT_RUBRIC);

  // Scoring Form State
  const [scores, setScores] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [recommendation, setRecommendation] = useState<EvaluationRecommendation>('advance');
  const [privateNotes, setPrivateNotes] = useState('');
  const [publicFeedback, setPublicFeedback] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCoiModal, setShowCoiModal] = useState(false);
  const [coiReason, setCoiReason] = useState('');
  const [isCoiSubmitting, setIsCoiSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── 1. Load Assignment Detail ─────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    const effectiveUserId = user.id;

    try {
      // 1. Fetch evaluator assignments list to support switching entries directly in scoring desk
      const { assignments: list } = await fetchEvaluatorAssignments(effectiveUserId);
      setAllAssignments(list);

      let targetId = assignmentId;
      if (!targetId && list.length > 0) {
        const pending = list.find((a) => a.status === 'pending' || a.status === 'in_progress');
        targetId = (pending || list[0]).id;
      }

      if (!targetId) {
        setErrorMessage('No submissions currently assigned to your evaluator profile.');
        setIsLoading(false);
        return;
      }

      const { assignment: detail, hackathon: h, error } = await fetchAssignmentDetail(targetId);

      if (error || !detail) {
        setErrorMessage(error || 'Failed to load assignment details.');
        setIsLoading(false);
        return;
      }

      setAssignment(detail);
      setHackathon(h);

      // Load rubric from hackathon configuration or fallback to default
      const eventRubric =
        h?.evaluation_rubric && h.evaluation_rubric.length > 0
          ? h.evaluation_rubric
          : DEFAULT_RUBRIC;
      setRubric(eventRubric);

      // Pre-populate if already scored
      if (detail.existing_score) {
        const ex = detail.existing_score;
        setScores(ex.scores || {});
        setStrengths(ex.strengths || '');
        setWeaknesses(ex.weaknesses || '');
        setRecommendation(ex.recommendation || 'advance');
        setPrivateNotes(ex.private_notes || '');
        setPublicFeedback(ex.public_feedback || '');
      } else {
        // Default initial score to 7.0 for each rubric criterion
        const initialScores: Record<string, number> = {};
        eventRubric.forEach((crit) => {
          const key = crit.criterion || crit.name || 'Criterion';
          initialScores[key] = 7.0;
        });
        setScores(initialScores);
      }
    } catch (err: any) {
      console.warn('[EvaluatorScoringPage] Error loading scoring data:', err);
      setErrorMessage(err?.message || 'Unable to load scoring workspace.');
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId, user?.id]);

  useEffect(() => {
    const safety = setTimeout(() => setIsLoading(false), 1000);
    loadData().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [loadData]);

  // ── 2. Real-Time Calculations ─────────────────────────────────────────────

  const { totalScore, weightedScore } = calculateWeightedScores(scores, rubric);

  const handleScoreChange = (criterionName: string, value: number) => {
    setScores((prev) => ({
      ...prev,
      [criterionName]: value,
    }));
  };

  // ── 3. Submit Evaluation Score ────────────────────────────────────────────

  const handleSubmitScore = async () => {
    if (!assignment || !user?.id) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { success, error } = await submitEvaluationScore({
      assignment_id: assignment.id,
      submission_id: assignment.submission.id,
      evaluator_id: user.id,
      round: assignment.round,
      scores,
      rubric,
      strengths,
      weaknesses,
      recommendation,
      private_notes: privateNotes,
      public_feedback: publicFeedback,
    });

    setIsSubmitting(false);

    if (!success) {
      setErrorMessage(error || 'Failed to submit evaluation.');
    } else {
      setSuccessMessage('🎉 Evaluation score submitted successfully!');
      setTimeout(() => {
        navigate('/evaluator/assignments');
      }, 1500);
    }
  };

  // ── 4. Conflict of Interest (COI) Recusal ─────────────────────────────────

  const handleConfirmCoi = async () => {
    if (!assignment || !user?.id) return;
    if (!coiReason.trim()) {
      setErrorMessage('Please state the nature of the conflict of interest.');
      return;
    }

    setIsCoiSubmitting(true);
    setErrorMessage(null);

    const { success, error } = await declareConflictOfInterest(
      assignment.id,
      assignment.submission.id,
      user.id,
      assignment.round,
      coiReason.trim()
    );

    setIsCoiSubmitting(false);
    setShowCoiModal(false);

    if (!success) {
      setErrorMessage(error || 'Failed to submit recusal.');
    } else {
      setSuccessMessage('Conflict of interest recorded. You have been recused from this submission.');
      setTimeout(() => {
        navigate('/evaluator/assignments');
      }, 1500);
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center text-slate-400">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs">Loading double-blind evaluation workspace...</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900">Assignment Not Found</h3>
        <p className="text-xs text-slate-500">
          This evaluation assignment may have been reassigned or does not belong to your profile.
        </p>
        <Link to="/evaluator/assignments">
          <Button size="sm" variant="outline">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Assigned Queue
          </Button>
        </Link>
      </div>
    );
  }

  const sub = assignment.submission;
  const isRecused = assignment.status === 'recused';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link to="/evaluator/assignments">
            <Button size="sm" variant="outline" className="text-xs">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Queue
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                Evaluation: {sub.team?.name}
              </h1>
              <Badge variant="outline" className="text-[10px]">
                Round {assignment.round}
              </Badge>
              <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-700">
                Double-Blind Masked
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Event: {hackathon?.title || 'Hackathon'} · Student identities concealed to eliminate bias.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {allAssignments.length > 1 && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
              <label htmlFor="submission-switcher" className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                Review Entry:
              </label>
              <select
                id="submission-switcher"
                value={assignment.id}
                onChange={(e) => navigate(`/evaluator/score/${e.target.value}`)}
                className="text-xs font-semibold bg-transparent text-slate-800 focus:outline-none cursor-pointer"
              >
                {allAssignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.submission.title.length > 35 ? a.submission.title.substring(0, 35) + '...' : a.submission.title} ({a.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* COI Recusal Trigger */}
          {!isRecused && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-amber-700 hover:bg-amber-50 border border-amber-200"
              onClick={() => setShowCoiModal(true)}
            >
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              Declare Conflict of Interest
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="font-semibold">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <p className="font-semibold">{errorMessage}</p>
        </div>
      )}

      {isRecused && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">You are Recused from Scoring this Submission</p>
            <p className="mt-1 text-amber-800">
              Reason: {assignment.existing_score?.coi_reason || 'Conflict of interest declared by evaluator.'}
            </p>
          </div>
        </div>
      )}

      {/* Split Workspace: Left Dossier / Right Rubric */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Double-Blind Project Dossier (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3">
              <CardTitle className="text-xs uppercase font-bold text-slate-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                Project Submission Dossier
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              {/* Project Title */}
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Project Title
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  {sub.title}
                </h2>
              </div>

              {/* Problem Statement Pill */}
              {sub.problem_statement && (
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <span className="text-[10px] font-bold uppercase text-indigo-600 block">
                    Assigned Challenge Domain
                  </span>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {sub.problem_statement.title}
                  </p>
                  <span className="text-[10px] text-indigo-600 mt-0.5 inline-block">
                    Domain: {sub.problem_statement.domain} · Tier: {sub.problem_statement.difficulty}
                  </span>
                </div>
              )}

              {/* Executive Abstract */}
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Executive Abstract
                </span>
                <p className="text-slate-700 leading-relaxed mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200/80 whitespace-pre-wrap">
                  {sub.abstract}
                </p>
              </div>

              {/* Technical Approach if provided */}
              {sub.approach && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Technical Architecture &amp; Methodology
                  </span>
                  <p className="text-slate-700 leading-relaxed mt-1 p-3 bg-slate-50 rounded-xl border border-slate-200/80 whitespace-pre-wrap">
                    {sub.approach}
                  </p>
                </div>
              )}

              {/* Deliverable Artifacts */}
              <div className="border-t border-slate-100 pt-3">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">
                  Verified Deliverable Links
                </span>
                <div className="space-y-2">
                  {sub.repo_url && (
                    <a
                      href={sub.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 flex items-center justify-between transition-colors group"
                    >
                      <span className="flex items-center gap-2 text-slate-800 font-medium">
                        <Github className="w-4 h-4 text-slate-700" /> Source Code Repository
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                    </a>
                  )}

                  {sub.demo_url && (
                    <a
                      href={sub.demo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 flex items-center justify-between transition-colors group"
                    >
                      <span className="flex items-center gap-2 text-slate-800 font-medium">
                        <Globe className="w-4 h-4 text-emerald-600" /> Live Deployed Demo
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                    </a>
                  )}

                  {sub.presentation_url && (
                    <a
                      href={sub.presentation_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 flex items-center justify-between transition-colors group"
                    >
                      <span className="flex items-center gap-2 text-slate-800 font-medium">
                        <Presentation className="w-4 h-4 text-amber-600" /> Pitch Deck / Slides
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
                    </a>
                  )}

                  {sub.video_url && (
                    <a
                      href={sub.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50/30 flex items-center justify-between transition-colors group"
                    >
                      <span className="flex items-center gap-2 text-slate-800 font-medium">
                        <Video className="w-4 h-4 text-rose-600" /> Video Walkthrough
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600" />
                    </a>
                  )}
                </div>
              </div>

              {/* Tech Stack */}
              {sub.tech_stack && sub.tech_stack.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                    Claimed Tech Stack
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {sub.tech_stack.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Rubric Scoring Engine (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Live Score Counter Ribbon */}
          <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl shadow-sm flex items-center justify-between border border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                Calculated Weighted Score
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-black text-white">{weightedScore}</span>
                <span className="text-xs text-indigo-300">/ 10.0</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Raw Total
              </span>
              <span className="text-base font-bold text-slate-200">{totalScore} pts</span>
            </div>
          </div>

          {/* Rubric Sliders Card */}
          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-indigo-600" />
                  Official Evaluation Rubric
                </CardTitle>
                <span className="text-[11px] text-slate-400">
                  {rubric.length} Criteria · Weighted 100%
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {rubric.map((criterion, idx) => {
                const critName = criterion.criterion || criterion.name || `Criterion ${idx + 1}`;
                const max = criterion.max_score || 10;
                const currentScore = scores[critName] ?? 0;

                return (
                  <div
                    key={critName}
                    className="p-3.5 rounded-xl border border-slate-200/80 bg-white space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">
                            {critName}
                          </h4>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            Weight: {criterion.weight}%
                          </span>
                        </div>
                        {criterion.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {criterion.description}
                          </p>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 font-mono">
                          {currentScore.toFixed(1)} / {max}
                        </span>
                      </div>
                    </div>

                    {/* Range Slider */}
                    <div className="pt-1">
                      <input
                        type="range"
                        min="0"
                        max={max}
                        step="0.5"
                        disabled={isRecused}
                        value={currentScore}
                        onChange={(e) => handleScoreChange(critName, parseFloat(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer disabled:opacity-50"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>0 (Poor)</span>
                        <span>{max / 2} (Average)</span>
                        <span>{max} (Exceptional)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Qualitative Critique */}
          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3">
              <CardTitle className="text-xs uppercase font-bold text-slate-500 flex items-center gap-1.5">
                Qualitative Feedback &amp; Deliberation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              {/* Recommendation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Evaluator Recommendation for Next Round
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={isRecused}
                    onClick={() => setRecommendation('advance')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      recommendation === 'advance'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ✓ Advance to Finals
                  </button>
                  <button
                    type="button"
                    disabled={isRecused}
                    onClick={() => setRecommendation('borderline')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      recommendation === 'borderline'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ⚖ Borderline / Waitlist
                  </button>
                  <button
                    type="button"
                    disabled={isRecused}
                    onClick={() => setRecommendation('reject')}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      recommendation === 'reject'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ✗ Do Not Advance
                  </button>
                </div>
              </div>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Key Strengths
                  </label>
                  <Textarea
                    rows={3}
                    placeholder="Standout architectural decisions, execution velocity..."
                    disabled={isRecused}
                    value={strengths}
                    onChange={(e) => setStrengths(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Areas for Improvement
                  </label>
                  <Textarea
                    rows={3}
                    placeholder="Scalability bottlenecks, missing edge cases..."
                    disabled={isRecused}
                    value={weaknesses}
                    onChange={(e) => setWeaknesses(e.target.value)}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confidential Committee Notes (Visible only to judges &amp; college admin)
                </label>
                <Textarea
                  rows={2}
                  placeholder="Private commentary for jury deliberation..."
                  disabled={isRecused}
                  value={privateNotes}
                  onChange={(e) => setPrivateNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Constructive Team Feedback (Shared with student team after results)
                </label>
                <Textarea
                  rows={2}
                  placeholder="Helpful advice for students to improve their project..."
                  disabled={isRecused}
                  value={publicFeedback}
                  onChange={(e) => setPublicFeedback(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Action Bar */}
          {!isRecused && (
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500">
                Submitting updates the live aggregate score and completes this assignment.
              </span>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                onClick={handleSubmitScore}
                isLoading={isSubmitting}
              >
                <Check className="w-4 h-4 mr-1.5" />
                Submit Official Score ({weightedScore} / 10)
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Conflict of Interest (COI) Modal */}
      {showCoiModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Declare Conflict of Interest (COI)
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                If you mentored, personally advise, or have an affiliation with the participants behind this project, please recuse yourself. Your assignment will be marked <strong>recused</strong> and removed from your scoring quota.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Recusal <span className="text-rose-500">*</span>
              </label>
              <Textarea
                rows={3}
                placeholder="e.g. I served as faculty advisor to this student team..."
                value={coiReason}
                onChange={(e) => setCoiReason(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCoiModal(false)}
                disabled={isCoiSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleConfirmCoi}
                isLoading={isCoiSubmitting}
              >
                Confirm Recusal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
