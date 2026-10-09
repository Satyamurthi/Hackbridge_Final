import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Database, Inbox, Pencil, Plus, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge, type BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  HACKATHONS_MIGRATION_FILE,
  HACKATHON_NEXT_STATUS,
  HACKATHON_STATUS_LABELS,
  canManageHackathons,
  fetchTenantHackathons,
  type HackathonErrorKind,
} from '../../lib/hackathons';
import { HACKATHON_VISIBILITY_LABELS } from '../../lib/hackathonForm';
import type { Hackathon, HackathonStatus } from '../../types/database';

/**
 * Phase 2B — the real hackathon management list.
 *
 * The panel is the only real-data surface in the admin console: it reads
 * `public.hackathons` for the caller's resolved tenant and renders the true
 * state of the table (loading, empty, permission, missing-table or rows) so
 * real database data can never be mistaken for the representative sample data
 * used by the remaining dashboard shells. Creating and editing happen on the
 * dedicated /admin/hackathons routes.
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

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/** Compact timeline view: first scheduled start → last scheduled end. */
const timelineSummary = (hackathon: Hackathon): string => {
  const start =
    hackathon.problem_submission_opens ?? hackathon.registration_opens ?? hackathon.hacking_starts;
  const end =
    hackathon.results_announced_at ?? hackathon.evaluation_ends ?? hackathon.hacking_ends;

  if (!start && !end) return 'Timeline not scheduled yet';
  return `${formatDate(start)} → ${formatDate(end)}`;
};

/** Registration window from the Phase 2A columns. */
const registrationWindow = (hackathon: Hackathon): string =>
  hackathon.registration_opens || hackathon.registration_closes
    ? `${formatDate(hackathon.registration_opens)} → ${formatDate(hackathon.registration_closes)}`
    : 'Not scheduled';

/** Event window (hacking_starts → hacking_ends). */
const eventWindow = (hackathon: Hackathon): string =>
  hackathon.hacking_starts || hackathon.hacking_ends
    ? `${formatDate(hackathon.hacking_starts)} → ${formatDate(hackathon.hacking_ends)}`
    : 'Not scheduled';

const PanelError: React.FC<{ message: string; errorKind: HackathonErrorKind | null }> = ({
  message,
  errorKind,
}) => (
  <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800">
    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
    <div className="space-y-1 min-w-0">
      <p className="font-semibold">Hackathons could not be read from the database.</p>
      <p className="break-words">{message}</p>
      {errorKind === 'missing_table' && (
        <p>
          Run <code className="font-mono">{HACKATHONS_MIGRATION_FILE}</code> in the Supabase SQL Editor,
          then select Refresh.
        </p>
      )}
      {errorKind === 'permission' && (
        <p>Only members of the owning tenant are allowed to read its hackathons.</p>
      )}
    </div>
  </div>
);

const PanelEmptyState: React.FC<{
  tenantName: string | null;
  canManage: boolean;
  onCreate: () => void;
}> = ({ tenantName, canManage, onCreate }) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center space-y-2">
    <Inbox className="w-6 h-6 text-slate-400 mx-auto" />
    <p className="text-xs font-semibold text-slate-700">
      No hackathons yet{tenantName ? ` for ${tenantName}` : ''}.
    </p>
    <p className="text-[11px] text-slate-500">
      This is a real, empty result from <code className="font-mono">public.hackathons</code> — not sample
      data.
    </p>
    {canManage ? (
      <div className="pt-1">
        <Button size="sm" onClick={onCreate}>
          <Plus className="w-3 h-3" />
          Create Hackathon
        </Button>
      </div>
    ) : (
      <p className="text-[11px] text-slate-500">
        Only a college admin of this tenant can create one.
      </p>
    )}
  </div>
);

const HackathonRow: React.FC<{ hackathon: Hackathon; canManage: boolean }> = ({
  hackathon,
  canManage,
}) => {
  const nextStatus = HACKATHON_NEXT_STATUS[hackathon.status];

  return (
    <div className="rounded-lg border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold text-slate-800 truncate">{hackathon.title}</p>
          <Badge variant={statusBadgeVariant(hackathon.status)}>
            {HACKATHON_STATUS_LABELS[hackathon.status]}
          </Badge>
          <Badge variant="outline">{HACKATHON_VISIBILITY_LABELS[hackathon.visibility]}</Badge>
        </div>
        <p className="text-[11px] text-slate-400 font-mono truncate">{hackathon.slug}</p>
        <p className="text-[11px] text-slate-500">
          Registration: {registrationWindow(hackathon)} · Event: {eventWindow(hackathon)}
        </p>
        <p className="text-[11px] text-slate-500">
          Teams {hackathon.min_team_size}–{hackathon.max_team_size} · {timelineSummary(hackathon)} ·
          created {formatDate(hackathon.created_at)}
        </p>
      </div>
      <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
        <p className="text-[11px] text-slate-500 sm:whitespace-nowrap">
          {nextStatus
            ? `Next phase: ${HACKATHON_STATUS_LABELS[nextStatus]}`
            : 'Lifecycle complete (archived)'}
        </p>
        <Link
          to={`/admin/hackathons/${hackathon.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Pencil className="w-3 h-3" />
          {canManage ? 'View / Edit' : 'View'}
        </Link>
      </div>
    </div>
  );
};

export const TenantHackathonsPanel: React.FC = () => {
  const { tenant, tenantId, role, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<HackathonErrorKind | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Mirrors the Phase 2A RLS write policies; the database still enforces them.
  const canManage = canManageHackathons(role);

  const load = useCallback(async () => {
    if (!isConfigured) {
      setHackathons([]);
      setError(null);
      setErrorKind(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const result = await fetchTenantHackathons(tenantId);
    setHackathons(result.hackathons);
    setError(result.error);
    setErrorKind(result.errorKind);
    setIsLoading(false);
  }, [isConfigured, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const goToCreate = (): void => {
    navigate('/admin/hackathons/new');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              Hackathons — live from the database
            </CardTitle>
            <p className="text-[11px] text-slate-500 mt-1">
              Read from <code className="font-mono">public.hackathons</code> for{' '}
              <strong className="text-slate-700">{tenant?.name || 'the resolved tenant'}</strong>. Row Level
              Security guarantees that only this tenant&apos;s events can ever be returned.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="success">Real database data</Badge>
            <Button size="sm" variant="outline" onClick={() => void load()} isLoading={isLoading}>
              <RefreshCw className="w-3 h-3" />
              Refresh
            </Button>
            {canManage && (
              <Button size="sm" onClick={goToCreate} disabled={!isConfigured}>
                <Plus className="w-3 h-3" />
                Create Hackathon
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!isConfigured ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Supabase is not configured, so the live hackathon table cannot be read. The labelled sample
              sections below are unaffected.
            </span>
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            Reading hackathons from Supabase…
          </div>
        ) : error ? (
          <PanelError message={error} errorKind={errorKind} />
        ) : hackathons.length === 0 ? (
          <PanelEmptyState tenantName={tenant?.name ?? null} canManage={canManage} onCreate={goToCreate} />
        ) : (
          <div className="space-y-2">
            {hackathons.map((hackathon) => (
              <HackathonRow key={hackathon.id} hackathon={hackathon} canManage={canManage} />
            ))}
          </div>
        )}

        {isConfigured && !isLoading && !error && !canManage && (
          <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Read-only: only a college admin of this tenant can create or edit hackathons.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};