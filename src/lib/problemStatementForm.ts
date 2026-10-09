/**
 * Phase 3A — Problem Statement form model.
 *
 * Mirrors the pattern established in hackathonForm.ts and companyForm.ts:
 * - emptyProblemStatementFormValues() — typed defaults
 * - validateProblemStatementForm()   — client-side validation rules
 * - toProblemStatementInsertPayload() — form values → DB INSERT payload
 * - toProblemStatementEditPayload()   — form values → DB UPDATE payload
 */

import type {
  ProblemStatementDifficulty,
  HiringPotential,
  ProblemStatementInsertPayload,
  ProblemStatementEditPayload,
  ProblemStatement,
} from '../types/database';

// ---------------------------------------------------------------------------
// Form values type
// ---------------------------------------------------------------------------

export interface ProblemStatementFormValues {
  // Section A — Identity
  title: string;
  domain: string;
  difficulty: ProblemStatementDifficulty;

  // Section B — Problem content
  problem_description: string;
  expected_outcome: string;
  constraints: string;

  // Section C — Dataset info (file attachments deferred to later phase)
  datasets_provided: boolean;
  datasets_info: string;

  // Section D — Technical & evaluation
  tech_preferences: string;   // comma-separated input, split on save
  evaluation_criteria: string;

  // Section E — Hiring intent
  hiring_potential: HiringPotential | '';
  open_positions: string;        // string in form, parsed to number on save
  position_description: string;
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export function emptyProblemStatementFormValues(): ProblemStatementFormValues {
  return {
    title: '',
    domain: '',
    difficulty: 'medium',
    problem_description: '',
    expected_outcome: '',
    constraints: '',
    datasets_provided: false,
    datasets_info: '',
    tech_preferences: '',
    evaluation_criteria: '',
    hiring_potential: '',
    open_positions: '0',
    position_description: '',
  };
}

/** Populate form values from an existing DB row (for edit mode). */
export function fromProblemStatement(ps: ProblemStatement): ProblemStatementFormValues {
  return {
    title: ps.title,
    domain: ps.domain ?? '',
    difficulty: ps.difficulty,
    problem_description: ps.problem_description,
    expected_outcome: ps.expected_outcome ?? '',
    constraints: ps.constraints ?? '',
    datasets_provided: ps.datasets_provided,
    datasets_info: ps.datasets_info ?? '',
    tech_preferences: (ps.tech_preferences ?? []).join(', '),
    evaluation_criteria: ps.evaluation_criteria ?? '',
    hiring_potential: (ps.hiring_potential as HiringPotential) ?? '',
    open_positions: String(ps.open_positions ?? 0),
    position_description: ps.position_description ?? '',
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ProblemStatementValidationErrors {
  title?: string;
  problem_description?: string;
  open_positions?: string;
  hiring_potential?: string;
}

export function validateProblemStatementForm(
  values: ProblemStatementFormValues,
): ProblemStatementValidationErrors {
  const errors: ProblemStatementValidationErrors = {};

  if (!values.title.trim()) {
    errors.title = 'Problem statement title is required.';
  } else if (values.title.trim().length < 10) {
    errors.title = 'Title must be at least 10 characters.';
  } else if (values.title.length > 500) {
    errors.title = 'Title must be 500 characters or fewer.';
  }

  if (!values.problem_description.trim()) {
    errors.problem_description = 'Problem description is required.';
  } else if (values.problem_description.trim().length < 50) {
    errors.problem_description = 'Description must be at least 50 characters.';
  }

  const openPositions = parseInt(values.open_positions, 10);
  if (values.open_positions !== '' && (isNaN(openPositions) || openPositions < 0)) {
    errors.open_positions = 'Open positions must be a non-negative number.';
  }

  return errors;
}

export function hasProblemStatementErrors(
  errors: ProblemStatementValidationErrors,
): boolean {
  return Object.values(errors).some(Boolean);
}

// ---------------------------------------------------------------------------
// Payload mapping (form → database)
// ---------------------------------------------------------------------------

/** Parse the comma-separated tech preferences string into a clean array. */
function parseTechPreferences(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Map form values to a ProblemStatementInsertPayload.
 * Caller supplies hackathon_id and company_id from real DB rows.
 */
export function toProblemStatementInsertPayload(
  values: ProblemStatementFormValues,
  hackathonId: string,
  companyId: string,
): ProblemStatementInsertPayload {
  return {
    hackathon_id: hackathonId,
    company_id: companyId,
    title: values.title.trim(),
    domain: values.domain.trim() || undefined as any,
    difficulty: values.difficulty,
    problem_description: values.problem_description.trim(),
    expected_outcome: values.expected_outcome.trim() || undefined as any,
    constraints: values.constraints.trim() || undefined as any,
    datasets_provided: values.datasets_provided,
    datasets_info: values.datasets_info.trim() || undefined as any,
    tech_preferences: parseTechPreferences(values.tech_preferences),
    evaluation_criteria: values.evaluation_criteria.trim() || undefined as any,
    hiring_potential: (values.hiring_potential || null) as HiringPotential | null,
    open_positions: parseInt(values.open_positions, 10) || 0,
    position_description: values.position_description.trim() || undefined as any,
  };
}

/**
 * Map form values to a ProblemStatementEditPayload (never includes
 * status, submitted_by, hackathon_id, or company_id).
 */
export function toProblemStatementEditPayload(
  values: ProblemStatementFormValues,
): ProblemStatementEditPayload {
  return {
    title: values.title.trim(),
    domain: values.domain.trim() || undefined,
    difficulty: values.difficulty,
    problem_description: values.problem_description.trim(),
    expected_outcome: values.expected_outcome.trim() || undefined,
    constraints: values.constraints.trim() || undefined,
    datasets_provided: values.datasets_provided,
    datasets_info: values.datasets_info.trim() || undefined,
    tech_preferences: parseTechPreferences(values.tech_preferences),
    evaluation_criteria: values.evaluation_criteria.trim() || undefined,
    hiring_potential: (values.hiring_potential || null) as HiringPotential | null,
    open_positions: parseInt(values.open_positions, 10) || 0,
    position_description: values.position_description.trim() || undefined,
  };
}
