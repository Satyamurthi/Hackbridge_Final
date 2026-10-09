import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Github,
  Globe,
  Presentation,
  Video,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import {
  fetchEvaluatorAssignments,
  EVALUATION_MIGRATION_FILE,
} from '../../lib/evaluations';
import type { EvaluationAssignmentWithDetails } from '../../types/database';

export const EvaluatorAssignmentsPage: React.FC = () => {
  const { user } = useAuth();

  const [assignments, setAssignments] = useState<EvaluationAssignmentWithDetails[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'completed' | 'recused'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    const effectiveUserId = user.id;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { assignments: list, error } = await fetchEvaluatorAssignments(effectiveUserId);
      if (error) {
        setErrorMessage(error);
      } else {
        setAssignments(list);
      }
    } catch (err: any) {
      console.warn('[EvaluatorAssignmentsPage] Error loading assignments:', err);
      setErrorMessage(err?.message || 'Unable to load assignments.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const safety = setTimeout(() => setIsLoading(false), 1000);
    loadAssignments().finally(() => clearTimeout(safety));
    return () => clearTimeout(safety);
  }, [loadAssignments]);

  // ── KPI Counts ───────────────────────────────────────────────────────────

  const totalAssigned = assignments.length;
  const completedCount = assignments.filter((a) => a.status === 'completed').length;
  const pendingCount = assignments.filter((a) => a.status === 'pending' || a.status === 'in_progress').length;
  const recusedCount = assignments.filter((a) => a.status === 'recused').length;

  // ── Filtered List ────────────────────────────────────────────────────────

  const filteredAssignments = assignments.filter((a) => {
    if (filterTab === 'pending' && a.status !== 'pending' && a.status !== 'in_progress') return false;
    if (filterTab === 'completed' && a.status !== 'completed') return false;
    if (filterTab === 'recused' && a.status !== 'recused') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = a.submission.title.toLowerCase().includes(q);
      const matchProblem = a.submission.problem_statement?.title.toLowerCase().includes(q);
      const matchEntry = a.submission.team?.name.toLowerCase().includes(q);
      return matchTitle || matchProblem || matchEntry;
    }

    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Assigned Submissions Queue</h1>
            <Badge variant="success">Double-Blind Active</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Double-blind evaluation queue. Review assigned entries, track scoring progress, and open the interactive rubric workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/evaluator/score">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs">
              <Award className="w-3.5 h-3.5 mr-1" />
              Open Rubric Scoring Desk
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={loadAssignments}
            isLoading={isLoading}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Migration Notice if DB table is missing */}
      {errorMessage?.includes('does not exist') && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Evaluation Tables Not Found in Supabase</p>
            <p className="mt-1 text-amber-800">
              Apply <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">{EVALUATION_MIGRATION_FILE}</code> in your Supabase SQL Editor to enable judge scoring and assignments.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Assigned</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalAssigned}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Completed</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{completedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Reviews</span>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{pendingCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">COI Recused</span>
              <p className="text-2xl font-bold text-amber-600 mt-1">{recusedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Assigned ({totalAssigned})
          </button>
          <button
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'pending'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-indigo-600'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilterTab('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'completed'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            onClick={() => setFilterTab('recused')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'recused'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-amber-700'
            }`}
          >
            Recused ({recusedCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            placeholder="Search entries or challenges..."
            className="pl-9 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Assignment Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading assigned submissions...</p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <Card className="border-dashed border-slate-300">
          <CardContent className="p-10 text-center space-y-3">
            <Award className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No submissions in this queue</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {totalAssigned === 0
                ? 'The committee has not assigned any project submissions to your evaluator profile yet.'
                : 'No assignments match the selected filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAssignments.map((assignment) => {
            const sub = assignment.submission;
            const score = assignment.existing_score;
            const isCompleted = assignment.status === 'completed';
            const isRecused = assignment.status === 'recused';

            return (
              <Card
                key={assignment.id}
                className="hover:border-indigo-300 transition-all shadow-sm"
              >
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Project Dossier */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono font-bold">
                          {sub.team?.name}
                        </Badge>
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {sub.title}
                        </h3>
                        {sub.problem_statement && (
                          <Badge variant="secondary" className="text-[10px]">
                            {sub.problem_statement.domain || 'Domain'}
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-1">
                        {sub.abstract}
                      </p>

                      {/* Deliverables indicators */}
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                        <span className={`flex items-center gap-1 ${sub.repo_url ? 'text-indigo-600 font-medium' : 'text-slate-300'}`}>
                          <Github className="w-3.5 h-3.5" /> Repo
                        </span>
                        <span className={`flex items-center gap-1 ${sub.demo_url ? 'text-emerald-600 font-medium' : 'text-slate-300'}`}>
                          <Globe className="w-3.5 h-3.5" /> Demo
                        </span>
                        <span className={`flex items-center gap-1 ${sub.presentation_url ? 'text-amber-600 font-medium' : 'text-slate-300'}`}>
                          <Presentation className="w-3.5 h-3.5" /> Slides
                        </span>
                        <span className={`flex items-center gap-1 ${sub.video_url ? 'text-rose-600 font-medium' : 'text-slate-300'}`}>
                          <Video className="w-3.5 h-3.5" /> Video
                        </span>
                      </div>
                    </div>

                    {/* Middle: Evaluation Status & Score */}
                    <div className="flex items-center gap-3 flex-shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                      {isCompleted && score ? (
                        <div className="text-center px-2">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Your Score
                          </span>
                          <span className="text-base font-bold text-emerald-700 block mt-0.5">
                            {score.weighted_score ?? score.total_score} / 10
                          </span>
                          {score.recommendation && (
                            <span className="text-[10px] uppercase font-bold text-slate-500 capitalize">
                              Rec: {score.recommendation}
                            </span>
                          )}
                        </div>
                      ) : isRecused ? (
                        <div className="px-3 py-1 text-center">
                          <span className="text-xs font-bold text-amber-700 block">Recused (COI)</span>
                          <span className="text-[10px] text-slate-400">Conflict declared</span>
                        </div>
                      ) : (
                        <div className="px-3 py-1 text-center">
                          <span className="text-xs font-semibold text-indigo-600 block">Pending Review</span>
                          <span className="text-[10px] text-slate-400">Round {assignment.round}</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link to={`/evaluator/score/${assignment.id}`}>
                        <Button
                          size="sm"
                          variant={isCompleted ? 'outline' : 'primary'}
                          className="text-xs"
                        >
                          {isCompleted ? (
                            <>
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              View / Edit Score
                            </>
                          ) : isRecused ? (
                            <>
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              View Recusal
                            </>
                          ) : (
                            <>
                              Score Submission
                              <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </>
                          )}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
