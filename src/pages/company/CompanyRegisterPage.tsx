import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, CheckCircle2, ChevronLeft, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { CompanyForm } from '../../components/admin/CompanyForm';
import {
  COMPANIES_MIGRATION_FILE,
  createCompany,
  updateCompany,
  fetchMyCompany,
} from '../../lib/companies';
import {
  emptyCompanyFormValues,
  companyToFormValues,
  toCompanyWritableFields,
  type CompanyFormValues,
} from '../../lib/companyForm';
import type { Company } from '../../types/database';

const errorClasses =
  'flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800';
const successClasses =
  'flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-[11px] text-emerald-900';

const ReadOnlyNotice: React.FC<{ role: string | null }> = ({ role }) => (
  <Card>
    <CardContent className="flex items-start gap-3 p-5">
      <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold text-slate-800">Access restricted</p>
        <p className="text-[11px] text-slate-500 mt-1">
          Your role ({role ?? 'unknown'}) cannot register a company. Only a company representative
          (company_rep) can create a company record — the same rule is enforced by the database
          Row Level Security policies.
        </p>
      </div>
    </CardContent>
  </Card>
);

const AlreadyRegistered: React.FC<{ company: Company; onEdit: () => void }> = ({
  company,
  onEdit,
}) => {
  const statusVariant = company.verified ? ('success' as BadgeVariant) : ('warning' as BadgeVariant);
  const statusLabel = company.verified ? 'Verified' : 'Pending approval';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Registered Partner Profile</h2>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            {company.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant}>{statusLabel}</Badge>
            {!company.verified && (
              <Badge variant="outline">Awaiting admin review</Badge>
            )}
          </div>
          {company.website && (
            <p className="text-[11px] text-slate-500">
              Website: <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{company.website}</a>
            </p>
          )}
          {company.industry && (
            <p className="text-[11px] text-slate-500">Industry: {company.industry}</p>
          )}
          {company.description && (
            <p className="text-[11px] text-slate-500">{company.description}</p>
          )}
          <p className="text-[11px] text-slate-400">Registered on {new Date(company.created_at).toLocaleDateString()}</p>
        </CardContent>
      </Card>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onEdit} variant="outline">
          Edit Company Details
        </Button>
        {!company.verified && (
          <p className="text-[11px] text-amber-700">
            Your company is pending approval by a college admin. You can edit details while waiting.
          </p>
        )}
      </div>
    </div>
  );
};

const ConfigurationError: React.FC = () => (
  <div className={errorClasses}>
    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
    <span>
      Supabase is not configured. Apply <code className="font-mono">{COMPANIES_MIGRATION_FILE}</code> in the Supabase SQL Editor and set credentials in .env.
    </span>
  </div>
);

export const CompanyRegisterPage: React.FC = () => {
  const { tenant, tenantId, role, profile, isConfigured, refreshProfile } = useAuth();

  const isCompanyRep = role === 'company_rep';

  const [existingCompany, setExistingCompany] = useState<Company | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);

  const loadMyCompany = useCallback(async () => {
    if (!profile?.id) return;
    setIsLoading(true);
    setLoadError(null);
    const result = await fetchMyCompany(tenantId, profile.id);
    if (result.errorKind === 'not_found' || !result.company) {
      setExistingCompany(null);
      setLoadError(null);
      setShowForm(true); // Automatically show registration form for new company reps
    } else {
      setExistingCompany(result.company);
      setLoadError(result.error);
      setShowForm(false);
    }
    setIsLoading(false);
  }, [tenantId, profile?.id]);

  useEffect(() => {
    if (isConfigured && profile?.id) {
      void loadMyCompany();
    } else if (!isConfigured) {
      setIsLoading(false);
    }
  }, [isConfigured, profile?.id, loadMyCompany]);

  const handleCreate = async (values: CompanyFormValues): Promise<void> => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const fields = { ...toCompanyWritableFields(values), tenant_id: tenantId! } as import('../../types/database').CompanyInsertPayload;
      const result = await createCompany(tenantId, fields);

      if (result.error || !result.company) {
        setSubmitError(result.error ?? 'The company could not be created.');
        return;
      }

      setNotice('Company registered successfully! It is now pending admin approval.');
      setShowForm(false);
      await refreshProfile(); // Refresh profile to get the new company_id link
      void loadMyCompany(); // Reload the company data
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (values: CompanyFormValues): Promise<void> => {
    if (!existingCompany) return;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const fields = toCompanyWritableFields(values);
      const result = await updateCompany(tenantId, existingCompany.id, fields);

      if (result.error || !result.company) {
        setSubmitError(result.error ?? 'The company could not be updated.');
        return;
      }

      setNotice('Company details updated successfully.');
      setShowForm(false);
      setExistingCompany(result.company);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setSubmitError(null);
    setNotice(null);
  };

  // ---- Render ----
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-medium text-slate-500">Loading company data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="border-b border-slate-200 pb-5">
        <Link
          to="/company"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="w-3 h-3" />
          Back to Company Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">
          {existingCompany ? 'Your Company' : 'Register Your Company'}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {existingCompany ? (
            'View and edit your company details. Verification is managed by college admins.'
          ) : (
            <>
              Create your company record for{' '}
              <strong className="text-slate-700">{tenant?.name || 'this college'}</strong>.
              The record will be pending approval until a college admin verifies it.
            </>
          )}
        </p>
      </div>

      {!isConfigured ? (
        <ConfigurationError />
      ) : !isCompanyRep ? (
        <ReadOnlyNotice role={role} />
      ) : loadError ? (
        <div className={errorClasses}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="break-words">{loadError}</span>
        </div>
      ) : existingCompany && !showForm ? (
        <AlreadyRegistered company={existingCompany} onEdit={() => setShowForm(true)} />
      ) : (
        <CompanyForm
          mode={existingCompany ? 'edit' : 'create'}
          initialValues={existingCompany ? companyToFormValues(existingCompany) : emptyCompanyFormValues()}
          isSubmitting={isSubmitting}
          submitError={submitError}
          submitLabel={existingCompany ? 'Update Company Details' : 'Register Company'}
          notice={notice}
          onSubmit={existingCompany ? handleUpdate : handleCreate}
          onCancel={existingCompany ? handleCancel : () => {}}
        />
      )}

      {notice && (
        <div className={successClasses}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="break-words">{notice}</span>
        </div>
      )}
    </div>
  );
};