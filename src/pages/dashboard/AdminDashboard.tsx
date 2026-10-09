import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, 
  FileQuestion, 
  Award, 
  Clock, 
  TrendingUp,
  Building,
  CheckCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { TenantHackathonsPanel } from '../../components/admin/TenantHackathonsPanel';
import { canManageHackathons, fetchTenantHackathons } from '../../lib/hackathons';
import { fetchAllProblemStatements } from '../../lib/problemStatements';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import type { Hackathon, ProblemStatement, HackathonStatus } from '../../types/database';

export const AdminDashboard: React.FC = () => {
  const { tenant, tenantId, profile, role } = useAuth();
  const navigate = useNavigate();
  const canManage = canManageHackathons(role);

  const [metrics, setMetrics] = useState({
    studentsCount: 0,
    teamsCount: 0,
    evaluatorsCount: 0,
    problemsCount: 0,
    pendingProblemsCount: 0,
  });
  const [activeHackathon, setActiveHackathon] = useState<Hackathon | null>(null);
  const [pendingProblems, setPendingProblems] = useState<ProblemStatement[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

  useEffect(() => {
    const loadRealMetrics = async () => {
      if (!isSupabaseConfigured || !tenantId) {
        setIsLoadingMetrics(false);
        return;
      }

      try {
        setIsLoadingMetrics(true);

        // 1. Fetch tenant hackathons
        const { hackathons } = await fetchTenantHackathons(tenantId);
        const list = hackathons || [];
        const active = list.find((h) => ['registration', 'hacking', 'evaluation', 'problem_intake'].includes(h.status)) || list[0] || null;
        setActiveHackathon(active);

        // 2. Fetch counts
        const [studentsRes, evaluatorsRes, problemsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('tenant_id', tenantId),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'evaluator').eq('tenant_id', tenantId),
          fetchAllProblemStatements(active?.id)
        ]);

        const allProblems = problemsRes.problemStatements || [];
        const pending = allProblems.filter((p) => p.status === 'submitted' || p.status === 'under_review');
        setPendingProblems(pending.slice(0, 3));

        let teamsCount = 0;
        if (active?.id) {
          const { count } = await supabase.from('teams').select('id', { count: 'exact', head: true }).eq('hackathon_id', active.id);
          teamsCount = count || 0;
        }

        setMetrics({
          studentsCount: studentsRes.count || 0,
          evaluatorsCount: evaluatorsRes.count || 0,
          teamsCount,
          problemsCount: allProblems.length,
          pendingProblemsCount: pending.length
        });
      } catch (err) {
        console.warn('[AdminDashboard] Error loading live metrics:', err);
      } finally {
        setIsLoadingMetrics(false);
      }
    };

    loadRealMetrics();
  }, [tenantId]);

  const lifecycleStages: Array<{ status: HackathonStatus; label: string; step: number }> = [
    { status: 'draft', label: '1. Draft', step: 1 },
    { status: 'problem_intake', label: '2. Problem Intake', step: 2 },
    { status: 'registration', label: '3. Registration', step: 3 },
    { status: 'hacking', label: '4. Hacking', step: 4 },
    { status: 'evaluation', label: '5. Evaluation', step: 5 },
    { status: 'completed', label: '6. Completed', step: 6 },
  ];

  const currentStep = activeHackathon
    ? lifecycleStages.find((s) => s.status === activeHackathon.status)?.step || 1
    : 1;

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              College Admin Console
            </h1>
            <Badge variant="default" className="capitalize">
              {profile?.role?.replace('_', ' ') || 'Admin'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Managing hackathon operations and governance for <strong className="text-slate-800">{tenant?.name || 'HackBridge'}</strong> ({tenant?.slug?.toUpperCase() || 'MITT'}).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManage ? (
            <Button
              size="sm"
              className="bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
              onClick={() => navigate('/admin/hackathons/new')}
            >
              + New Hackathon
            </Button>
          ) : (
            <Badge variant="outline">Read-only role</Badge>
          )}
        </div>
      </div>

      {/* Live Hackathons Overview */}
      <TenantHackathonsPanel />

      {/* Live System Metrics (Real Database Aggregates) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Students Registered</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {isLoadingMetrics ? '—' : metrics.studentsCount}
              </p>
              <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {metrics.teamsCount} teams formed
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Problem Statements</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {isLoadingMetrics ? '—' : metrics.problemsCount}
              </p>
              <p className="text-[11px] text-amber-600 font-medium mt-1">
                {metrics.pendingProblemsCount} pending review
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <FileQuestion className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Active Evaluators</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {isLoadingMetrics ? '—' : metrics.evaluatorsCount}
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Double-blind judging pool
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Tenant Tier</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1 capitalize">
                {tenant?.plan || 'Enterprise'}
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Multi-tenant isolated
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Building className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Hackathon Lifecycle State Transition Bar */}
      {activeHackathon ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Active Event Lifecycle: <span className="text-indigo-600 font-bold">{activeHackathon.title}</span>
              </CardTitle>
              <Badge variant="success" className="capitalize">
                {activeHackathon.status.replace('_', ' ')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
              {lifecycleStages.map((stage) => {
                const isPassed = stage.step < currentStep;
                const isCurrent = stage.step === currentStep;
                return (
                  <div
                    key={stage.status}
                    className={`p-2.5 rounded-lg font-semibold transition-all ${
                      isCurrent
                        ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-200'
                        : isPassed
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {stage.label}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>
                Registration: {activeHackathon.registration_opens ? new Date(activeHackathon.registration_opens).toLocaleDateString() : 'TBD'} – {activeHackathon.registration_closes ? new Date(activeHackathon.registration_closes).toLocaleDateString() : 'TBD'}
              </span>
              <span>
                Hacking: {activeHackathon.hacking_starts ? new Date(activeHackathon.hacking_starts).toLocaleDateString() : 'TBD'} – {activeHackathon.hacking_ends ? new Date(activeHackathon.hacking_ends).toLocaleDateString() : 'TBD'}
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Operational Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Real Problem Review Pipeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Problem Review Pipeline</CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={() => navigate('/admin/problems')}
            >
              View All ({metrics.pendingProblemsCount})
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {pendingProblems.length > 0 ? (
              pendingProblems.map((p) => (
                <div key={p.id} className="p-3 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{p.title}</p>
                    <p className="text-slate-400 text-[11px]">
                      Domain: {p.domain || 'General'} · Difficulty: {p.difficulty || 'Medium'}
                    </p>
                  </div>
                  <Badge variant={p.status === 'approved' ? 'success' : 'warning'} className="capitalize">
                    {p.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-lg">
                <CheckCircle className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
                <p className="text-xs font-medium">All problem statements reviewed.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Judging & Evaluator Matrix */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Evaluator Allocation & Judging Matrix</CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={() => navigate('/admin/results')}
            >
              Open Matrix
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">Double-Blind Assignment Engine</p>
                <p className="text-slate-400 text-[11px]">Round-robin allocation with conflict-of-interest detection</p>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="p-3 border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">Evaluators Pool</p>
                <p className="text-slate-400 text-[11px]">
                  {metrics.evaluatorsCount} faculty & industry evaluators ready
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-[11px] h-6 px-2 text-indigo-600"
                onClick={() => navigate('/admin/evaluators')}
              >
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
