import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  FileQuestion,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { ProblemStatementReviewCard } from '../../components/admin/ProblemStatementReviewCard';
import {
  PROBLEM_STATEMENTS_MIGRATION_FILE,
  fetchAllProblemStatements,
  canReviewProblemStatements,
  PROBLEM_STATEMENT_STATUS_LABELS,
} from '../../lib/problemStatements';
import { fetchTenantHackathons } from '../../lib/hackathons';
import { fetchTenantCompanies } from '../../lib/companies';
import type { ProblemStatement, Hackathon, Company } from '../../types/database';

const PROBLEM_STATEMENTS_STATUSES = [
  'all',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'published',
] as const;

export const AdminProblemReviewPage: React.FC = () => {
  const { tenant, tenantId, role, isConfigured } = useAuth();

  const canReview = canReviewProblemStatements(role);

  const [statements, setStatements] = useState<ProblemStatement[]>([]);
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [selectedHackathonId, setSelectedHackathonId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const [statementsResult, hackathonsResult, companiesResult] = await Promise.all([
      fetchAllProblemStatements(selectedHackathonId || undefined),
      fetchTenantHackathons(tenantId),
      fetchTenantCompanies(tenantId),
    ]);

    setStatements(statementsResult.problemStatements ?? []);
    setHackathons(hackathonsResult.hackathons ?? []);
    setCompanies(companiesResult.companies ?? []);

    if (statementsResult.error) setError(statementsResult.error);
    setIsLoading(false);
  }, [isConfigured, tenantId, selectedHackathonId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Derived helpers ───────────────────────────────────────────────────────

  const getCompanyName = (companyId: string) =>
    companies.find((c) => c.id === companyId)?.name ?? companyId.slice(0, 8);

  const getHackathonTitle = (hackathonId: string) =>
    hackathons.find((h) => h.id === hackathonId)?.title ?? hackathonId.slice(0, 8);

  const filtered = statements.filter((s) => {
    if (selectedStatus !== 'all' && s.status !== selectedStatus) return false;
    return true;
  });

  const pendingCount = statements.filter(
    (s) => s.status === 'submitted' || s.status === 'under_review',
  ).length;

  // ── Update single statement inline after review action ────────────────────

  const handleUpdated = (updated: ProblemStatement) => {
    setStatements((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s)),
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="w-3 h-3" />
          Back to Admin Dashboard
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-indigo-600" />
              Problem Statements Review
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Every row below is read from{' '}
              <code className="font-mono">public.problem_statements</code> for{' '}
              <strong>{tenant?.name || 'this college'}</strong>. Nothing on this page is sample data.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {pendingCount > 0 && (
              <Badge variant="warning">{pendingCount} pending</Badge>
            )}
            <Badge variant="success">Real database data</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void load()}
              isLoading={isLoading}
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {isConfigured && !isLoading && !error && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            id="filter-hackathon"
            label="Filter by Hackathon"
            value={selectedHackathonId}
            onChange={(e) => setSelectedHackathonId(e.target.value)}
          >
            <option value="">All hackathons</option>
            {hackathons.map((h) => (
              <option key={h.id} value={h.id}>{h.title}</option>
            ))}
          </Select>

          <Select
            id="filter-status"
            label="Filter by Status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            {PROBLEM_STATEMENTS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All statuses' : (PROBLEM_STATEMENT_STATUS_LABELS as Record<string, string>)[s] ?? s}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Content */}
      <Card>
        <CardContent className="space-y-3 py-4">
          {!isConfigured ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Supabase is not configured. Apply{' '}
                <code className="font-mono">{PROBLEM_STATEMENTS_MIGRATION_FILE}</code> in the
                Supabase SQL Editor and set credentials in .env.
              </span>
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
              <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              Reading problem statements from Supabase…
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Problem statements could not be read.</p>
                <p className="break-words">{error}</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center space-y-2">
              <FileQuestion className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                No problem statements{selectedStatus !== 'all' ? ` with status "${(PROBLEM_STATEMENT_STATUS_LABELS as Record<string, string>)[selectedStatus] ?? selectedStatus}"` : ''}.
              </p>
              <p className="text-[11px] text-slate-500">
                This is a real, empty result from{' '}
                <code className="font-mono">public.problem_statements</code> — not sample data.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((statement) => (
                <ProblemStatementReviewCard
                  key={statement.id}
                  statement={statement}
                  companyName={getCompanyName(statement.company_id)}
                  hackathonTitle={getHackathonTitle(statement.hackathon_id)}
                  canReview={canReview}
                  onUpdated={handleUpdated}
                />
              ))}
            </div>
          )}

          {isConfigured && !isLoading && !error && !canReview && (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Read-only: only a college admin or committee member of this tenant can approve,
                reject, or publish problem statements.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
