import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, FileQuestion, Plus, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import {
  COMPANIES_MIGRATION_FILE,
  fetchMyCompany,
} from '../../lib/companies';
import { fetchMyProblemStatements } from '../../lib/problemStatements';
import type { Company } from '../../types/database';

const noticeClasses =
  'flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900';
const errorClasses =
  'flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800';
const successClasses =
  'flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-[11px] text-emerald-900';

const ConfigurationError: React.FC = () => (
  <div className="space-y-6">
    <div className={errorClasses}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>
        Supabase is not configured. Apply <code className="font-mono">{COMPANIES_MIGRATION_FILE}</code> in the Supabase SQL Editor and set credentials in .env.
      </span>
    </div>
    <p className="text-xs text-slate-500">
      The sample data below is for demonstration only and will be replaced by real data once configured.
    </p>
    <SampleDashboardContent />
  </div>
);

const SampleDashboardContent: React.FC = () => (
  <div className="space-y-6">
    {/* Overview stats */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Problems Submitted</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">2</p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">1 Approved & Live</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FileQuestion className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Student Teams Attempting</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">18</p>
            <p className="text-[11px] text-indigo-600 font-medium mt-1">Active Hackers</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Hiring Pipeline</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">Active</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Unlocks post-evaluation</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Submitted Problems List */}
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Your Problem Statements & Challenges (Sample Data)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div className="p-4 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="success">Published for Students</Badge>
              <Badge variant="outline">Difficulty: Medium</Badge>
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              Real-time Autonomous Traffic Signal Synchronization
            </h4>
            <p className="text-slate-500">
              Domain: Smart Cities · Dataset Provided (traffic_sample.csv) · Hiring Intent: Immediate Internship
            </p>
          </div>
          <Button size="sm" variant="outline">
            Manage Challenge
          </Button>
        </div>

        <div className="p-4 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="warning">Under Committee Review</Badge>
              <Badge variant="outline">Difficulty: Hard</Badge>
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              Low-latency Vehicle-to-Infrastructure Messaging Bus
            </h4>
            <p className="text-slate-500">
              Domain: IoT & Automotive · Review notes expected within 24 hours
            </p>
          </div>
          <Button size="sm" variant="outline">
            Edit Draft
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
);

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-xs font-medium text-slate-500">Loading your company...</p>
    </div>
  </div>
);

const NoCompanyCard: React.FC<{ onRegister: () => void; tenantName: string | null }> = ({
  onRegister,
  tenantName,
}) => (
  <Card>
    <CardContent className="p-6 space-y-4 text-center">
      <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
      <p className="text-sm font-semibold text-slate-700">No company registered yet</p>
      <p className="text-xs text-slate-500">
        Register your company for <strong className="text-slate-800">{tenantName || 'this college'}</strong> to start
        submitting problem statements to hackathons.
      </p>
      <Button onClick={onRegister} className="w-full sm:w-auto" size="lg">
        <Plus className="w-4 h-4" />
        Register Company
      </Button>
    </CardContent>
  </Card>
);

const CompanyProfileCard: React.FC<{ company: Company; onEdit: () => void }> = ({
  company,
  onEdit,
}) => {
  const statusBadgeVariant = company.verified ? ('success' as BadgeVariant) : ('warning' as BadgeVariant);
  const statusLabel = company.verified ? 'Verified' : 'Pending approval';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              {company.name}
            </CardTitle>
            <p className="text-[11px] text-slate-500 mt-1">
              Registered on {new Date(company.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
            {!company.verified && (
              <Badge variant="outline">Awaiting admin review</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit Company Details
          </Button>
          {!company.verified && (
            <div className={noticeClasses} style={{ flex: 1 }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="text-[11px] text-amber-900">
                Your company is <strong>pending approval</strong> by a college admin. You can edit details while waiting.
              </span>
            </div>
          )}
          {company.verified && (
            <div className={successClasses} style={{ flex: 1 }}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="text-[11px] text-emerald-900">
                Your company is <strong>verified</strong> and can submit problem statements.
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const CompanyDashboard: React.FC = () => {
  const { tenant, tenantId, profile, isConfigured, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [company, setCompany] = useState<Company | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Problem statement counts
  const [psSubmitted, setPsSubmitted] = useState(0);
  const [psPublished, setPsPublished] = useState(0);

  const loadMyCompany = async () => {
    if (!profile?.id) return;
    setIsLoading(true);
    setLoadError(null);
    const result = await fetchMyCompany(tenantId, profile.id);
    const resolvedCompany = result.errorKind === 'not_found' ? null : result.company;
    setCompany(resolvedCompany);
    if (result.error && result.errorKind !== 'not_found') setLoadError(result.error);

    if (resolvedCompany) {
      const psResult = await fetchMyProblemStatements(resolvedCompany.id);
      const psList = psResult.problemStatements ?? [];
      setPsSubmitted(psList.filter((p) => p.status !== 'published').length);
      setPsPublished(psList.filter((p) => p.status === 'published').length);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const safety = setTimeout(() => setIsLoading(false), 1000);
    if (isConfigured && profile?.id) {
      loadMyCompany().finally(() => clearTimeout(safety));
    } else {
      setIsLoading(false);
      clearTimeout(safety);
    }
    return () => clearTimeout(safety);
  }, [isConfigured, profile?.id, tenantId]);

  if (authLoading) {
    return <LoadingScreen />;
  }

  const handleRegister = () => navigate('/company/register');
  const handleEdit = () => navigate('/company/register');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              Industry Partner Portal
            </h1>
            <Badge variant="default">Problem Setter</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise collaboration hub at <strong className="text-slate-800">{tenant?.name}</strong>. Submit industrial challenges and scout engineering talent.
          </p>
        </div>
      </div>

      {!isConfigured ? (
        <ConfigurationError />
      ) : isLoading ? (
        <LoadingScreen />
      ) : loadError ? (
        <div className={errorClasses}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="break-words">{loadError}</span>
        </div>
      ) : company ? (
        <>
          <CompanyProfileCard company={company} onEdit={handleEdit} />

          {/* Overview stats (sample data - labeled) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Problems Submitted</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">—</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Problem statements feature coming soon</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FileQuestion className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Student Teams Attempting</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">—</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Problem statements feature coming soon</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Hiring Pipeline</p>
                  <p className="text-2xl font-bold text-slate-400 mt-1">Locked</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Unlocks post-evaluation</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Problem Statements — real data */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileQuestion className="w-4 h-4 text-indigo-600" />
                  Problem Statements
                </span>
                <Link
                  to="/company/problems"
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-slate-200 space-y-1">
                  <p className="text-[11px] text-slate-500">In review / draft</p>
                  <p className="text-2xl font-bold text-slate-900">{psSubmitted}</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 space-y-1">
                  <p className="text-[11px] text-slate-500">Published</p>
                  <p className="text-2xl font-bold text-emerald-600">{psPublished}</p>
                </div>
              </div>
              {company.verified ? (
                <Link to="/company/problems">
                  <Button size="sm" variant="outline" className="w-full">
                    <Plus className="w-3.5 h-3.5" />
                    Submit New Problem Statement
                  </Button>
                </Link>
              ) : (
                <p className="text-[11px] text-amber-700">
                  Your company must be <strong>verified</strong> before you can submit problem statements.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <NoCompanyCard onRegister={handleRegister} tenantName={tenant?.name ?? null} />
      )}
    </div>
  );
};