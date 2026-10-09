import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, CheckCircle2, ChevronLeft, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import {
  COMPANIES_MIGRATION_FILE,
  canVerifyCompany,
  fetchTenantCompanies,
  updateCompanyVerified,
  type CompanyErrorKind,
} from '../../lib/companies';
import type { Company } from '../../types/database';

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const PanelError: React.FC<{ message: string; errorKind: CompanyErrorKind | null }> = ({
  message,
  errorKind,
}) => (
  <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800">
    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
    <div className="space-y-1 min-w-0">
      <p className="font-semibold">Companies could not be read from the database.</p>
      <p className="break-words">{message}</p>
      {errorKind === 'missing_table' && (
        <p>
          Run <code className="font-mono">{COMPANIES_MIGRATION_FILE}</code> in the Supabase SQL Editor,
          then select Refresh.
        </p>
      )}
      {errorKind === 'permission' && (
        <p>Only members of the owning tenant are allowed to read its companies.</p>
      )}
    </div>
  </div>
);

const PanelEmptyState: React.FC<{ tenantName: string | null }> = ({ tenantName }) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center space-y-2">
    <Building2 className="w-6 h-6 text-slate-400 mx-auto" />
    <p className="text-xs font-semibold text-slate-700">
      No companies registered yet{tenantName ? ` for ${tenantName}` : ''}.
    </p>
    <p className="text-[11px] text-slate-500">
      This is a real, empty result from <code className="font-mono">public.companies</code> — not sample
      data.
    </p>
    <p className="text-[11px] text-slate-500">
      Companies register themselves via the company portal; admins verify them here.
    </p>
  </div>
);

const CompanyRow: React.FC<{
  company: Company;
  canVerify: boolean;
  onVerify: (companyId: string, verified: boolean) => void;
  isVerifying: boolean;
}> = ({ company, canVerify, onVerify, isVerifying }) => {
  const statusBadgeVariant = company.verified ? ('success' as BadgeVariant) : ('warning' as BadgeVariant);
  const statusLabel = company.verified ? 'Verified' : 'Pending approval';

  return (
    <div className="rounded-lg border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold text-slate-800 truncate">{company.name}</p>
          <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
        </div>
        {company.website && (
          <p className="text-[11px] text-slate-400 font-mono truncate">
            <a href={company.website} target="_blank" rel="noopener noreferrer" className="hover:underline text-indigo-600">
              {company.website}
            </a>
          </p>
        )}
        {company.industry && (
          <p className="text-[11px] text-slate-500">Industry: {company.industry}</p>
        )}
        <p className="text-[11px] text-slate-500">
          Registered {formatDate(company.created_at)} · Created by {company.created_by?.slice(0, 8) ?? '—'}
        </p>
      </div>
      <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
        {company.description && (
          <p className="text-[11px] text-slate-500 line-clamp-2 max-w-xs sm:max-w-md">{company.description}</p>
        )}
        {canVerify && (
          <div className="flex items-center gap-1.5">
            {!company.verified ? (
              <Button
                size="sm"
                onClick={() => onVerify(company.id, true)}
                isLoading={isVerifying}
                disabled={isVerifying}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-3 h-3" />
                Verify
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onVerify(company.id, false)}
                isLoading={isVerifying}
                disabled={isVerifying}
                className="text-rose-600 hover:bg-rose-50 border-rose-300"
              >
                <XCircle className="w-3 h-3" />
                Reject
              </Button>
            )}
          </div>
        )}
        {!canVerify && (
          <p className="text-[11px] text-slate-500">
            Only a college admin can change verification status.
          </p>
        )}
      </div>
    </div>
  );
};

export const AdminCompaniesPage: React.FC = () => {
  const { tenant, tenantId, role, isConfigured } = useAuth();

  const canVerify = canVerifyCompany(role);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<CompanyErrorKind | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!isConfigured) {
      setCompanies([]);
      setError(null);
      setErrorKind(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const result = await fetchTenantCompanies(tenantId);
    setCompanies(result.companies);
    setError(result.error);
    setErrorKind(result.errorKind);
    setIsLoading(false);
  }, [isConfigured, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleVerify = async (companyId: string, verified: boolean) => {
    setVerifyingIds((prev) => new Set(prev).add(companyId));
    try {
      const result = await updateCompanyVerified(tenantId, companyId, verified);
      if (result.error) {
        alert(result.error);
        return;
      }
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? result.company! : c))
      );
    } finally {
      setVerifyingIds((prev) => {
        const next = new Set(prev);
        next.delete(companyId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
            >
              <ChevronLeft className="w-3 h-3" />
              Back to Admin Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              Companies
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Every company below is read from <code className="font-mono">public.companies</code> for this
              college. Nothing on this page is sample data.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="success">Real database data</Badge>
            <Button size="sm" variant="outline" onClick={() => void load()} isLoading={isLoading}>
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3">
          {!isConfigured ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Supabase is not configured, so the live company table cannot be read. Apply{' '}
                <code className="font-mono">{COMPANIES_MIGRATION_FILE}</code> in the Supabase SQL Editor
                and set credentials in .env.
              </span>
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              Reading companies from Supabase…
            </div>
          ) : error ? (
            <PanelError message={error} errorKind={errorKind} />
          ) : companies.length === 0 ? (
            <PanelEmptyState tenantName={tenant?.name ?? null} />
          ) : (
            <div className="space-y-2">
              {companies.map((company) => (
                <CompanyRow
                  key={company.id}
                  company={company}
                  canVerify={canVerify}
                  onVerify={handleVerify}
                  isVerifying={verifyingIds.has(company.id)}
                />
              ))}
            </div>
          )}

          {isConfigured && !isLoading && !error && !canVerify && (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Read-only: only a college admin or committee member of this tenant can verify or reject
                companies.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};