import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Calendar, CheckCircle2, ChevronLeft, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { TenantHackathonsPanel } from '../../components/admin/TenantHackathonsPanel';
import { HackathonForm } from '../../components/admin/HackathonForm';
import {
  HACKATHON_LIFECYCLE,
  HACKATHON_STATUS_LABELS,
  canManageHackathons,
  createHackathon,
  fetchHackathonById,
  fetchTenantHackathonSlugs,
  isValidHackathonTransition,
  nextAvailableSlug,
  nextHackathonStatus,
  updateHackathon,
  updateHackathonStatus,
} from '../../lib/hackathons';
import {
  HACKATHON_VISIBILITY_LABELS,
  emptyHackathonFormValues,
  hackathonToFormValues,
  toHackathonWritableFields,
  type HackathonFormValues,
} from '../../lib/hackathonForm';
import type { Hackathon, HackathonStatus, HackathonWritableFields } from '../../types/database';

/**
 * Phase 2B — College Admin hackathon workspace.
 *
 * Three modes share one route family (all rendered inside the existing
 * `ProtectedRoute` admin guard):
 *   /admin/hackathons          list (real Supabase data)
 *   /admin/hackathons/new      create (form sections A–F)
 *   /admin/hackathons/:id      detail + edit + lifecycle control
 *
 * Tenant safety: the tenant id always comes from `useAuth()` (the tenant row the
 * Phase 1 architecture resolved from the database). The tenant is never taken
 * from the form, and the Phase 2A RLS policies re-check it server-side, so a
 * tampered request cannot touch another tenant's data.
 */

const statusBadgeVariant = (status: HackathonStatus): BadgeVariant => {
  switch (status) {
    case 'registration':
    case 'completed':
      return 'success';
    case 'problem_intake':
      return 'warning';
    case 'hacking':
    case 'evaluation':
      return 'default';
    case 'archived':
      return 'secondary';
    case 'draft':
    default:
      return 'outline';
  }
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const noticeClasses =
  'flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900';
const errorClasses =
  'flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800';

const ReadOnlyNotice: React.FC<{ role: string | null }> = ({ role }) => (
  <Card>
    <CardContent className="flex items-start gap-3 p-5">
      <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold text-slate-800">Read-only access</p>
        <p className="text-[11px] text-slate-500 mt-1">
          Your role ({role ?? 'unknown'}) can view this college&apos;s hackathons but cannot create or
          edit them. Only a college admin can manage hackathons — the same rule is enforced by the
          database Row Level Security policies.
        </p>
      </div>
    </CardContent>
  </Card>
);

export const AdminHackathonsPage: React.FC = () => {
  const { tenant, tenantId, role, isConfigured } = useAuth();
  const { hackathonId } = useParams<{ hackathonId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const isCreate = location.pathname.endsWith('/new') || hackathonId === 'new';
  const editId = !isCreate && hackathonId ? hackathonId : null;
  const canManage = canManageHackathons(role);

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState<HackathonStatus>('draft');
  const [isStatusSubmitting, setIsStatusSubmitting] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // A notice handed over by the create step (for example, an adjusted slug).
  const routeNotice = (location.state as { notice?: string } | null)?.notice ?? null;

  const loadHackathon = useCallback(async () => {
    if (!editId) return;
    setIsLoading(true);
    setLoadError(null);
    const result = await fetchHackathonById(tenantId, editId);
    setHackathon(result.hackathon);
    setLoadError(result.error);
    if (result.hackathon) setStatusValue(result.hackathon.status);
    setIsLoading(false);
  }, [editId, tenantId]);

  useEffect(() => {
    if (editId) void loadHackathon();
  }, [editId, loadHackathon]);

  const handleCreate = async (values: HackathonFormValues): Promise<void> => {
    setSubmitError(null);
    setIsSubmitting(true);
    let adjustedNotice: string | null = null;

    try {
      const fields = toHackathonWritableFields(values);

      // Slug pre-check. The database UNIQUE(tenant_id, slug) constraint stays
      // the authority; this only avoids a needless failed insert.
      const slugList = await fetchTenantHackathonSlugs(tenantId);
      let payload: HackathonWritableFields = fields;

      if (slugList.error) {
        adjustedNotice = `Slug uniqueness could not be pre-checked (${slugList.error}). The database constraint still applies.`;
      } else if (slugList.slugs.includes(fields.slug)) {
        const uniqueSlug = nextAvailableSlug(fields.slug, slugList.slugs);
        payload = { ...fields, slug: uniqueSlug };
        adjustedNotice = `The slug "${fields.slug}" is already used in this college, so "${uniqueSlug}" was saved instead.`;
      }

      const result = await createHackathon(tenantId, payload);

      if (result.error || !result.hackathon) {
        setSubmitError(result.error ?? 'The hackathon could not be created.');
        return;
      }

      navigate(`/admin/hackathons/${result.hackathon.id}`, {
        replace: true,
        state: adjustedNotice ? { notice: adjustedNotice } : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (values: HackathonFormValues): Promise<void> => {
    if (!hackathon) return;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const result = await updateHackathon(
        tenantId,
        hackathon.id,
        toHackathonWritableFields(values)
      );

      if (result.error || !result.hackathon) {
        setSubmitError(result.error ?? 'The hackathon could not be saved.');
        return;
      }

      setHackathon(result.hackathon);
      setNotice('Changes saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (target?: HackathonStatus): Promise<void> => {
    if (!hackathon) return;
    const requestedStatus = target ?? statusValue;
    setStatusError(null);
    setIsStatusSubmitting(true);

    try {
      // The Phase 2A trigger validates the transition; an invalid jump is
      // rejected by the database and surfaced as a readable message.
      const result = await updateHackathonStatus(tenantId, hackathon.id, requestedStatus);

      if (result.error || !result.hackathon) {
        setStatusError(result.error ?? 'The lifecycle status could not be changed.');
        return;
      }

      setHackathon(result.hackathon);
      setStatusValue(result.hackathon.status);
      setNotice(`Lifecycle status is now ${HACKATHON_STATUS_LABELS[result.hackathon.status]}.`);
    } finally {
      setIsStatusSubmitting(false);
    }
  };

  const nextStatus = hackathon ? nextHackathonStatus(hackathon.status) : null;
  const activeNotice = notice ?? routeNotice;

  // ---- List mode -----------------------------------------------------
  if (!isCreate && !editId) {
    return (
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Hackathons
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Every event below is read from <code className="font-mono">public.hackathons</code> for this
            college. Nothing on this page is sample data.
          </p>
        </div>
        <TenantHackathonsPanel />
      </div>
    );
  }

  // ---- Create mode ---------------------------------------------------
  if (isCreate) {
    return (
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-5">
          <Link
            to="/admin/hackathons"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft className="w-3 h-3" />
            Back to hackathons
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Create Hackathon</h1>
          <p className="text-xs text-slate-500 mt-1">
            The event is created for <strong className="text-slate-700">{tenant?.name || 'this college'}</strong>{' '}
            as <strong className="text-slate-700">Draft</strong> and owned by your account. Tenant and owner
            are set by the database, never by this form.
          </p>
        </div>

        {!isConfigured ? (
          <div className={errorClasses}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Supabase is not configured, so a hackathon cannot be created.</span>
          </div>
        ) : !canManage ? (
          <ReadOnlyNotice role={role} />
        ) : (
          <HackathonForm
            mode="create"
            initialValues={emptyHackathonFormValues()}
            isSubmitting={isSubmitting}
            submitError={submitError}
            submitLabel="Create hackathon"
            onSubmit={(values) => void handleCreate(values)}
            onCancel={() => navigate('/admin/hackathons')}
          />
        )}
      </div>
    );
  }

  // ---- Detail / edit mode --------------------------------------------
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <Link
          to="/admin/hackathons"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="w-3 h-3" />
          Back to hackathons
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">
          {hackathon?.title ?? 'Hackathon'}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Details, editable configuration and the lifecycle control for this event.
        </p>
      </div>

      {activeNotice && (
        <div className={noticeClasses}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="break-words">{activeNotice}</span>
        </div>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-5 text-xs text-slate-500">
            <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            Loading this hackathon from Supabase…
          </CardContent>
        </Card>
      ) : loadError || !hackathon ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className={errorClasses}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="break-words">
                {loadError ?? 'That hackathon could not be found for this tenant.'}
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={() => void loadHackathon()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-sm truncate">{hackathon.title}</CardTitle>
                  <p className="text-[11px] text-slate-400 font-mono mt-1 truncate">{hackathon.slug}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={statusBadgeVariant(hackathon.status)}>
                    {HACKATHON_STATUS_LABELS[hackathon.status]}
                  </Badge>
                  <Badge variant="outline">{HACKATHON_VISIBILITY_LABELS[hackathon.visibility]}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {hackathon.tagline && <p className="text-xs text-slate-700">{hackathon.tagline}</p>}
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Registration opens</dt>
                  <dd className="text-slate-700">{formatDateTime(hackathon.registration_opens)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Registration closes</dt>
                  <dd className="text-slate-700">{formatDateTime(hackathon.registration_closes)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Hackathon starts</dt>
                  <dd className="text-slate-700">{formatDateTime(hackathon.hacking_starts)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Hackathon ends</dt>
                  <dd className="text-slate-700">{formatDateTime(hackathon.hacking_ends)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Results announced</dt>
                  <dd className="text-slate-700">{formatDateTime(hackathon.results_announced_at)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Team size</dt>
                  <dd className="text-slate-700">
                    {hackathon.min_team_size}–{hackathon.max_team_size}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Created</dt>
                  <dd className="text-slate-700">{formatDateTime(hackathon.created_at)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Last updated</dt>
                  <dd className="text-slate-700">{formatDateTime(hackathon.updated_at)}</dd>
                </div>
                <div className="flex justify-between gap-3 min-w-0">
                  <dt className="text-slate-400">Tenant</dt>
                  <dd className="text-slate-700 truncate" title={hackathon.tenant_id}>
                    {tenant?.name ?? hackathon.tenant_id}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 min-w-0">
                  <dt className="text-slate-400">Created by</dt>
                  <dd className="text-slate-700 font-mono truncate" title={hackathon.created_by ?? ''}>
                    {hackathon.created_by ?? '—'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-indigo-600" />
                Lifecycle status
              </CardTitle>
              <p className="text-[11px] text-slate-500 mt-1">
                The database state machine only accepts the next phase in order. Every attempt passes
                through the Phase 2A trigger, so an invalid jump is rejected instead of applied.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                {HACKATHON_LIFECYCLE.map((phase, index) => (
                  <span key={phase} className="flex items-center gap-1">
                    <span
                      className={
                        phase === hackathon.status ? 'font-semibold text-indigo-700' : 'text-slate-400'
                      }
                    >
                      {HACKATHON_STATUS_LABELS[phase]}
                    </span>
                    {index < HACKATHON_LIFECYCLE.length - 1 && (
                      <span className="text-slate-300">→</span>
                    )}
                  </span>
                ))}
              </div>

              {!canManage ? (
                <p className="text-[11px] text-slate-500">
                  Only a college admin can change the lifecycle status.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <Select
                      label="Set status to"
                      value={statusValue}
                      helperText={
                        nextStatus
                          ? `Valid next phase: ${HACKATHON_STATUS_LABELS[nextStatus]}`
                          : 'Archived is the final phase.'
                      }
                      onChange={(event) => setStatusValue(event.target.value as HackathonStatus)}
                    >
                      {HACKATHON_LIFECYCLE.map((phase) => (
                        <option key={phase} value={phase}>
                          {HACKATHON_STATUS_LABELS[phase]}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="outline"
                      onClick={() => void handleStatusChange()}
                      isLoading={isStatusSubmitting}
                      disabled={isStatusSubmitting || statusValue === hackathon.status}
                    >
                      Apply status
                    </Button>
                    {nextStatus && (
                      <Button
                        onClick={() => void handleStatusChange(nextStatus)}
                        disabled={isStatusSubmitting}
                      >
                        <ArrowRight className="w-3 h-3" />
                        Advance to {HACKATHON_STATUS_LABELS[nextStatus]}
                      </Button>
                    )}
                  </div>

                  {statusValue !== hackathon.status &&
                    !isValidHackathonTransition(hackathon.status, statusValue) && (
                      <p className="text-[11px] text-amber-700">
                        That is not a valid transition — the database will reject it and report the
                        next allowed phase.
                      </p>
                    )}

                  {statusError && (
                    <div className={errorClasses}>
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span className="break-words">{statusError}</span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {canManage ? (
            <HackathonForm
              key={`${hackathon.id}:${hackathon.updated_at}`}
              mode="edit"
              initialValues={hackathonToFormValues(hackathon)}
              isSubmitting={isSubmitting}
              submitError={submitError}
              submitLabel="Save changes"
              onSubmit={(values) => void handleUpdate(values)}
              onCancel={() => navigate('/admin/hackathons')}
            />
          ) : (
            <ReadOnlyNotice role={role} />
          )}
        </>
      )}
    </div>
  );
};