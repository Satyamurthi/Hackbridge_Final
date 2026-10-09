import React, { useCallback, useEffect, useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FolderGit2,
  RefreshCw,
  ExternalLink,
  Github,
  Globe,
  Presentation,
  Video,
  Search,
  Eye,
  X,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { fetchTenantHackathons } from '../../lib/hackathons';
import {
  fetchHackathonPrescreeningSubmissions,
  runSubmissionPrescreening,
  batchPrescreenHackathonSubmissions,
  type AIScores,
} from '../../lib/aiPrescreening';
import type { Hackathon, SubmissionWithDetails } from '../../types/database';

export const AdminPrescreeningPage: React.FC = () => {
  const { tenantId, isConfigured } = useAuth();

  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState<string>('');
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);

  const [filterTab, setFilterTab] = useState<'all' | 'flagged' | 'high_innovation' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithDetails | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── 1. Load Hackathons & Submissions ──────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!isConfigured || !tenantId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { hackathons: hList, error: hError } = await fetchTenantHackathons(tenantId);
      if (hError) setErrorMessage(hError);

      const available = hList ?? [];
      setHackathons(available);

      let activeHackathon = available.find(
        (h) => h.status === 'hacking' || h.status === 'evaluation' || h.status === 'registration'
      );
      if (!activeHackathon && available.length > 0) {
        activeHackathon = available[0];
      }

      const currentHackathonId = selectedHackathonId || activeHackathon?.id || '';
      if (!selectedHackathonId && currentHackathonId) {
        setSelectedHackathonId(currentHackathonId);
      }

      if (currentHackathonId) {
        const { submissions: subList, error: subErr } = await fetchHackathonPrescreeningSubmissions(currentHackathonId);
        if (subErr) setErrorMessage(subErr);
        setSubmissions(subList);
      } else {
        setSubmissions([]);
      }
    } catch (err: any) {
      console.warn('[AdminPrescreeningPage] Error loading data:', err);
      setErrorMessage(err?.message || 'Unable to load pre-screening submissions.');
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, tenantId, selectedHackathonId]);

  useEffect(() => {
    const safety = setTimeout(() => setIsLoading(false), 1000);
    loadData().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [loadData]);

  // ── 2. Run Batch AI Pre-Screening ────────────────────────────────────────

  const handleRunBatch = async () => {
    if (!selectedHackathonId) return;

    setIsBatchRunning(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { success, processedCount, error } = await batchPrescreenHackathonSubmissions(selectedHackathonId);
    setIsBatchRunning(false);

    if (!success) {
      setErrorMessage(error || 'Failed to complete batch pre-screening.');
    } else {
      setSuccessMessage(`AI Pre-Screening complete! Processed ${processedCount} finalized submission(s).`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadData();
    }
  };

  // ── 3. Run Single Submission Pre-Screening ───────────────────────────────

  const handleRunSingle = async (subId: string) => {
    setActiveAnalysisId(subId);
    setErrorMessage(null);

    const { success, error } = await runSubmissionPrescreening(subId);
    setActiveAnalysisId(null);

    if (!success) {
      setErrorMessage(error || 'Failed to analyze submission.');
    } else {
      await loadData();
      // If currently inspecting this submission, update the modal view
      if (selectedSubmission?.id === subId) {
        const updated = submissions.find((s) => s.id === subId);
        if (updated) setSelectedSubmission(updated);
      }
    }
  };

  // ── KPI Calculations ─────────────────────────────────────────────────────

  const totalFinalSubmissions = submissions.length;
  const screenedList = submissions.filter((s) => s.ai_scores && Object.keys(s.ai_scores).length > 0);
  const screenedCount = screenedList.length;
  const screenedPercentage = totalFinalSubmissions > 0 ? Math.round((screenedCount / totalFinalSubmissions) * 100) : 0;

  const averageQualityScore =
    screenedCount > 0
      ? (
          screenedList.reduce((sum, s) => {
            const scores = s.ai_scores as unknown as AIScores;
            return sum + (scores?.overall || 0);
          }, 0) / screenedCount
        ).toFixed(1)
      : '0.0';

  const flaggedCount = submissions.filter((s) =>
    (s.ai_flags || []).some((f) => f.includes('missing') || f.includes('low') || f.includes('brief'))
  ).length;

  // ── Filtering & Search ───────────────────────────────────────────────────

  const filteredSubmissions = submissions.filter((sub) => {
    const scores = sub.ai_scores as unknown as AIScores;
    const flags = sub.ai_flags || [];

    // Tab filter
    if (filterTab === 'flagged') {
      const isFlagged = flags.some((f) => f.includes('missing') || f.includes('low') || f.includes('brief'));
      if (!isFlagged) return false;
    } else if (filterTab === 'high_innovation') {
      if ((scores?.overall || 0) < 8.0) return false;
    } else if (filterTab === 'pending') {
      if (scores && Object.keys(scores).length > 0) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = sub.title.toLowerCase().includes(q);
      const matchTeam = sub.team?.name.toLowerCase().includes(q);
      const matchProblem = sub.problem_statement?.title.toLowerCase().includes(q);
      return matchTitle || matchTeam || matchProblem;
    }

    return true;
  });

  const getScoreBadgeClass = (score?: number) => {
    if (!score) return 'bg-slate-100 text-slate-600 border-slate-200';
    if (score >= 7.5) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 5.5) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const formatFlagLabel = (flag: string) => {
    return flag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">AI Pre-Screening &amp; Triage</h1>
            <Badge variant="success">Automated Triage</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automated evaluation of submitted solutions across Relevance, Completeness, and Innovation before assignment to human judges.
          </p>
        </div>

        {/* Controls */}
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
            title="Refresh submissions"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleRunBatch}
            isLoading={isBatchRunning}
            disabled={submissions.length === 0}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Batch Screen All
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2.5 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <p className="font-semibold">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <p className="font-semibold">{errorMessage}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Final Submissions
              </span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalFinalSubmissions}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <FolderGit2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                AI Screened
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-bold text-indigo-600">{screenedCount}</p>
                <span className="text-xs text-slate-400">({screenedPercentage}%)</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Avg Quality Score
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <p className="text-2xl font-bold text-slate-900">{averageQualityScore}</p>
                <span className="text-xs text-slate-400">/ 10</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Flagged for Review
              </span>
              <p className="text-2xl font-bold text-amber-600 mt-1">{flaggedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Submissions ({submissions.length})
          </button>
          <button
            onClick={() => setFilterTab('flagged')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              filterTab === 'flagged'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-amber-700'
            }`}
          >
            Needs Attention ({flaggedCount})
          </button>
          <button
            onClick={() => setFilterTab('high_innovation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'high_innovation'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-indigo-600'
            }`}
          >
            High Innovation (Score ≥ 8)
          </button>
          <button
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'pending'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending Screening ({submissions.length - screenedCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            placeholder="Search team, project, challenge..."
            className="pl-9 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Submissions List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading submissions for pre-screening...</p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <Card className="border-dashed border-slate-300">
          <CardContent className="p-10 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No submissions found matching criteria</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {totalFinalSubmissions === 0
                ? 'No teams have finalized and locked project submissions for this hackathon yet.'
                : 'Try adjusting your filter tabs or search query.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map((sub) => {
            const scores = sub.ai_scores as unknown as AIScores;
            const hasScores = scores && Object.keys(scores).length > 0;
            const flags = sub.ai_flags || [];
            const isAnalyzing = activeAnalysisId === sub.id;

            return (
              <Card
                key={sub.id}
                className="hover:border-indigo-300 transition-all shadow-sm"
              >
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Project & Team Context */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {sub.title}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          Team: {sub.team?.name || 'Unknown'}
                        </Badge>
                        {sub.problem_statement && (
                          <Badge variant="secondary" className="text-[10px]">
                            {sub.problem_statement.domain || 'Challenge'}
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-1">
                        {sub.abstract}
                      </p>

                      {/* Deliverables Indicators */}
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                        <span
                          className={`flex items-center gap-1 ${
                            sub.repo_url ? 'text-indigo-600 font-medium' : 'text-slate-300'
                          }`}
                        >
                          <Github className="w-3.5 h-3.5" /> Repo
                        </span>
                        <span
                          className={`flex items-center gap-1 ${
                            sub.demo_url ? 'text-emerald-600 font-medium' : 'text-slate-300'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" /> Demo
                        </span>
                        <span
                          className={`flex items-center gap-1 ${
                            sub.presentation_url ? 'text-amber-600 font-medium' : 'text-slate-300'
                          }`}
                        >
                          <Presentation className="w-3.5 h-3.5" /> Slides
                        </span>
                        <span
                          className={`flex items-center gap-1 ${
                            sub.video_url ? 'text-rose-600 font-medium' : 'text-slate-300'
                          }`}
                        >
                          <Video className="w-3.5 h-3.5" /> Video
                        </span>

                        {sub.tech_stack && sub.tech_stack.length > 0 && (
                          <span className="text-slate-400">· {sub.tech_stack.slice(0, 3).join(', ')}</span>
                        )}
                      </div>
                    </div>

                    {/* Middle: AI Scores Breakdown */}
                    <div className="flex items-center gap-3 flex-shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                      {hasScores ? (
                        <>
                          <div className="text-center px-2">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">
                              Overall
                            </span>
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border mt-0.5 ${getScoreBadgeClass(
                                scores.overall
                              )}`}
                            >
                              {scores.overall} / 10
                            </span>
                          </div>

                          <div className="border-l border-slate-200 pl-3 space-y-0.5 text-[11px] text-slate-600">
                            <div>
                              <span className="text-slate-400">Relevance:</span>{' '}
                              <strong className="text-slate-800">{scores.relevance}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400">Completeness:</span>{' '}
                              <strong className="text-slate-800">{scores.completeness}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400">Innovation:</span>{' '}
                              <strong className="text-slate-800">{scores.innovation}</strong>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="px-4 py-2 text-center text-slate-400 text-xs">
                          <span>Pending AI Analysis</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasScores ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedSubmission(sub)}
                          className="text-xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View Scorecard
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        variant={hasScores ? 'ghost' : 'primary'}
                        onClick={() => handleRunSingle(sub.id)}
                        isLoading={isAnalyzing}
                        className="text-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        {hasScores ? 'Re-Analyze' : 'Analyze Now'}
                      </Button>
                    </div>
                  </div>

                  {/* Anomaly & Quality Flags */}
                  {flags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
                      {flags.map((flag) => {
                        const isWarning =
                          flag.includes('missing') || flag.includes('low') || flag.includes('brief');
                        return (
                          <span
                            key={flag}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                              isWarning
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {isWarning ? '⚠️' : '✓'} {formatFlagLabel(flag)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Scorecard Inspection Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-100 space-y-5 animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  AI Pre-Screening Scorecard
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {selectedSubmission.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Team: {selectedSubmission.team?.name} · Submitted on{' '}
                  {new Date(selectedSubmission.submitted_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Score Cards Grid */}
            {selectedSubmission.ai_scores && (
              <div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-indigo-500 block">Overall</span>
                    <span className="text-xl font-black text-indigo-700 mt-0.5 block">
                      {(selectedSubmission.ai_scores as unknown as AIScores).overall}
                    </span>
                    <span className="text-[10px] text-indigo-400">/ 10</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Relevance</span>
                    <span className="text-xl font-bold text-slate-800 mt-0.5 block">
                      {(selectedSubmission.ai_scores as unknown as AIScores).relevance}
                    </span>
                    <span className="text-[10px] text-slate-400">weight 40%</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Completeness</span>
                    <span className="text-xl font-bold text-slate-800 mt-0.5 block">
                      {(selectedSubmission.ai_scores as unknown as AIScores).completeness}
                    </span>
                    <span className="text-[10px] text-slate-400">weight 35%</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Innovation</span>
                    <span className="text-xl font-bold text-slate-800 mt-0.5 block">
                      {(selectedSubmission.ai_scores as unknown as AIScores).innovation}
                    </span>
                    <span className="text-[10px] text-slate-400">weight 25%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Executive AI Synthesis */}
            <div>
              <span className="text-xs font-semibold text-slate-800 block mb-1.5">
                Executive Synthesis Summary
              </span>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                {selectedSubmission.ai_summary || 'No automated summary available.'}
              </div>
            </div>

            {/* Flags */}
            {selectedSubmission.ai_flags && selectedSubmission.ai_flags.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-slate-800 block mb-1.5">
                  Detected Integrity &amp; Quality Flags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSubmission.ai_flags.map((flag) => {
                    const isWarn = flag.includes('missing') || flag.includes('low') || flag.includes('brief');
                    return (
                      <span
                        key={flag}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border ${
                          isWarn
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {isWarn ? '⚠️' : '✓'} {formatFlagLabel(flag)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Deliverables Direct Links */}
            <div>
              <span className="text-xs font-semibold text-slate-800 block mb-2">
                Deliverable Artifacts Audit
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {selectedSubmission.repo_url ? (
                  <a
                    href={selectedSubmission.repo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2 text-slate-800 font-medium">
                      <Github className="w-4 h-4 text-slate-700" /> Source Repository
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                ) : (
                  <div className="p-2.5 rounded-lg border border-dashed border-rose-200 bg-rose-50/50 text-rose-700 flex items-center gap-2">
                    <X className="w-4 h-4 text-rose-500" /> No Source Repository
                  </div>
                )}

                {selectedSubmission.demo_url ? (
                  <a
                    href={selectedSubmission.demo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-lg border border-slate-200 hover:border-emerald-300 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2 text-slate-800 font-medium">
                      <Globe className="w-4 h-4 text-emerald-600" /> Live Deployed Demo
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                ) : (
                  <div className="p-2.5 rounded-lg border border-dashed border-amber-200 bg-amber-50/50 text-amber-700 flex items-center gap-2">
                    <X className="w-4 h-4 text-amber-500" /> No Live Demo
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button size="sm" variant="outline" onClick={() => setSelectedSubmission(null)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => handleRunSingle(selectedSubmission.id)}
                isLoading={activeAnalysisId === selectedSubmission.id}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Re-Analyze Submission
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
