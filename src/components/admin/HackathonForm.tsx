import React, { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Trash2, Wand2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import type { HackathonVisibility } from '../../types/database';
import {
  HACKATHON_TIMELINE_FIELDS,
  HACKATHON_VISIBILITY_OPTIONS,
  emptyEvaluationRound,
  emptyPrize,
  emptyRubricCriterion,
  hasHackathonFormErrors,
  suggestSlugFromTitle,
  validateHackathonForm,
  type HackathonFormValues,
} from '../../lib/hackathonForm';
import { STORAGE_BUCKETS } from '../../lib/storage';
import { FileUploadDropzone } from '../ui/FileUploadDropzone';

/**
 * Phase 2B — create/edit form for `public.hackathons`.
 *
 * Sections are grouped (A–F) so the admin never faces one unstructured wall of
 * fields. The component is presentation + client-side validation only: the
 * caller performs the Supabase write, and the Phase 2A database rules
 * (RLS, unique slug, lifecycle trigger) stay the final authority.
 */

interface HackathonFormProps {
  mode: 'create' | 'edit';
  initialValues: HackathonFormValues;
  isSubmitting: boolean;
  submitError: string | null;
  submitLabel: string;
  /** Non-error information, e.g. the slug was adjusted to stay unique. */
  notice?: string | null;
  onSubmit: (values: HackathonFormValues) => void;
  onCancel: () => void;
}

const Section: React.FC<{
  step: string;
  title: string;
  description: string;
  children: React.ReactNode;
}> = ({ step, title, description, children }) => (
  <Card>
    <CardHeader>
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[11px] font-bold text-indigo-700">
          {step}
        </span>
        <div>
          <CardTitle className="text-sm">{title}</CardTitle>
          <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>
);

const Toggle: React.FC<{
  label: string;
  helper: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, helper, checked, onChange }) => (
  <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
    <input
      type="checkbox"
      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
    <span>
      <span className="block text-xs font-semibold text-slate-700">{label}</span>
      <span className="block text-[11px] text-slate-500">{helper}</span>
    </span>
  </label>
);

const RowShell: React.FC<{ children: React.ReactNode; onRemove: () => void }> = ({
  children,
  onRemove,
}) => (
  <div className="rounded-lg border border-slate-200 p-3 space-y-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    <div className="flex justify-end">
      <Button type="button" size="sm" variant="ghost" onClick={onRemove} className="text-rose-600">
        <Trash2 className="w-3 h-3" />
        Remove
      </Button>
    </div>
  </div>
);

const AddRowButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <Button type="button" size="sm" variant="outline" onClick={onClick}>
    <Plus className="w-3 h-3" />
    {label}
  </Button>
);

const RoundsEditor: React.FC<{
  rounds: HackathonFormValues['evaluation_rounds'];
  onChange: (rounds: HackathonFormValues['evaluation_rounds']) => void;
}> = ({ rounds, onChange }) => (
  <div className="space-y-3">
    {rounds.length === 0 && (
      <p className="text-[11px] text-slate-500">
        No evaluation rounds yet. Rounds are stored in{' '}
        <code className="font-mono">evaluation_rounds</code>.
      </p>
    )}
    {rounds.map((round, index) => (
      <RowShell
        key={`round-${index}`}
        onRemove={() => onChange(rounds.filter((_, position) => position !== index))}
      >
        <Input
          label="Round number"
          type="number"
          min={1}
          value={round.round === undefined ? '' : String(round.round)}
          onChange={(event) =>
            onChange(
              rounds.map((item, position) =>
                position === index ? { ...item, round: Number(event.target.value) } : item
              )
            )
          }
        />
        <Input
          label="Round name"
          value={round.name ?? ''}
          placeholder="Internal Review"
          onChange={(event) =>
            onChange(
              rounds.map((item, position) =>
                position === index ? { ...item, name: event.target.value } : item
              )
            )
          }
        />
        <Input
          label="Evaluators per team"
          type="number"
          min={1}
          value={round.evaluators_per_team === undefined ? '' : String(round.evaluators_per_team)}
          helperText="Optional"
          onChange={(event) =>
            onChange(
              rounds.map((item, position) =>
                position === index
                  ? { ...item, evaluators_per_team: Number(event.target.value) }
                  : item
              )
            )
          }
        />
      </RowShell>
    ))}
    <AddRowButton
      label="Add evaluation round"
      onClick={() => onChange([...rounds, emptyEvaluationRound(rounds.length + 1)])}
    />
  </div>
);

const RubricEditor: React.FC<{
  criteria: HackathonFormValues['evaluation_rubric'];
  error?: string;
  onChange: (criteria: HackathonFormValues['evaluation_rubric']) => void;
}> = ({ criteria, error, onChange }) => (
  <div className="space-y-3">
    {criteria.length === 0 && (
      <p className="text-[11px] text-slate-500">
        No rubric criteria yet. Criteria are stored in{' '}
        <code className="font-mono">evaluation_rubric</code> and are consumed by the evaluation
        phase.
      </p>
    )}
    {criteria.map((criterion, index) => (
      <RowShell
        key={`criterion-${index}`}
        onRemove={() => onChange(criteria.filter((_, position) => position !== index))}
      >
        <Input
          label="Criterion"
          value={criterion.criterion ?? ''}
          placeholder="Innovation"
          onChange={(event) =>
            onChange(
              criteria.map((item, position) =>
                position === index ? { ...item, criterion: event.target.value } : item
              )
            )
          }
        />
        <Input
          label="Weight (%)"
          type="number"
          min={1}
          value={criterion.weight === undefined ? '' : String(criterion.weight)}
          onChange={(event) =>
            onChange(
              criteria.map((item, position) =>
                position === index ? { ...item, weight: Number(event.target.value) } : item
              )
            )
          }
        />
        <Input
          label="Maximum score"
          type="number"
          min={1}
          value={criterion.max_score === undefined ? '' : String(criterion.max_score)}
          helperText="Optional"
          onChange={(event) =>
            onChange(
              criteria.map((item, position) =>
                position === index ? { ...item, max_score: Number(event.target.value) } : item
              )
            )
          }
        />
        <Input
          label="Description"
          value={criterion.description ?? ''}
          placeholder="How originality is judged"
          helperText="Optional"
          onChange={(event) =>
            onChange(
              criteria.map((item, position) =>
                position === index ? { ...item, description: event.target.value } : item
              )
            )
          }
        />
      </RowShell>
    ))}
    {error && <p className="text-[11px] text-rose-600">{error}</p>}
    <AddRowButton
      label="Add rubric criterion"
      onClick={() => onChange([...criteria, emptyRubricCriterion()])}
    />
  </div>
);

const PrizesEditor: React.FC<{
  prizes: HackathonFormValues['prizes'];
  error?: string;
  onChange: (prizes: HackathonFormValues['prizes']) => void;
}> = ({ prizes, error, onChange }) => (
  <div className="space-y-3">
    {prizes.length === 0 && (
      <p className="text-[11px] text-slate-500">
        No prizes yet. Prizes are stored in <code className="font-mono">prizes</code>.
      </p>
    )}
    {prizes.map((prize, index) => (
      <RowShell
        key={`prize-${index}`}
        onRemove={() => onChange(prizes.filter((_, position) => position !== index))}
      >
        <Input
          label="Rank"
          type="number"
          min={1}
          value={prize.rank === undefined ? '' : String(prize.rank)}
          onChange={(event) =>
            onChange(
              prizes.map((item, position) =>
                position === index ? { ...item, rank: Number(event.target.value) } : item
              )
            )
          }
        />
        <Input
          label="Amount"
          type="number"
          min={0}
          value={prize.amount === undefined ? '' : String(prize.amount)}
          helperText="Optional"
          onChange={(event) =>
            onChange(
              prizes.map((item, position) =>
                position === index ? { ...item, amount: Number(event.target.value) } : item
              )
            )
          }
        />
        <Input
          label="Description"
          value={prize.description ?? ''}
          placeholder="Cash + Internship"
          helperText="Optional"
          onChange={(event) =>
            onChange(
              prizes.map((item, position) =>
                position === index ? { ...item, description: event.target.value } : item
              )
            )
          }
        />
      </RowShell>
    ))}
    {error && <p className="text-[11px] text-rose-600">{error}</p>}
    <AddRowButton
      label="Add prize"
      onClick={() => onChange([...prizes, emptyPrize(prizes.length + 1)])}
    />
  </div>
);

export const HackathonForm: React.FC<HackathonFormProps> = ({
  mode,
  initialValues,
  isSubmitting,
  submitError,
  submitLabel,
  notice,
  onSubmit,
  onCancel,
}) => {
  const [values, setValues] = useState<HackathonFormValues>(initialValues);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<boolean>(false);
  // In edit mode the slug is never regenerated automatically.
  const [slugManuallyEdited, setSlugManuallyEdited] = useState<boolean>(mode === 'edit');

  const validationErrors = useMemo(() => validateHackathonForm(values), [values]);

  const visibleError = (key: keyof HackathonFormValues): string | undefined =>
    submitted || touched[key] ? validationErrors[key] : undefined;

  const setField = <K extends keyof HackathonFormValues>(
    key: K,
    value: HackathonFormValues[K]
  ): void => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const markTouched = (key: keyof HackathonFormValues): void =>
    setTouched((current) => (current[key] ? current : { ...current, [key]: true }));

  const handleTitleChange = (title: string): void => {
    setValues((current) => ({
      ...current,
      title,
      ...(slugManuallyEdited ? {} : { slug: suggestSlugFromTitle(title) }),
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSubmitted(true);
    if (isSubmitting || hasHackathonFormErrors(validationErrors)) return;
    onSubmit(values);
  };

  const invalidFieldCount = Object.keys(validationErrors).length;

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      {notice && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
          {notice}
        </div>
      )}

      {submitError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="min-w-0 break-words">{submitError}</span>
        </div>
      )}

      <Section
        step="A"
        title="Basic Information"
        description="Identity and description of the event."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Title *"
            value={values.title}
            placeholder="MITT Innovate 2026"
            error={visibleError('title')}
            onChange={(event) => handleTitleChange(event.target.value)}
            onBlur={() => markTouched('title')}
          />
          <div className="flex items-end gap-2">
            <Input
              label="Slug *"
              value={values.slug}
              placeholder="mitt-innovate-2026"
              helperText="Lower-case letters, numbers and single hyphens. Unique per college."
              error={visibleError('slug')}
              onChange={(event) => {
                setSlugManuallyEdited(true);
                setField('slug', event.target.value);
              }}
              onBlur={() => markTouched('slug')}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mb-5 flex-shrink-0"
              onClick={() => {
                setSlugManuallyEdited(false);
                setField('slug', suggestSlugFromTitle(values.title));
              }}
            >
              <Wand2 className="w-3 h-3" />
              From title
            </Button>
          </div>
          <div className="md:col-span-2">
            <Input
              label="Short description (tagline)"
              value={values.tagline}
              placeholder="36 hours of building for Karnataka's engineering talent"
              helperText="Stored in public.hackathons.tagline."
              onChange={(event) => setField('tagline', event.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              label="Full description"
              value={values.description}
              rows={5}
              placeholder="What the hackathon is about, who should join and what they will build."
              onChange={(event) => setField('description', event.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-3">
            <FileUploadDropzone
              bucket={STORAGE_BUCKETS.BANNERS}
              pathPrefix={values.slug || 'hackathons'}
              label="Hackathon Banner Image"
              currentUrl={values.banner_url}
              onUploadComplete={(res) => setField('banner_url', res.url)}
              onRemove={() => setField('banner_url', '')}
              helperText="Upload a high-resolution banner image (PNG, JPG, WEBP up to 5MB) or enter an external URL below."
            />
            <Input
              label="Or specify Banner image URL directly"
              type="url"
              value={values.banner_url}
              placeholder="https://images.example.com/banner.jpg"
              error={visibleError('banner_url')}
              onChange={(event) => setField('banner_url', event.target.value)}
              onBlur={() => markTouched('banner_url')}
            />
          </div>
        </div>
      </Section>

      <Section
        step="B"
        title="Schedule"
        description="Every lifecycle phase. Leave a field empty while a date is undecided — the database stores NULL."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HACKATHON_TIMELINE_FIELDS.map(({ field, label, helper }) => (
            <Input
              key={field}
              label={label}
              type="datetime-local"
              value={values[field]}
              helperText={helper}
              error={visibleError(field)}
              onChange={(event) => setField(field, event.target.value)}
              onBlur={() => markTouched(field)}
            />
          ))}
        </div>
        <p className="text-[11px] text-slate-500">
          Times are entered and shown in your local timezone and stored as an absolute instant, so
          they never shift when the page is reloaded.
        </p>
      </Section>

      <Section
        step="C"
        title="Participation"
        description="Team-formation rules for this event. Later phases enforce them."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Minimum team size"
            type="number"
            min={1}
            value={values.min_team_size}
            error={visibleError('min_team_size')}
            onChange={(event) => setField('min_team_size', event.target.value)}
            onBlur={() => markTouched('min_team_size')}
          />
          <Input
            label="Maximum team size"
            type="number"
            min={1}
            value={values.max_team_size}
            error={visibleError('max_team_size')}
            onChange={(event) => setField('max_team_size', event.target.value)}
            onBlur={() => markTouched('max_team_size')}
          />
          <Input
            label="Maximum teams per problem"
            type="number"
            min={1}
            value={values.max_teams_per_problem}
            error={visibleError('max_teams_per_problem')}
            onChange={(event) => setField('max_teams_per_problem', event.target.value)}
            onBlur={() => markTouched('max_teams_per_problem')}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Toggle
            label="Allow solo participants"
            helper="A single student may compete without a team."
            checked={values.allow_solo}
            onChange={(checked) => setField('allow_solo', checked)}
          />
          <Toggle
            label="Require a college email address"
            helper="Only verified college email addresses may register."
            checked={values.require_college_email}
            onChange={(checked) => setField('require_college_email', checked)}
          />
        </div>
      </Section>

      <Section
        step="D"
        title="Rules & Evaluation"
        description="Evaluation rounds and the scoring rubric, stored as structured JSONB for the evaluation phase."
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">Evaluation rounds</p>
          <RoundsEditor
            rounds={values.evaluation_rounds}
            onChange={(rounds) => setField('evaluation_rounds', rounds)}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">Scoring rubric</p>
          <RubricEditor
            criteria={values.evaluation_rubric}
            error={visibleError('evaluation_rubric')}
            onChange={(criteria) => setField('evaluation_rubric', criteria)}
          />
        </div>
      </Section>

      <Section
        step="E"
        title="Prizes"
        description="Prize tiers, stored in the prizes JSONB column. Purely descriptive for now."
      >
        <PrizesEditor
          prizes={values.prizes}
          error={visibleError('prizes')}
          onChange={(prizes) => setField('prizes', prizes)}
        />
      </Section>

      <Section
        step="F"
        title="Publishing"
        description="Visibility and the initial lifecycle phase."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Visibility"
            value={values.visibility}
            error={visibleError('visibility')}
            helperText={
              HACKATHON_VISIBILITY_OPTIONS.find((option) => option.value === values.visibility)
                ?.helper
            }
            onChange={(event) => setField('visibility', event.target.value as HackathonVisibility)}
          >
            {HACKATHON_VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">Lifecycle status</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {mode === 'create'
                ? 'New hackathons are always created as Draft — the database default, matching HackBridge.pdf.'
                : 'The status is changed with the lifecycle control on the detail view, so every change passes through the database state machine.'}
            </p>
          </div>
        </div>
      </Section>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] text-slate-500">
          {invalidFieldCount === 0
            ? 'Required fields look valid — the database remains the final authority.'
            : `${invalidFieldCount} field${invalidFieldCount === 1 ? '' : 's'} need attention.`}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
};