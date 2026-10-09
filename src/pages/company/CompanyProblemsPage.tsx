import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  FileQuestion,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { ProblemStatementForm } from '../../components/company/ProblemStatementForm';
import {
  PROBLEM_STATEMENTS_MIGRATION_FILE,
  fetchMyProblemStatements,
  createProblemStatement,
  updateProblemStatement,
  PROBLEM_STATEMENT_STATUS_LABELS,
  PROBLEM_STATEMENT_STATUS_BADGE,
  DIFFICULTY_LABELS,
  HIRING_POTENTIAL_LABELS,
} from '../../lib/problemStatements';
import {
  emptyProblemStatementFormValues,
  fromProblemStatement,
  toProblemStatementInsertPayload,
  toProblemStatementEditPayload,
  type ProblemStatementFormValues,
} from '../../lib/problemStatementForm';
import { fetchTenantHackathons } from '../../lib/hackathons';
import { fetchMyCompany, COMPANIES_MIGRATION_FILE } from '../../lib/companies';
import type { ProblemStatement, Hackathon, Company } from '../../types/database';

const errorClasses =
  'flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800';
const successClasses =
  'flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-[11px] text-emerald-900';
const noticeClasses =
  'flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ProblemStatementRow: React.FC<{
  statement: ProblemStatement;
  hackathonTitle: string;
  onEdit: (ps: ProblemStatement) => void;
}> = ({ statement, hackathonTitle, onEdit }) => {
  const statusVariant = PROBLEM_STATEMENT_STATUS_BADGE[statement.status] as BadgeVariant;
  const statusLabel = PROBLEM_STATEMENT_STATUS_LABELS[statement.status];

  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant}>{statusLabel}</Badge>
            {statement.difficulty && (
              <Badge variant="outline">{DIFFICULTY_LABELS[statement.difficulty] ?? statement.difficulty}</Badge>
            )}
            {statement.domain && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {statement.domain}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-900 leading-snug">{statement.title}</p>
          <p className="text-[11px] text-slate-500">Hackathon: {hackathonTitle}</p>
          {statement.hiring_potential && statement.hiring_potential !== 'none' && (
            <p className="text-[11px] text-emerald-600 font-medium">
              Hiring: {HIRING_POTENTIAL_LABELS[statement.hiring_potential] ?? statement.hiring_potential}
            </p>
          )}
          {statement.review_notes && statement.status === 'rejected' && (
            <p className="text-[11px] text-rose-700 mt-1">
              <span className="font-semibold">Review note:</span> {statement.review_notes}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          {statement.status === 'submitted' ? (
            <Button size="sm" variant="outline" onClick={() => onEdit(statement)}>
              Edit Draft
            </Button>
          ) : (
            <span className="text-[11px] text-slate-400">
              {statement.status === 'published' ? 'Visible to students' : 'Read-only'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type PageMode = 'list' | 'new' | 'edit';

export const CompanyProblemsPage: React.FC = () => {
  const { tenant, tenantId, role, profile, isConfigured } = useAuth();

  const isCompanyRep = role === 'company_rep';

  // Company and hackathon data
  const [company, setCompany] = useState<Company | null>(null);
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [statements, setStatements] = useState<ProblemStatement[]>([]);

  // UI state
  const [pageMode, setPageMode] = useState<PageMode>('list');
  const [editingStatement, setEditingStatement] = useState<ProblemStatement | null>(null);
  const [selectedHackathonId, setSelectedHackathonId] = useState<string>('');

  const [isLoadingInit, setIsLoadingInit] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ── Loaders ─────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!isConfigured || !profile?.id) {
      setIsLoadingInit(false);
      return;
    }

    setIsLoadingInit(true);
    setLoadError(null);

    // Load company and hackathons in parallel
    const [companyResult, hackathonResult] = await Promise.all([
      fetchMyCompany(tenantId, profile.id),
      fetchTenantHackathons(tenantId),
    ]);

    // "not found" from fetchMyCompany means no company yet — not an error to show
    const resolvedCompany =
      companyResult.errorKind === 'not_found' ? null : companyResult.company;
    setCompany(resolvedCompany);
    if (companyResult.error && companyResult.errorKind !== 'not_found') {
      setLoadError(companyResult.error);
    }

    const liveHackathons = (hackathonResult.hackathons ?? []).filter(
      (h) => h.status !== 'archived' && h.status !== 'draft',
    );
    setHackathons(liveHackathons);

    if (resolvedCompany) {
      const statementsResult = await fetchMyProblemStatements(resolvedCompany.id);
      setStatements(statementsResult.problemStatements ?? []);
      if (statementsResult.error && statementsResult.errorKind !== 'missing_table') {
        setLoadError(statementsResult.error);
      }
    }

    setIsLoadingInit(false);
  }, [isConfigured, profile?.id, tenantId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ── Submit handlers ──────────────────────────────────────────────────────

  const handleCreate = async (values: ProblemStatementFormValues) => {
    if (!company || !selectedHackathonId) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const payload = toProblemStatementInsertPayload(values, selectedHackathonId, company.id);
      const result = await createProblemStatement(payload);
      if (result.error || !result.problemStatement) {
        setSubmitError(result.error ?? 'Failed to submit problem statement.');
        return;
      }
      setStatements((prev) => [result.problemStatement!, ...prev]);
      setNotice('Problem statement submitted successfully! It is now pending admin review.');
      setPageMode('list');
      setSelectedHackathonId('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (values: ProblemStatementFormValues) => {
    if (!editingStatement) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const payload = toProblemStatementEditPayload(values);
      const result = await updateProblemStatement(editingStatement.id, payload);
      if (result.error || !result.problemStatement) {
        setSubmitError(result.error ?? 'Failed to update problem statement.');
        return;
      }
      setStatements((prev) =>
        prev.map((s) => (s.id === result.problemStatement!.id ? result.problemStatement! : s)),
      );
      setNotice('Problem statement updated successfully.');
      setPageMode('list');
      setEditingStatement(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setPageMode('list');
    setEditingStatement(null);
    setSubmitError(null);
    setNotice(null);
  };

  // ── Derive selected hackathon object ─────────────────────────────────────

  const selectedHackathon = hackathons.find((h) => h.id === selectedHackathonId) ?? null;

  const getHackathonTitle = (hackathonId: string) =>
    hackathons.find((h) => h.id === hackathonId)?.title ?? hackathonId.slice(0, 8);

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading problem statements…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <Link
          to="/company"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="w-3 h-3" />
          Back to Company Dashboard
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mt-1">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-indigo-600" />
              Problem Statements
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Submit and manage problem statements for hackathons at{' '}
              <strong className="text-slate-700">{tenant?.name || 'this college'}</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isConfigured && company?.verified && pageMode === 'list' && hackathons.length > 0 && (
              <Button size="sm" onClick={() => { setPageMode('new'); setNotice(null); }}>
                <Plus className="w-3.5 h-3.5" />
                Submit New Problem
              </Button>
            )}
            {pageMode === 'list' && isConfigured && (
              <Button size="sm" variant="outline" onClick={() => void loadAll()}>
                <RefreshCw className="w-3 h-3" />
                Refresh
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Notices */}
      {notice && (
        <div className={successClasses}>
          <span className="break-words">{notice}</span>
        </div>
      )}

      {/* ── Not configured ── */}
      {!isConfigured && (
        <div className={errorClasses}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Supabase is not configured. Apply{' '}
            <code className="font-mono">{COMPANIES_MIGRATION_FILE}</code> then{' '}
            <code className="font-mono">{PROBLEM_STATEMENTS_MIGRATION_FILE}</code> in the
            Supabase SQL Editor and set credentials in .env.
          </span>
        </div>
      )}

      {/* ── Wrong role ── */}
      {isConfigured && !isCompanyRep && (
        <Card>
          <CardContent className="p-5 text-xs text-slate-600">
            Only a <strong>company_rep</strong> can submit problem statements.
          </CardContent>
        </Card>
      )}

      {/* ── Load error ── */}
      {loadError && (
        <div className={errorClasses}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="break-words">{loadError}</span>
        </div>
      )}

      {/* ── No company ── */}
      {isConfigured && isCompanyRep && !company && !loadError && (
        <Card>
          <CardContent className="p-6 space-y-2 text-center">
            <FileQuestion className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No company registered</p>
            <p className="text-xs text-slate-500">
              Register and get your company verified before you can submit problem statements.
            </p>
            <Link to="/company/register">
              <Button size="sm" className="mt-2">Register Company</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── Company not verified ── */}
      {isConfigured && isCompanyRep && company && !company.verified && (
        <div className={noticeClasses}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Your company <strong>{company.name}</strong> is awaiting admin verification. You can
            submit problem statements once it is verified.
          </span>
        </div>
      )}

      {/* ── New / Edit form ── */}
      {isConfigured && isCompanyRep && company?.verified && (pageMode === 'new' || pageMode === 'edit') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {pageMode === 'new' ? 'Submit New Problem Statement' : 'Edit Problem Statement'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hackathon picker (create mode only) */}
            {pageMode === 'new' && (
              <div className="space-y-3">
                {hackathons.length === 0 ? (
                  <div className={noticeClasses}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                      No active hackathons are currently accepting problem statements.
                    </span>
                  </div>
                ) : (
                  <Select
                    id="hackathon-picker"
                    label="Select Hackathon *"
                    value={selectedHackathonId}
                    onChange={(e) => setSelectedHackathonId(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="">— choose a hackathon —</option>
                    {hackathons.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.title} ({h.status})
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}

            {/* Form — show when hackathon is selected (create) or editing */}
            {(pageMode === 'edit' || (pageMode === 'new' && selectedHackathon)) && (
              <ProblemStatementForm
                mode={pageMode === 'new' ? 'create' : 'edit'}
                initialValues={
                  pageMode === 'edit' && editingStatement
                    ? fromProblemStatement(editingStatement)
                    : emptyProblemStatementFormValues()
                }
                hackathon={
                  pageMode === 'edit'
                    ? (hackathons.find((h) => h.id === editingStatement?.hackathon_id) ?? hackathons[0])
                    : selectedHackathon!
                }
                isSubmitting={isSubmitting}
                submitError={submitError}
                onSubmit={pageMode === 'edit' ? handleEdit : handleCreate}
                onCancel={handleCancel}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ── List ── */}
      {isConfigured && pageMode === 'list' && company && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Your Problem Statements</span>
              <Badge variant="success">Real database data</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statements.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center space-y-2">
                <FileQuestion className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">No problem statements yet</p>
                <p className="text-[11px] text-slate-500">
                  {company.verified
                    ? 'Click "Submit New Problem" to contribute your first challenge to a hackathon.'
                    : 'Verification is pending — you can submit once your company is approved.'}
                </p>
              </div>
            ) : (
              statements.map((s) => (
                <ProblemStatementRow
                  key={s.id}
                  statement={s}
                  hackathonTitle={getHackathonTitle(s.hackathon_id)}
                  onEdit={(ps) => {
                    setEditingStatement(ps);
                    setPageMode('edit');
                    setNotice(null);
                  }}
                />
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
