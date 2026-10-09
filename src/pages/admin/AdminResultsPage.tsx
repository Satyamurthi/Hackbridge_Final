import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Users,
  Search,
  Trophy,
  Check,
  X,
  ExternalLink,
  Sparkles,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { fetchTenantHackathons } from '../../lib/hackathons';
import {
  fetchHackathonEvaluationResults,
  autoAssignEvaluators,
  EVALUATION_MIGRATION_FILE,
} from '../../lib/evaluations';
import {
  finalizeHackathonAwards,
  getAwardBadgeMeta,
} from '../../lib/leaderboard';
import type { Hackathon } from '../../types/database';

export const AdminResultsPage: React.FC = () => {
  const { tenantId, isConfigured } = useAuth();

  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState<string>('');
  const [results, setResults] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardDecisions, setAwardDecisions] = useState<Record<string, string>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      let active = available.find((h) => h.status === 'evaluation' || h.status === 'completed' || h.status === 'hacking');
      if (!active && available.length > 0) active = available[0];

      const currentId = selectedHackathonId || active?.id || '';
      if (!selectedHackathonId && currentId) {
        setSelectedHackathonId(currentId);
      }

      if (currentId) {
        const { results: rList, error: rError } = await fetchHackathonEvaluationResults(currentId, 1);
        if (rError) setErrorMessage(rError);
        setResults(rList);
      } else {
        setResults([]);
      }
    } catch (err: any) {
      console.warn('[AdminResultsPage] Error loading results:', err);
      setErrorMessage(err?.message || 'Unable to load evaluation results.');
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, tenantId, selectedHackathonId]);

  useEffect(() => {
    const safety = setTimeout(() => setIsLoading(false), 1000);
    loadData().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [loadData]);

  // ── Auto Assign Evaluators ───────────────────────────────────────────────

  const handleAutoAssign = async () => {
    if (!selectedHackathonId || !tenantId) return;

    setIsAssigning(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { success, assignedCount, error } = await autoAssignEvaluators(selectedHackathonId, tenantId, 2, 1);
    setIsAssigning(false);

    if (!success) {
      setErrorMessage(error || 'Failed to auto-assign evaluators.');
    } else {
      setSuccessMessage(`Assigned ${assignedCount} evaluation assignments across college evaluators!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadData();
    }
  };

  // ── Award Allocation & Deliberation Modal ────────────────────────────────

  const openAwardModal = () => {
    const initial: Record<string, string> = {};
    results.forEach((r, idx) => {
      if (r.final_decision) {
        initial[r.submission_id] = r.final_decision;
      } else {
        if (idx === 0) initial[r.submission_id] = 'winner';
        else if (idx === 1) initial[r.submission_id] = 'runner_up';
        else if (idx === 2) initial[r.submission_id] = 'second_runner_up';
        else if (idx < 10) initial[r.submission_id] = 'top_10';
        else initial[r.submission_id] = 'honorable_mention';
      }
    });
    setAwardDecisions(initial);
    setShowAwardModal(true);
  };

  const handleFinalizeAwards = async () => {
    if (!selectedHackathonId) return;

    setIsFinalizing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const decisionsList = Object.entries(awardDecisions).map(([submissionId, finalDecision]) => ({
      submissionId,
      finalDecision,
    }));

    const { success, error } = await finalizeHackathonAwards(selectedHackathonId, 1, decisionsList);
    setIsFinalizing(false);

    if (!success) {
      setErrorMessage(error || 'Failed to finalize awards.');
    } else {
      setShowAwardModal(false);
      setSuccessMessage('Official awards declared! Hackathon transitioned to Completed and Leaderboard updated.');
      setTimeout(() => setSuccessMessage(null), 5000);
      await loadData();
    }
  };

  // ── Calculations ─────────────────────────────────────────────────────────

  const activeHackathon = hackathons.find((h) => h.id === selectedHackathonId);
  const totalEntries = results.length;
  const scoredEntries = results.filter((r) => r.evaluator_count > 0).length;
  const isCompleted = activeHackathon?.status === 'completed';

  const avgOverall =
    scoredEntries > 0
      ? (
          results
            .filter((r) => r.weighted_avg !== null)
            .reduce((sum, r) => sum + r.weighted_avg, 0) / scoredEntries
        ).toFixed(1)
      : '0.0';

  // ── Search & Filter ──────────────────────────────────────────────────────

  const filteredResults = results.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.team_name.toLowerCase().includes(q) ||
      r.problem_title.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Judging &amp; Evaluation Matrix</h1>
            <Badge variant="success">Official Scoring</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time score normalization, variance tracking, award allocation, and official declaration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-56">
            <Select
              value={selectedHackathonId}
              onChange={(e) => setSelectedHackathonId(e.target.value)}
            >
              <option value="">Select Hackathon</option>
              {hackathons.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title} ({h.status.toUpperCase()})
                </option>
              ))}
            </Select>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            isLoading={isLoading}
            title="Refresh Standings"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>

          <Link to="/leaderboard">
            <Button size="sm" variant="outline" className="text-xs h-9 text-slate-700">
              <ExternalLink className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Public Leaderboard
            </Button>
          </Link>

          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
            onClick={handleAutoAssign}
            isLoading={isAssigning}
          >
            <Users className="w-3.5 h-3.5 mr-1.5" />
            Auto-Assign
          </Button>

          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
            onClick={openAwardModal}
            disabled={results.length === 0}
          >
            <Trophy className="w-3.5 h-3.5 mr-1.5" />
            {isCompleted ? 'Update Awards' : 'Finalize & Declare Awards'}
          </Button>
        </div>
      </div>

      {/* Migration Notice if DB table is missing */}
      {errorMessage?.includes('does not exist') && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Evaluation Foundation Migration Pending</p>
            <p className="mt-1">
              Please apply <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">{EVALUATION_MIGRATION_FILE}</code> in the Supabase SQL Editor.
            </p>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && !errorMessage.includes('does not exist') && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Submissions</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalEntries}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Final deliverables locked</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Scored by Judges</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{scoredEntries}</p>
              <p className="text-[11px] text-indigo-500 mt-0.5">
                {totalEntries > 0 ? `${Math.round((scoredEntries / totalEntries) * 100)}% coverage` : '0%'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Average Event Score</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{avgOverall} / 10</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Normalized weighted score</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Status</p>
              <p className="text-lg font-bold text-slate-900 mt-1 capitalize">
                {activeHackathon?.status || 'Active'}
              </p>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                {isCompleted ? 'Results Declared' : 'Deliberation Active'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Trophy className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Standings Matrix Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm">Committee Consensus &amp; Scoring Matrix</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Entries ranked by normalized weighted average across all assigned evaluators.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <Input
              placeholder="Search team or challenge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
              Loading committee standings matrix...
            </div>
          ) : results.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <p className="font-semibold text-slate-600">No finalized submissions found</p>
              <p className="mt-1">
                Submissions appear here once student teams lock their final deliverables.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">Rank</th>
                    <th className="py-3 px-4">Project &amp; Team</th>
                    <th className="py-3 px-4">Challenge Domain</th>
                    <th className="py-3 px-4 text-center">Judges</th>
                    <th className="py-3 px-4 text-center">Weighted Avg</th>
                    <th className="py-3 px-4 text-center">Score Variance</th>
                    <th className="py-3 px-4 text-center">Jury Votes</th>
                    <th className="py-3 px-4 text-center">Official Award</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResults.map((r, index) => {
                    const isHighVariance = r.score_variance !== null && r.score_variance > 2.0;
                    const hasScores = r.evaluator_count > 0;
                    const badgeMeta = getAwardBadgeMeta(r.final_decision, index + 1);

                    return (
                      <tr key={r.submission_id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 text-center">
                          <span className={`font-bold ${index < 3 ? 'text-indigo-600' : 'text-slate-400'}`}>
                            #{index + 1}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div>
                            <p className="font-semibold text-slate-900">{r.title}</p>
                            <p className="text-[11px] text-slate-500 font-medium">Team: {r.team_name}</p>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div>
                            <p className="text-slate-700">{r.problem_title}</p>
                            <span className="text-[10px] font-semibold text-indigo-600 uppercase">
                              {r.domain}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="font-semibold text-slate-700">
                            {r.evaluator_count}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {hasScores ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {r.weighted_avg} / 10
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Pending</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {r.score_variance !== null ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono ${
                                isHighVariance
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                                  : 'text-slate-600'
                              }`}
                              title={isHighVariance ? 'High score variance detected between judges.' : ''}
                            >
                              {isHighVariance && '⚠️ '}
                              {r.score_variance}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 text-[11px]">
                            <span className="text-emerald-700 font-semibold" title="Advance votes">
                              +{r.advance_votes} Adv
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="text-amber-700" title="Borderline votes">
                              {r.borderline_votes} Bord
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="text-rose-700" title="Reject votes">
                              -{r.reject_votes} Rej
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {r.final_decision ? (
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${badgeMeta.bgClass} ${badgeMeta.textClass} ${badgeMeta.borderClass}`}
                            >
                              {badgeMeta.label}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Pending Deliberation</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Award Finalization & Deliberation Modal */}
      {showAwardModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Final Award Determinations</h3>
                  <p className="text-xs text-slate-500">
                    Assign official prizes and publish the final hackathon leaderboard.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAwardModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Declaring final awards will transition <strong className="font-semibold">{activeHackathon?.title}</strong> to <code className="font-bold">completed</code> status, stamp the official announcement time, and make the results public on the platform leaderboard.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Award Allocation Roster ({results.length} Final Submissions)
                </h4>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                  {results.map((entry, idx) => (
                    <div key={entry.submission_id} className="p-3 bg-white flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900 line-clamp-1">{entry.title}</p>
                          <p className="text-[11px] text-slate-500">
                            Team: {entry.team_name} · Score: <strong>{entry.weighted_avg || '0.0'}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="w-48 shrink-0">
                        <Select
                          value={awardDecisions[entry.submission_id] || 'honorable_mention'}
                          onChange={(e) =>
                            setAwardDecisions({
                              ...awardDecisions,
                              [entry.submission_id]: e.target.value,
                            })
                          }
                          className="text-xs h-8"
                        >
                          <option value="winner">Winner 🏆 (1st Place)</option>
                          <option value="runner_up">1st Runner Up 🥈 (2nd)</option>
                          <option value="second_runner_up">2nd Runner Up 🥉 (3rd)</option>
                          <option value="top_10">Top 10 Finalist ⭐</option>
                          <option value="honorable_mention">Honorable Mention 🎖️</option>
                          <option value="shortlisted">Shortlisted</option>
                          <option value="participant">Participant</option>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <Button size="sm" variant="outline" onClick={() => setShowAwardModal(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs"
                onClick={handleFinalizeAwards}
                isLoading={isFinalizing}
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Confirm &amp; Declare Official Results
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
