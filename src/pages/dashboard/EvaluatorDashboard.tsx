import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  CheckSquare, 
  Award, 
  ShieldAlert,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { fetchEvaluatorAssignments } from '../../lib/evaluations';
import type { EvaluationAssignmentWithDetails } from '../../types/database';

export const EvaluatorDashboard: React.FC = () => {
  const { user, profile, tenant, isConfigured } = useAuth();

  const [assignments, setAssignments] = useState<EvaluationAssignmentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    fetchEvaluatorAssignments(user.id).then(({ assignments: list }) => {
      setAssignments(list);
      setIsLoading(false);
    });
  }, [isConfigured, user?.id]);

  const totalAssigned = assignments.length;
  const completedCount = assignments.filter((a) => a.status === 'completed').length;
  const pendingCount = assignments.filter((a) => a.status === 'pending' || a.status === 'in_progress').length;
  const recusedCount = assignments.filter((a) => a.status === 'recused').length;

  const nextPending = assignments.find((a) => a.status === 'pending' || a.status === 'in_progress');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              Evaluator Scoring Console
            </h1>
            <Badge variant="success">Active Desk</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Welcome back, <strong className="text-slate-800">{profile?.full_name || 'Judge'}</strong> · {tenant?.name || 'MITT'} · Double-blind scoring desk.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/evaluator/assignments">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs">
              <CheckSquare className="w-3.5 h-3.5 mr-1" />
              Open Assignment Queue
            </Button>
          </Link>
        </div>
      </div>

      {/* Evaluator Queue Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Assigned Submissions</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalAssigned}</p>
              <p className="text-[11px] text-indigo-600 font-medium mt-1">{pendingCount} Pending Review</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <CheckSquare className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Completed Reviews</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{completedCount}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">Rubrics Submitted</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Pending Evaluation</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
              <p className="text-[11px] text-amber-600 font-medium mt-1">Awaiting Scoring</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">COI Recusals</p>
              <p className="text-2xl font-bold text-slate-700 mt-1">{recusedCount}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">Declared Conflicts</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Next Up Banner */}
      {nextPending && (
        <div className="p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm border border-slate-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
              Next Pending Submission
            </span>
            <h3 className="text-base font-bold mt-0.5">{nextPending.submission.title}</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              {nextPending.submission.team?.name} · Round {nextPending.round} · Challenge: {nextPending.submission.problem_statement?.title || 'General'}
            </p>
          </div>
          <Link to={`/evaluator/score/${nextPending.id}`} className="flex-shrink-0">
            <Button size="md" className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs">
              Score This Entry <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* Assigned Submissions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-600" />
              Your Assigned Scoring Queue
            </CardTitle>
            <Link to="/evaluator/assignments" className="text-xs text-indigo-600 hover:underline">
              View All
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading queue...</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No submissions assigned to you yet.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                The hackathon committee will assign entries once the hacking phase closes.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {assignments.slice(0, 5).map((assignment) => {
                const sub = assignment.submission;
                const score = assignment.existing_score;
                return (
                  <div key={assignment.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-500">{sub.team?.name}</span>
                        <h4 className="text-xs font-semibold text-slate-800 truncate">{sub.title}</h4>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Challenge: {sub.problem_statement?.domain || 'General'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {assignment.status === 'completed' ? (
                        <Badge variant="success" className="text-[10px]">
                          Scored: {score?.weighted_score ?? score?.total_score} / 10
                        </Badge>
                      ) : assignment.status === 'recused' ? (
                        <Badge variant="warning" className="text-[10px]">
                          COI Recused
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px]">
                          Pending
                        </Badge>
                      )}

                      <Link to={`/evaluator/score/${assignment.id}`}>
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2">
                          {assignment.status === 'completed' ? 'View' : 'Score'}
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
