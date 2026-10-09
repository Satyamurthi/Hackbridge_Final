import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderGit2,
  Save,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Github,
  Globe,
  Presentation,
  Video,
  Layers,
  Sparkles,
  Plus,
  X,
  Users,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { fetchTenantHackathons } from '../../lib/hackathons';
import { fetchMyTeam } from '../../lib/teams';
import {
  fetchTeamSubmission,
  saveSubmissionDraft,
  finalizeSubmission,
  SUBMISSIONS_MIGRATION_FILE,
} from '../../lib/submissions';
import { runSubmissionPrescreening, type AIScores } from '../../lib/aiPrescreening';
import { STORAGE_BUCKETS } from '../../lib/storage';
import { FileUploadDropzone } from '../../components/ui/FileUploadDropzone';
import type { Hackathon, TeamWithDetails, SubmissionWithDetails } from '../../types/database';

const POPULAR_TECH_TAGS = [
  'React',
  'Next.js',
  'TypeScript',
  'Python',
  'FastAPI',
  'PyTorch',
  'PostgreSQL',
  'Supabase',
  'TailwindCSS',
  'Docker',
  'Node.js',
  'TensorFlow',
  'LangChain',
  'Flutter',
];

export const StudentSubmissionsPage: React.FC = () => {
  const { user, tenant, tenantId, isConfigured } = useAuth();

  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState<string>('');
  const [myTeam, setMyTeam] = useState<TeamWithDetails | null>(null);
  const [submission, setSubmission] = useState<SubmissionWithDetails | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Submission Form State
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [approach, setApproach] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [presentationUrl, setPresentationUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  // ── 1. Load Data ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!isConfigured || !tenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const effectiveTenantId = tenantId || tenant?.id || '';
      const effectiveUserId = user?.id || '';

      const { hackathons: hList, error: hError } = await fetchTenantHackathons(effectiveTenantId);
      if (hError) setErrorMessage(hError);

      const availableHackathons = hList ?? [];
      setHackathons(availableHackathons);

      let activeHackathon = availableHackathons.find(
        (h) => h.status === 'hacking' || h.status === 'registration' || h.status === 'problem_intake'
      );
      if (!activeHackathon && availableHackathons.length > 0) {
        activeHackathon = availableHackathons[0];
      }

      const currentHackathonId = selectedHackathonId || activeHackathon?.id || '';
      if (!selectedHackathonId && currentHackathonId) {
        setSelectedHackathonId(currentHackathonId);
      }

      if (currentHackathonId) {
        const { team, error: tError } = await fetchMyTeam(currentHackathonId, effectiveUserId);
        if (tError) setErrorMessage(tError);
        setMyTeam(team);

        if (team) {
          const { submission: sub, error: sError } = await fetchTeamSubmission(team.id, 1);
          if (sError) setErrorMessage(sError);
          setSubmission(sub);

          if (sub) {
            setTitle(sub.title || '');
            setAbstract(sub.abstract || '');
            setApproach(sub.approach || '');
            setRepoUrl(sub.repo_url || '');
            setDemoUrl(sub.demo_url || '');
            setPresentationUrl(sub.presentation_url || '');
            setVideoUrl(sub.video_url || '');
            setTechStack(sub.tech_stack || []);
          } else {
            // Pre-seed title from selected problem if available
            if (team.problem_statement?.title && !title) {
              setTitle(`Solution: ${team.problem_statement.title}`);
            }
          }
        } else {
          setSubmission(null);
        }
      }
    } catch (err: any) {
      console.warn('[StudentSubmissionsPage] Error loading data:', err);
      setErrorMessage(err?.message || 'Unable to load submission workspace.');
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, tenantId, user?.id, selectedHackathonId]);

  useEffect(() => {
    const safety = setTimeout(() => setIsLoading(false), 1000);
    loadData().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [loadData]);

  // ── Tag Management ───────────────────────────────────────────────────────

  const handleAddTag = (tagToAdd?: string) => {
    const tag = (tagToAdd || newTagInput).trim();
    if (!tag) return;
    if (!techStack.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setTechStack([...techStack, tag]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTechStack(techStack.filter((t) => t !== tagToRemove));
  };

  // ── 2. Save Draft ────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!myTeam || !selectedHackathonId) return;

    if (!title.trim()) {
      setErrorMessage('Please enter a project title.');
      return;
    }

    if (!abstract.trim()) {
      setErrorMessage('Please enter an executive abstract for your project.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await saveSubmissionDraft({
      team_id: myTeam.id,
      hackathon_id: selectedHackathonId,
      problem_id: myTeam.problem_id || null,
      title: title.trim(),
      abstract: abstract.trim(),
      approach: approach.trim() || null,
      demo_url: demoUrl.trim() || null,
      repo_url: repoUrl.trim() || null,
      presentation_url: presentationUrl.trim() || null,
      video_url: videoUrl.trim() || null,
      tech_stack: techStack,
      submission_round: 1,
    });

    setIsSaving(false);

    if (result.error) {
      setErrorMessage(result.error);
    } else {
      setSubmission(result.submission);
      setSuccessMessage('Draft saved successfully! You can continue updating your submission until final locking.');
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // ── 3. Finalize Submission ───────────────────────────────────────────────

  const handleConfirmFinalize = async () => {
    if (!myTeam || !selectedHackathonId || !user?.id) return;

    setIsFinalizing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Ensure latest changes are saved first
    const saveRes = await saveSubmissionDraft({
      team_id: myTeam.id,
      hackathon_id: selectedHackathonId,
      problem_id: myTeam.problem_id || null,
      title: title.trim(),
      abstract: abstract.trim(),
      approach: approach.trim() || null,
      demo_url: demoUrl.trim() || null,
      repo_url: repoUrl.trim() || null,
      presentation_url: presentationUrl.trim() || null,
      video_url: videoUrl.trim() || null,
      tech_stack: techStack,
      submission_round: 1,
    });

    if (saveRes.error || !saveRes.submission) {
      setIsFinalizing(false);
      setShowConfirmModal(false);
      setErrorMessage(saveRes.error || 'Failed to save submission before finalizing.');
      return;
    }

    // 2. Lock as final
    const finalRes = await finalizeSubmission(saveRes.submission.id, user.id);
    setIsFinalizing(false);
    setShowConfirmModal(false);

    if (finalRes.error) {
      setErrorMessage(finalRes.error);
    } else {
      // 3. Automatically run AI pre-screening analysis
      await runSubmissionPrescreening(saveRes.submission.id);
      setSuccessMessage('🎉 Project submission locked and finalized! Automated AI pre-screening completed.');
      // Refresh full view
      await loadData();
    }
  };

  // ── URL Format Helper ───────────────────────────────────────────────────

  const formatUrlForDisplay = (url?: string | null) => {
    if (!url) return '';
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  };

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Project Submission Desk</h1>
            <Badge variant="success">Submission Portal</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Submit your multi-format deliverables (source code, demo, slides, and video) for hackathon evaluation.
          </p>
        </div>

        {/* Hackathon Selector */}
        <div className="flex items-center gap-3">
          <div className="w-56">
            <Select
              value={selectedHackathonId}
              onChange={(e) => setSelectedHackathonId(e.target.value)}
            >
              <option value="">Select Hackathon</option>
              {hackathons.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title} ({h.status})
                </option>
              ))}
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            isLoading={isLoading}
            title="Refresh submission status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Migration Notice if DB table is missing */}
      {errorMessage?.includes('does not exist') && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Submissions Table Not Found in Supabase</p>
            <p className="mt-1 text-amber-800">
              Apply <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">{SUBMISSIONS_MIGRATION_FILE}</code> in your Supabase SQL Editor to enable real project submissions.
            </p>
          </div>
        </div>
      )}

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start gap-3 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && !errorMessage.includes('does not exist') && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading submission workspace...</p>
        </div>
      ) : !myTeam ? (
        /* Empty State: Student has not joined a team */
        <Card className="border-dashed border-slate-300">
          <CardContent className="p-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
              <Users className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-800">You must belong to a team to submit a project</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                In HackBridge, project deliverables and evaluation scores are tracked at the team level. Create a new team or join with an invite code before submitting your solution.
              </p>
            </div>
            <div className="pt-2">
              <Link to="/student/team">
                <Button size="md" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  <Users className="w-4 h-4 mr-1.5" />
                  Go to Team Desk
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Team & Problem Statement Context Header */
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">
                    Submitting For Team
                  </span>
                  <Badge variant="outline" className="text-white border-white/20 text-[10px]">
                    Code: {myTeam.invite_code}
                  </Badge>
                </div>
                <h2 className="text-xl font-bold">{myTeam.name}</h2>
                <p className="text-xs text-slate-300">
                  {myTeam.members.length} team member{myTeam.members.length === 1 ? '' : 's'} registered
                </p>
              </div>

              {/* Problem Statement Pill */}
              <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-3 text-xs max-w-md">
                <p className="text-[11px] text-indigo-300 font-medium">Selected Challenge:</p>
                {myTeam.problem_statement ? (
                  <div className="mt-0.5">
                    <p className="font-semibold text-white truncate">
                      {myTeam.problem_statement.title}
                    </p>
                    <span className="text-[10px] text-indigo-200 mt-0.5 inline-block">
                      Domain: {myTeam.problem_statement.domain} · {myTeam.problem_statement.difficulty}
                    </span>
                  </div>
                ) : (
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="text-slate-400 text-xs italic">No problem statement selected yet</span>
                    <Link to="/student/problems">
                      <Button size="sm" variant="outline" className="text-[10px] text-white border-white/30 h-6 px-2">
                        Select Problem
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submission State 1: LOCKED & FINALIZED RECEIPT */}
          {submission?.is_final ? (
            <div className="space-y-6">
              {/* Receipt Header Card */}
              <Card className="border-emerald-300 bg-emerald-50/40 shadow-sm">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-200">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base text-emerald-950 flex items-center gap-2">
                          Project Submission Finalized &amp; Locked
                        </CardTitle>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Submitted on {new Date(submission.submitted_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="success" className="bg-emerald-600 text-white border-transparent">
                      <Lock className="w-3 h-3 mr-1" />
                      Locked for Judging
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-emerald-900 border-t border-emerald-200/60 pt-4">
                  <p>
                    Your project has been recorded in the hackathon registry and the team status transitioned to{' '}
                    <strong className="font-semibold text-emerald-950">"submitted"</strong>. Double-blind evaluation by the committee and industry judges is currently underway.
                  </p>
                </CardContent>
              </Card>

              {/* AI Pre-Screening Card (Phase 6) */}
              <Card className="border-indigo-200 bg-indigo-50/20 shadow-sm">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-indigo-950">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      AI Pre-Screening Readiness Verification
                    </CardTitle>
                    {submission.ai_scores && Object.keys(submission.ai_scores).length > 0 ? (
                      <Badge variant="success" className="bg-emerald-600 text-white border-transparent">
                        Pre-Screening Complete ({(submission.ai_scores as unknown as AIScores).overall} / 10)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                        Pending Committee Triage
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  {submission.ai_scores && Object.keys(submission.ai_scores).length > 0 ? (
                    <>
                      {/* Scores Breakdown */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Relevance</span>
                          <p className="text-base font-bold text-slate-800 mt-0.5">
                            {(submission.ai_scores as unknown as AIScores).relevance} / 10
                          </p>
                        </div>
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Completeness</span>
                          <p className="text-base font-bold text-slate-800 mt-0.5">
                            {(submission.ai_scores as unknown as AIScores).completeness} / 10
                          </p>
                        </div>
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Innovation</span>
                          <p className="text-base font-bold text-slate-800 mt-0.5">
                            {(submission.ai_scores as unknown as AIScores).innovation} / 10
                          </p>
                        </div>
                      </div>

                      {/* Synthesis */}
                      {submission.ai_summary && (
                        <div className="p-3 bg-white border border-indigo-100 rounded-xl text-slate-700 leading-relaxed">
                          <p className="font-semibold text-slate-800 mb-1 text-[11px] uppercase tracking-wider text-indigo-700">
                            Executive Synthesis
                          </p>
                          <p className="text-slate-600">{submission.ai_summary}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span>Your solution has been recorded. Run the automated pre-screening check now or wait for committee review.</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (submission) {
                            await runSubmissionPrescreening(submission.id);
                            await loadData();
                          }
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        Run Check Now
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Submitted Details Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-indigo-600" />
                    Verified Deliverables Record
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Title & Abstract */}
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Project Title
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">{submission.title}</h3>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Executive Abstract
                    </span>
                    <div className="mt-1 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {submission.abstract}
                    </div>
                  </div>

                  {/* Approach if present */}
                  {submission.approach && (
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Technical Architecture &amp; Approach
                      </span>
                      <div className="mt-1 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {submission.approach}
                      </div>
                    </div>
                  )}

                  {/* Tech Stack */}
                  {submission.tech_stack && submission.tech_stack.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Technologies &amp; Libraries Used
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {submission.tech_stack.map((tech) => (
                          <Badge key={tech} variant="default" className="text-xs">
                            {tech}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deliverable URLs */}
                  <div className="border-t border-slate-200 pt-5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Artifact &amp; Project Links
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      {submission.repo_url && (
                        <a
                          href={submission.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-xs group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Github className="w-4 h-4 text-slate-700 flex-shrink-0" />
                            <div className="truncate">
                              <p className="font-semibold text-slate-800">Source Code Repository</p>
                              <p className="text-slate-500 text-[11px] truncate">
                                {formatUrlForDisplay(submission.repo_url)}
                              </p>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 flex-shrink-0" />
                        </a>
                      )}

                      {submission.demo_url && (
                        <a
                          href={submission.demo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30 transition-all text-xs group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Globe className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <div className="truncate">
                              <p className="font-semibold text-slate-800">Live Deployed Demo</p>
                              <p className="text-slate-500 text-[11px] truncate">
                                {formatUrlForDisplay(submission.demo_url)}
                              </p>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 flex-shrink-0" />
                        </a>
                      )}

                      {submission.presentation_url && (
                        <a
                          href={submission.presentation_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/30 transition-all text-xs group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Presentation className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <div className="truncate">
                              <p className="font-semibold text-slate-800">Slide / Pitch Deck</p>
                              <p className="text-slate-500 text-[11px] truncate">
                                {formatUrlForDisplay(submission.presentation_url)}
                              </p>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 flex-shrink-0" />
                        </a>
                      )}

                      {submission.video_url && (
                        <a
                          href={submission.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-rose-300 hover:bg-rose-50/30 transition-all text-xs group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Video className="w-4 h-4 text-rose-600 flex-shrink-0" />
                            <div className="truncate">
                              <p className="font-semibold text-slate-800">Demo Video Walkthrough</p>
                              <p className="text-slate-500 text-[11px] truncate">
                                {formatUrlForDisplay(submission.video_url)}
                              </p>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600 flex-shrink-0" />
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Submission State 2: EDITABLE SUBMISSION FORM (DRAFT) */
            <div className="space-y-6">
              {/* Draft Status Banner */}
              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl flex items-center justify-between gap-3 text-xs text-indigo-950">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span>
                    <strong>Draft Mode:</strong> You can edit and save your progress at any time. When ready, click "Finalize &amp; Submit" to lock your project for evaluation.
                  </span>
                </div>
                {submission && (
                  <span className="text-[11px] text-indigo-600 flex-shrink-0 font-medium">
                    Last saved {new Date(submission.last_edited_at).toLocaleTimeString()}
                  </span>
                )}
              </div>

              {/* Form Section 1: Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-indigo-600" />
                    Section 1: Solution Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Project Title <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. AI-Powered Smart Traffic Signalization System"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      A clear, distinctive title for your hackathon solution.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Executive Abstract <span className="text-rose-500">*</span>
                    </label>
                    <Textarea
                      rows={5}
                      placeholder="Summarize the problem, your team's solution, and key impact metrics..."
                      value={abstract}
                      onChange={(e) => setAbstract(e.target.value)}
                    />
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                      <span>Will be reviewed by industry evaluators and AI screening engines.</span>
                      <span>{abstract.length} characters</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Technical Architecture &amp; Methodology (Optional)
                    </label>
                    <Textarea
                      rows={4}
                      placeholder="Describe the algorithms, data pipeline, system architecture, and trade-offs made..."
                      value={approach}
                      onChange={(e) => setApproach(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Form Section 2: Multi-Format Deliverables */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    Section 2: Multi-Format Deliverable Artifacts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-500">
                    Provide verified URLs to your source code repository, deployment, slide deck, and video demo. All links must begin with <code>http://</code> or <code>https://</code>.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                        <Github className="w-3.5 h-3.5 text-slate-600" />
                        GitHub / GitLab Repository URL
                      </label>
                      <Input
                        type="url"
                        placeholder="https://github.com/organization/project"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-emerald-600" />
                        Live Deployed Demo URL
                      </label>
                      <Input
                        type="url"
                        placeholder="https://project-demo.vercel.app"
                        value={demoUrl}
                        onChange={(e) => setDemoUrl(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                        <Presentation className="w-3.5 h-3.5 text-amber-600" />
                        Slide Deck / Presentation URL
                      </label>
                      <Input
                        type="url"
                        placeholder="https://docs.google.com/presentation/d/..."
                        value={presentationUrl}
                        onChange={(e) => setPresentationUrl(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-rose-600" />
                        Demo Video Walkthrough URL
                      </label>
                      <Input
                        type="url"
                        placeholder="https://youtu.be/... or https://loom.com/share/..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Direct File Attachment via Supabase Storage */}
                  <div className="pt-4 border-t border-slate-100">
                    <FileUploadDropzone
                      bucket={STORAGE_BUCKETS.SUBMISSIONS}
                      pathPrefix={myTeam?.id || 'team'}
                      label="Direct File Attachment (Presentation Deck, Architecture PDF, or Archive)"
                      helperText="Securely upload your slide deck, diagram, or zip package (max 25MB). Will be accessible to assigned evaluators."
                      onUploadComplete={(res) => {
                        if (!presentationUrl && (res.file.type === 'application/pdf' || res.file.name.endsWith('.pdf'))) {
                          setPresentationUrl(res.url);
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Form Section 3: Tech Stack */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Section 3: Technologies &amp; Frameworks
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Active Chips */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Selected Tech Stack ({techStack.length})
                    </label>
                    {techStack.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No technologies selected yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {techStack.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="text-indigo-400 hover:text-indigo-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Custom Tag */}
                  <div className="flex gap-2 max-w-sm">
                    <Input
                      placeholder="Add tech (e.g. OpenCV, Redis)"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleAddTag()}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Quick Select Popular Tags */}
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium mb-1.5">
                      Or click to quickly add:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_TECH_TAGS.map((tag) => {
                        const isAdded = techStack.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => (isAdded ? handleRemoveTag(tag) : handleAddTag(tag))}
                            className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                              isAdded
                                ? 'bg-indigo-600 text-white border-indigo-600 font-medium'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isAdded ? `✓ ${tag}` : `+ ${tag}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500">
                  <p>
                    <strong>Tip:</strong> You can save a draft as many times as you like. Locking as final is irreversible.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleSaveDraft}
                    isLoading={isSaving}
                    disabled={isFinalizing}
                  >
                    <Save className="w-4 h-4 mr-1.5" />
                    Save Draft
                  </Button>

                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100"
                    onClick={() => {
                      if (!title.trim() || !abstract.trim()) {
                        setErrorMessage('Please provide both a project title and an abstract before finalizing.');
                        return;
                      }
                      setShowConfirmModal(true);
                    }}
                    disabled={isSaving || isFinalizing}
                  >
                    <Lock className="w-4 h-4 mr-1.5" />
                    Finalize &amp; Lock Submission
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Final Lock */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Lock and Finalize Project Submission?
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Once finalized, your project submission will be <strong>permanently locked</strong> for evaluator scoring and cannot be updated. Your team's status will advance to <strong>"submitted"</strong>.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="font-semibold text-slate-800">Review Checklist:</p>
              <p className="text-slate-600">✓ Title: {title || 'Untitled'}</p>
              <p className="text-slate-600">✓ Deliverables: {repoUrl ? 'Code Repository attached' : 'No repo URL'}</p>
              <p className="text-slate-600">✓ Demo: {demoUrl ? 'Live demo attached' : 'No demo URL'}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmModal(false)}
                disabled={isFinalizing}
              >
                Go Back &amp; Edit
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleConfirmFinalize}
                isLoading={isFinalizing}
              >
                Yes, Lock &amp; Finalize
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
