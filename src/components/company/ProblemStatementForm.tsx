import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import {
  type ProblemStatementFormValues,
  type ProblemStatementValidationErrors,
  validateProblemStatementForm,
  hasProblemStatementErrors,
} from '../../lib/problemStatementForm';
import type { Hackathon } from '../../types/database';

interface ProblemStatementFormProps {
  mode: 'create' | 'edit';
  initialValues: ProblemStatementFormValues;
  /** The hackathon this problem statement will belong to (shown as read-only context). */
  hackathon: Hackathon;
  isSubmitting: boolean;
  submitError: string | null;
  submitLabel?: string;
  onSubmit: (values: ProblemStatementFormValues) => Promise<void>;
  onCancel: () => void;
}

const sectionClasses = 'space-y-4 pt-5 border-t border-slate-100 first:border-0 first:pt-0';
const sectionTitleClasses = 'text-xs font-bold uppercase tracking-wider text-slate-400 mb-3';

export const ProblemStatementForm: React.FC<ProblemStatementFormProps> = ({
  mode,
  initialValues,
  hackathon,
  isSubmitting,
  submitError,
  submitLabel = mode === 'create' ? 'Submit Problem Statement' : 'Save Changes',
  onSubmit,
  onCancel,
}) => {
  const [values, setValues] = useState<ProblemStatementFormValues>(initialValues);
  const [errors, setErrors] = useState<ProblemStatementValidationErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof ProblemStatementFormValues, boolean>>>({});

  const set = <K extends keyof ProblemStatementFormValues>(
    key: K,
    value: ProblemStatementFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validateProblemStatementForm(values);
    setErrors(newErrors);
    if (hasProblemStatementErrors(newErrors)) return;
    await onSubmit(values);
  };

  const fieldError = (key: keyof ProblemStatementValidationErrors) =>
    touched[key] ? errors[key] : undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Context banner ──────────────────────────────────────── */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-[11px] text-indigo-800">
        <span className="font-semibold">Hackathon:</span> {hackathon.title}
        {hackathon.max_teams_per_problem > 0 && (
          <span className="ml-3 text-indigo-600">
            · Up to {hackathon.max_teams_per_problem} team{hackathon.max_teams_per_problem !== 1 ? 's' : ''} may work on this problem
          </span>
        )}
      </div>

      {/* ── Section A — Identity ─────────────────────────────────── */}
      <div className={sectionClasses}>
        <p className={sectionTitleClasses}>A — Problem Identity</p>

        <Input
          id="ps-title"
          label="Problem Title *"
          placeholder="e.g. Real-time Autonomous Traffic Signal Synchronization"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          error={fieldError('title')}
          disabled={isSubmitting}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="ps-domain"
            label="Domain"
            placeholder="e.g. Smart Cities, FinTech, HealthTech"
            value={values.domain}
            onChange={(e) => set('domain', e.target.value)}
            disabled={isSubmitting}
          />
          <Select
            id="ps-difficulty"
            label="Difficulty"
            value={values.difficulty}
            onChange={(e) => set('difficulty', e.target.value as any)}
            disabled={isSubmitting}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
        </div>
      </div>

      {/* ── Section B — Problem Content ──────────────────────────── */}
      <div className={sectionClasses}>
        <p className={sectionTitleClasses}>B — Problem Description</p>

        <Textarea
          id="ps-description"
          label="Problem Description *"
          placeholder="Describe the real-world problem, its current state, and why it matters. Be specific about the challenge."
          value={values.problem_description}
          onChange={(e) => set('problem_description', e.target.value)}
          error={fieldError('problem_description')}
          rows={6}
          disabled={isSubmitting}
        />

        <Textarea
          id="ps-outcome"
          label="Expected Outcome"
          placeholder="What does a successful solution look like? Describe measurable outcomes."
          value={values.expected_outcome}
          onChange={(e) => set('expected_outcome', e.target.value)}
          rows={3}
          disabled={isSubmitting}
        />

        <Textarea
          id="ps-constraints"
          label="Constraints"
          placeholder="Technical, time, resource or regulatory constraints the solution must respect."
          value={values.constraints}
          onChange={(e) => set('constraints', e.target.value)}
          rows={3}
          disabled={isSubmitting}
        />
      </div>

      {/* ── Section C — Dataset Info ─────────────────────────────── */}
      <div className={sectionClasses}>
        <p className={sectionTitleClasses}>C — Datasets</p>
        <p className="text-[11px] text-slate-500 -mt-2">
          Note: File attachments will be supported in a later phase. Describe dataset details as text for now.
        </p>

        <div className="flex items-center gap-3">
          <input
            id="ps-datasets-provided"
            type="checkbox"
            checked={values.datasets_provided}
            onChange={(e) => set('datasets_provided', e.target.checked)}
            disabled={isSubmitting}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="ps-datasets-provided" className="text-xs font-medium text-slate-700">
            Dataset(s) will be provided to participating teams
          </label>
        </div>

        {values.datasets_provided && (
          <Textarea
            id="ps-datasets-info"
            label="Dataset Description"
            placeholder="Describe the dataset(s): format, size, source, and how teams will access them."
            value={values.datasets_info}
            onChange={(e) => set('datasets_info', e.target.value)}
            rows={3}
            disabled={isSubmitting}
          />
        )}
      </div>

      {/* ── Section D — Technical & Evaluation ───────────────────── */}
      <div className={sectionClasses}>
        <p className={sectionTitleClasses}>D — Technical Preferences & Evaluation</p>

        <Input
          id="ps-tech-prefs"
          label="Preferred Technologies"
          placeholder="Python, TensorFlow, React, PostgreSQL (comma-separated)"
          value={values.tech_preferences}
          onChange={(e) => set('tech_preferences', e.target.value)}
          disabled={isSubmitting}
        />
        <p className="text-[11px] text-slate-400 -mt-2">
          These are preferences, not requirements. Teams may use any stack.
        </p>

        <Textarea
          id="ps-eval-criteria"
          label="Evaluation Criteria"
          placeholder="What specific aspects will you look for when judging submissions for this problem?"
          value={values.evaluation_criteria}
          onChange={(e) => set('evaluation_criteria', e.target.value)}
          rows={3}
          disabled={isSubmitting}
        />
      </div>

      {/* ── Section E — Hiring Intent ────────────────────────────── */}
      <div className={sectionClasses}>
        <p className={sectionTitleClasses}>E — Hiring Intent</p>
        <p className="text-[11px] text-slate-500 -mt-2">
          Optional. Helps attract motivated candidates and notifies top performers.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            id="ps-hiring-potential"
            label="Hiring Potential"
            value={values.hiring_potential}
            onChange={(e) => set('hiring_potential', e.target.value as any)}
            disabled={isSubmitting}
          >
            <option value="">Not specified</option>
            <option value="immediate_hire">Immediate Hire</option>
            <option value="internship">Internship</option>
            <option value="possible">Possible</option>
            <option value="none">None</option>
          </Select>

          <Input
            id="ps-open-positions"
            label="Open Positions"
            type="number"
            min="0"
            placeholder="0"
            value={values.open_positions}
            onChange={(e) => set('open_positions', e.target.value)}
            error={fieldError('open_positions')}
            disabled={isSubmitting}
          />
        </div>

        {(values.hiring_potential && values.hiring_potential !== 'none') && (
          <Textarea
            id="ps-position-desc"
            label="Position Description"
            placeholder="Role title, responsibilities, location, and compensation range."
            value={values.position_description}
            onChange={(e) => set('position_description', e.target.value)}
            rows={3}
            disabled={isSubmitting}
          />
        )}
      </div>

      {/* ── Error ───────────────────────────────────────────────── */}
      {submitError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="break-words">{submitError}</span>
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
        <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
