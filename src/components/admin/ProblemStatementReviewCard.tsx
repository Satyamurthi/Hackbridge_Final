import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Tag,
  XCircle,
  Zap,
} from 'lucide-react';
import { Badge, type BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import type { ProblemStatement, ProblemStatementStatus } from '../../types/database';
import {
  PROBLEM_STATEMENT_STATUS_LABELS,
  DIFFICULTY_LABELS,
  HIRING_POTENTIAL_LABELS,
  updateProblemStatementStatus,
} from '../../lib/problemStatements';

interface ProblemStatementReviewCardProps {
  statement: ProblemStatement;
  /** Company name resolved from company_id (passed by parent to avoid N+1 fetches). */
  companyName?: string;
  /** Hackathon title resolved from hackathon_id (passed by parent). */
  hackathonTitle?: string;
  canReview: boolean;
  onUpdated: (updated: ProblemStatement) => void;
}

const STATUS_BADGE_VARIANT: Record<ProblemStatementStatus, BadgeVariant> = {
  submitted: 'default',
  under_review: 'warning',
  approved: 'warning',
  rejected: 'danger',
  published: 'success',
};

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export const ProblemStatementReviewCard: React.FC<ProblemStatementReviewCardProps> = ({
  statement,
  companyName,
  hackathonTitle,
  canReview,
  onUpdated,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [reviewNotes, setReviewNotes] = useState(statement.review_notes ?? '');
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAction = async (newStatus: ProblemStatementStatus) => {
    setIsActing(true);
    setActionError(null);
    const result = await updateProblemStatementStatus(statement.id, {
      status: newStatus,
      review_notes: reviewNotes.trim() || null,
    });
    if (result.error || !result.problemStatement) {
      setActionError(result.error ?? 'Action failed.');
    } else {
      onUpdated(result.problemStatement);
    }
    setIsActing(false);
  };

  const canApprove =
    canReview &&
    (statement.status === 'submitted' ||
      statement.status === 'under_review');

  const canPublish =
    canReview && statement.status === 'approved';

  const canReject =
    canReview &&
    (statement.status === 'submitted' ||
      statement.status === 'under_review' ||
      statement.status === 'approved');

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header row ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_BADGE_VARIANT[statement.status]}>
              {PROBLEM_STATEMENT_STATUS_LABELS[statement.status]}
            </Badge>
            {statement.difficulty && (
              <Badge variant="outline">{DIFFICULTY_LABELS[statement.difficulty] ?? statement.difficulty}</Badge>
            )}
            {statement.domain && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                <Tag className="w-2.5 h-2.5" />
                {statement.domain}
              </span>
            )}
          </div>

          <h3 className="text-sm font-bold text-slate-900 leading-snug">
            {statement.title}
          </h3>

          <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
            {companyName && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {companyName}
              </span>
            )}
            {hackathonTitle && (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {hackathonTitle}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Submitted {formatDate(statement.created_at)}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-shrink-0 flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Collapse' : 'View Details'}
        </button>
      </div>

      {/* ── Expanded detail ─────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
          <div className="space-y-3 pt-4 text-xs text-slate-700">
            <div>
              <p className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-1">Problem Description</p>
              <p className="whitespace-pre-wrap">{statement.problem_description}</p>
            </div>

            {statement.expected_outcome && (
              <div>
                <p className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-1">Expected Outcome</p>
                <p className="whitespace-pre-wrap">{statement.expected_outcome}</p>
              </div>
            )}

            {statement.constraints && (
              <div>
                <p className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-1">Constraints</p>
                <p className="whitespace-pre-wrap">{statement.constraints}</p>
              </div>
            )}

            {statement.datasets_provided && statement.datasets_info && (
              <div>
                <p className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-1">Dataset Info</p>
                <p className="whitespace-pre-wrap">{statement.datasets_info}</p>
              </div>
            )}

            {statement.tech_preferences && statement.tech_preferences.length > 0 && (
              <div>
                <p className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-1">Preferred Technologies</p>
                <div className="flex flex-wrap gap-1.5">
                  {statement.tech_preferences.map((t) => (
                    <span key={t} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-medium">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {statement.evaluation_criteria && (
              <div>
                <p className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-1">Evaluation Criteria</p>
                <p className="whitespace-pre-wrap">{statement.evaluation_criteria}</p>
              </div>
            )}

            {statement.hiring_potential && statement.hiring_potential !== 'none' && (
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 space-y-1">
                <p className="font-semibold text-emerald-700 text-[10px] uppercase tracking-wider">Hiring Intent</p>
                <p className="text-emerald-800 font-medium">
                  {HIRING_POTENTIAL_LABELS[statement.hiring_potential] ?? statement.hiring_potential}
                  {statement.open_positions > 0 && ` · ${statement.open_positions} open position${statement.open_positions !== 1 ? 's' : ''}`}
                </p>
                {statement.position_description && (
                  <p className="text-emerald-700 text-[11px]">{statement.position_description}</p>
                )}
              </div>
            )}

            {statement.review_notes && statement.status === 'rejected' && (
              <div className="p-3 rounded-lg border border-rose-200 bg-rose-50">
                <p className="font-semibold text-rose-700 text-[10px] uppercase tracking-wider mb-1">Review Notes (Rejection Reason)</p>
                <p className="text-rose-800 whitespace-pre-wrap">{statement.review_notes}</p>
              </div>
            )}
          </div>

          {/* ── Review actions ──────────────────────────────────── */}
          {canReview && (canApprove || canPublish || canReject) && (
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <p className="text-[11px] font-semibold text-slate-600">Admin Review Actions</p>

              <Textarea
                id={`review-notes-${statement.id}`}
                label="Review Notes (optional — required for rejection)"
                placeholder="Provide feedback to the company, especially if rejecting."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={2}
                disabled={isActing}
              />

              <div className="flex flex-wrap items-center gap-2">
                {(canApprove) && (
                  <Button
                    size="sm"
                    onClick={() => handleAction('approved')}
                    isLoading={isActing}
                    disabled={isActing}
                    className="bg-amber-500 text-white hover:bg-amber-600"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Approve
                  </Button>
                )}

                {canPublish && (
                  <Button
                    size="sm"
                    onClick={() => handleAction('published')}
                    isLoading={isActing}
                    disabled={isActing}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Approve &amp; Publish
                  </Button>
                )}

                {canReject && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction('rejected')}
                    isLoading={isActing}
                    disabled={isActing}
                    className="text-rose-600 hover:bg-rose-50 border-rose-300"
                  >
                    <XCircle className="w-3 h-3" />
                    Reject
                  </Button>
                )}

                {!canReview && (
                  <p className="text-[11px] text-slate-500">
                    Only a college admin or committee member can review problem statements.
                  </p>
                )}
              </div>

              {actionError && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="break-words">{actionError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
