import {
  HACKATHON_SLUG_MAX_LENGTH,
  isValidHackathonSlug,
  slugifyHackathonTitle,
} from './hackathons';
import type {
  EvaluationRound,
  EvaluationRubricCriterion,
  Hackathon,
  HackathonPrize,
  HackathonVisibility,
  HackathonWritableFields,
} from '../types/database';

/**
 * Phase 2B — form model for creating and editing a hackathon.
 *
 * Every field maps 1:1 to a real column of `public.hackathons` (Phase 2A).
 * The security columns (id, tenant_id, created_by, created_at, updated_at) and
 * `status` are deliberately absent: tenant/owner are handled by the data layer
 * and the database, and `status` is changed only through the lifecycle control,
 * which goes through the Phase 2A state-machine trigger.
 *
 * Date/time values are kept as the browser's native `datetime-local` strings
 * (local wall-clock time). Conversion happens exactly once, at the boundary:
 *   input string --(localDateTimeInputToIso)--> ISO instant -> database
 *   database ISO --(isoToLocalDateTimeInput)--> input string
 * Neither direction shifts the displayed local time.
 */

export interface HackathonFormValues {
  title: string;
  slug: string;
  tagline: string;
  description: string;
  banner_url: string;
  problem_submission_opens: string;
  problem_submission_closes: string;
  registration_opens: string;
  registration_closes: string;
  team_formation_closes: string;
  hacking_starts: string;
  hacking_ends: string;
  evaluation_starts: string;
  evaluation_ends: string;
  results_announced_at: string;
  min_team_size: string;
  max_team_size: string;
  max_teams_per_problem: string;
  allow_solo: boolean;
  require_college_email: boolean;
  evaluation_rounds: EvaluationRound[];
  evaluation_rubric: EvaluationRubricCriterion[];
  prizes: HackathonPrize[];
  visibility: HackathonVisibility;
}

export type HackathonFormErrors = Partial<Record<keyof HackathonFormValues, string>>;

/** The ten timeline columns of the Phase 2A table. */
export const HACKATHON_DATETIME_FIELDS = [
  'problem_submission_opens',
  'problem_submission_closes',
  'registration_opens',
  'registration_closes',
  'team_formation_closes',
  'hacking_starts',
  'hacking_ends',
  'evaluation_starts',
  'evaluation_ends',
  'results_announced_at',
] as const;

export type HackathonDateTimeField = (typeof HACKATHON_DATETIME_FIELDS)[number];

/** Human labels for the Phase 2A `visibility` values (stored value unchanged). */
export const HACKATHON_VISIBILITY_OPTIONS: {
  value: HackathonVisibility;
  label: string;
  helper: string;
}[] = [
  {
    value: 'public',
    label: 'Public',
    helper: 'Listed for this college once the event reaches the registration phase.',
  },
  {
    value: 'private',
    label: 'Private (invite only)',
    helper: 'Hidden from the public directory; shared directly with invited participants.',
  },
];

export const HACKATHON_VISIBILITY_LABELS: Record<HackathonVisibility, string> = {
  public: 'Public',
  private: 'Private',
};

/** Label + helper for each Schedule field, so the section is self-explaining. */
export const HACKATHON_TIMELINE_FIELDS: {
  field: HackathonDateTimeField;
  label: string;
  helper: string;
}[] = [
  { field: 'problem_submission_opens', label: 'Problem submission opens', helper: 'Companies may begin submitting problems.' },
  { field: 'problem_submission_closes', label: 'Problem submission deadline', helper: 'Last moment problems are accepted.' },
  { field: 'registration_opens', label: 'Registration opens', helper: 'Students may start registering.' },
  { field: 'registration_closes', label: 'Registration closes', helper: 'Registration is locked.' },
  { field: 'team_formation_closes', label: 'Team formation closes', helper: 'Teams are frozen before hacking starts.' },
  { field: 'hacking_starts', label: 'Hackathon starts', helper: 'The build phase begins.' },
  { field: 'hacking_ends', label: 'Hackathon ends', helper: 'Coding stops and submissions are locked.' },
  { field: 'evaluation_starts', label: 'Evaluation starts', helper: 'Judging window opens.' },
  { field: 'evaluation_ends', label: 'Evaluation ends', helper: 'Judging window closes.' },
  { field: 'results_announced_at', label: 'Results announced', helper: 'Scores and awards become visible.' },
];

export const emptyEvaluationRound = (round: number): EvaluationRound => ({
  round,
  name: round === 1 ? 'Internal Review' : `Round ${round}`,
  evaluators_per_team: 2,
});

export const emptyRubricCriterion = (): EvaluationRubricCriterion => ({
  criterion: '',
  weight: 25,
  max_score: 10,
  description: '',
});

export const emptyPrize = (rank: number): HackathonPrize => ({
  rank,
  amount: 0,
  description: '',
});

const pad = (value: number): string => String(value).padStart(2, '0');

/* ------------------------------------------------------------------
 * Date/time boundary conversion (timezone-safe)
 * ------------------------------------------------------------------ */

/** ISO instant from the database -> value for `<input type="datetime-local">`. */
export const isoToLocalDateTimeInput = (iso?: string | null): string => {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` +
    `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  );
};

/** `datetime-local` value (local wall-clock) -> ISO instant for the database. */
export const localDateTimeInputToIso = (value: string): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

/* ------------------------------------------------------------------
 * Defaults / hydration
 * ------------------------------------------------------------------ */

export const emptyHackathonFormValues = (): HackathonFormValues => ({
  title: '',
  slug: '',
  tagline: '',
  description: '',
  banner_url: '',
  problem_submission_opens: '',
  problem_submission_closes: '',
  registration_opens: '',
  registration_closes: '',
  team_formation_closes: '',
  hacking_starts: '',
  hacking_ends: '',
  evaluation_starts: '',
  evaluation_ends: '',
  results_announced_at: '',
  min_team_size: '2',
  max_team_size: '4',
  max_teams_per_problem: '10',
  allow_solo: false,
  require_college_email: true,
  evaluation_rounds: [],
  evaluation_rubric: [],
  prizes: [],
  visibility: 'public',
});

export const hackathonToFormValues = (hackathon: Hackathon): HackathonFormValues => ({
  title: hackathon.title ?? '',
  slug: hackathon.slug ?? '',
  tagline: hackathon.tagline ?? '',
  description: hackathon.description ?? '',
  banner_url: hackathon.banner_url ?? '',
  problem_submission_opens: isoToLocalDateTimeInput(hackathon.problem_submission_opens),
  problem_submission_closes: isoToLocalDateTimeInput(hackathon.problem_submission_closes),
  registration_opens: isoToLocalDateTimeInput(hackathon.registration_opens),
  registration_closes: isoToLocalDateTimeInput(hackathon.registration_closes),
  team_formation_closes: isoToLocalDateTimeInput(hackathon.team_formation_closes),
  hacking_starts: isoToLocalDateTimeInput(hackathon.hacking_starts),
  hacking_ends: isoToLocalDateTimeInput(hackathon.hacking_ends),
  evaluation_starts: isoToLocalDateTimeInput(hackathon.evaluation_starts),
  evaluation_ends: isoToLocalDateTimeInput(hackathon.evaluation_ends),
  results_announced_at: isoToLocalDateTimeInput(hackathon.results_announced_at),
  min_team_size: String(hackathon.min_team_size ?? 2),
  max_team_size: String(hackathon.max_team_size ?? 4),
  max_teams_per_problem: String(hackathon.max_teams_per_problem ?? 10),
  allow_solo: Boolean(hackathon.allow_solo),
  require_college_email: Boolean(hackathon.require_college_email),
  evaluation_rounds: Array.isArray(hackathon.evaluation_rounds) ? hackathon.evaluation_rounds : [],
  evaluation_rubric: Array.isArray(hackathon.evaluation_rubric) ? hackathon.evaluation_rubric : [],
  prizes: Array.isArray(hackathon.prizes) ? hackathon.prizes : [],
  visibility: hackathon.visibility === 'private' ? 'private' : 'public',
});

/** Slug suggestion for the create form (never overrides a user-typed slug). */
export const suggestSlugFromTitle = (title: string): string => slugifyHackathonTitle(title);
/* ------------------------------------------------------------------
 * Validation (client-side guidance only — the database stays the authority)
 * ------------------------------------------------------------------ */

const parsePositiveInt = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
};

const ORDER_RULES: {
  earlier: HackathonDateTimeField;
  later: HackathonDateTimeField;
  message: string;
}[] = [
  {
    earlier: 'problem_submission_opens',
    later: 'problem_submission_closes',
    message: 'The submission deadline must be after the intake opens.',
  },
  {
    earlier: 'registration_opens',
    later: 'registration_closes',
    message: 'Registration must close after it opens.',
  },
  {
    earlier: 'hacking_starts',
    later: 'hacking_ends',
    message: 'The hackathon must end after it starts.',
  },
];

export const validateHackathonForm = (values: HackathonFormValues): HackathonFormErrors => {
  const errors: HackathonFormErrors = {};

  const title = values.title.trim();
  if (!title) errors.title = 'A title is required.';
  else if (title.length > 255) errors.title = 'Keep the title to 255 characters or fewer.';

  const slug = values.slug.trim();
  if (!slug) errors.slug = 'A slug is required — it forms the hackathon URL.';
  else if (!isValidHackathonSlug(slug)) {
    errors.slug =
      'Use lower-case letters, numbers and single hyphens only ' +
      `(maximum ${HACKATHON_SLUG_MAX_LENGTH} characters).`;
  }

  const bannerUrl = values.banner_url.trim();
  if (bannerUrl && !/^https?:\/\/\S+$/i.test(bannerUrl)) {
    errors.banner_url = 'Enter a full URL starting with http:// or https://.';
  }

  const minTeamSize = parsePositiveInt(values.min_team_size);
  const maxTeamSize = parsePositiveInt(values.max_team_size);
  const maxTeamsPerProblem = parsePositiveInt(values.max_teams_per_problem);

  if (minTeamSize === null) errors.min_team_size = 'Enter a whole number of 1 or more.';
  if (maxTeamSize === null) errors.max_team_size = 'Enter a whole number of 1 or more.';
  else if (minTeamSize !== null && maxTeamSize < minTeamSize) {
    errors.max_team_size = 'The maximum cannot be smaller than the minimum.';
  }
  if (maxTeamsPerProblem === null) errors.max_teams_per_problem = 'Enter a whole number of 1 or more.';

  const instants: Partial<Record<HackathonDateTimeField, number>> = {};
  for (const field of HACKATHON_DATETIME_FIELDS) {
    const raw = values[field];
    if (!raw) continue;
    const parsed = new Date(raw).getTime();
    if (Number.isNaN(parsed)) errors[field] = 'Enter a valid date and time.';
    else instants[field] = parsed;
  }

  for (const rule of ORDER_RULES) {
    const earlier = instants[rule.earlier];
    const later = instants[rule.later];
    if (earlier !== undefined && later !== undefined && earlier >= later) {
      errors[rule.later] = rule.message;
    }
  }

  const registrationCloses = instants.registration_closes;
  const hackingStarts = instants.hacking_starts;
  if (
    registrationCloses !== undefined &&
    hackingStarts !== undefined &&
    hackingStarts < registrationCloses
  ) {
    errors.hacking_starts = 'The hackathon must start on or after registration closes.';
  }

  const evaluationStarts = instants.evaluation_starts;
  const evaluationEnds = instants.evaluation_ends;
  if (
    evaluationStarts !== undefined &&
    evaluationEnds !== undefined &&
    evaluationStarts >= evaluationEnds
  ) {
    errors.evaluation_ends = 'Evaluation must end after it starts.';
  }

  values.evaluation_rounds.forEach((round, index) => {
    if (!round.name || !round.name.trim()) {
      errors.evaluation_rounds = `Round ${index + 1} needs a name.`;
    }
  });
  values.evaluation_rubric.forEach((criterion, index) => {
    if (!criterion.criterion || !criterion.criterion.trim()) {
      errors.evaluation_rubric = `Criterion ${index + 1} needs a name.`;
    } else if (!(Number(criterion.weight) > 0)) {
      errors.evaluation_rubric = `Criterion ${index + 1} needs a weight greater than 0.`;
    }
  });
  values.prizes.forEach((prize, index) => {
    if (!Number.isInteger(Number(prize.rank)) || Number(prize.rank) < 1) {
      errors.prizes = `Prize ${index + 1} needs a rank of 1 or more.`;
    }
  });

  if (values.visibility !== 'public' && values.visibility !== 'private') {
    errors.visibility = 'Choose a visibility.';
  }

  return errors;
};

export const hasHackathonFormErrors = (errors: HackathonFormErrors): boolean =>
  Object.keys(errors).length > 0;

/* ------------------------------------------------------------------
 * Mapping to the database payload (Phase 2A writable columns only)
 * ------------------------------------------------------------------ */

const trimToNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const parseIntOr = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
};

const optionalNumber = (value: number | undefined | null): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const sanitizeRounds = (rounds: EvaluationRound[]): EvaluationRound[] =>
  rounds
    .filter((round) => Boolean(round.name && round.name.trim()))
    .map((round, index) => {
      const roundNumber = Number(round.round);
      const evaluators = optionalNumber(round.evaluators_per_team);
      return {
        round: Number.isInteger(roundNumber) && roundNumber >= 1 ? roundNumber : index + 1,
        name: (round.name ?? '').trim(),
        ...(evaluators !== undefined ? { evaluators_per_team: evaluators } : {}),
      };
    });

const sanitizeRubric = (criteria: EvaluationRubricCriterion[]): EvaluationRubricCriterion[] =>
  criteria
    .filter((criterion) => Boolean(criterion.criterion && criterion.criterion.trim()))
    .map((criterion) => {
      const weight = Number(criterion.weight);
      const maxScore = optionalNumber(criterion.max_score);
      const description = (criterion.description ?? '').trim();
      return {
        criterion: (criterion.criterion ?? '').trim(),
        weight: Number.isFinite(weight) && weight > 0 ? weight : 0,
        ...(description ? { description } : {}),
        ...(maxScore !== undefined ? { max_score: maxScore } : {}),
      };
    });

const sanitizePrizes = (prizes: HackathonPrize[]): HackathonPrize[] =>
  prizes.map((prize, index) => {
    const rank = Number(prize.rank);
    const amount = optionalNumber(prize.amount);
    const description = (prize.description ?? '').trim();
    return {
      rank: Number.isInteger(rank) && rank >= 1 ? rank : index + 1,
      ...(amount !== undefined ? { amount } : {}),
      ...(description ? { description } : {}),
    };
  });

/**
 * Converts validated form values into the column payload accepted by
 * `public.hackathons`.
 *
 * The result contains only `HackathonWritableColumns` — never id, tenant_id,
 * created_by, created_at, updated_at or status — so the payload cannot be used
 * to move a hackathon between tenants, reassign its owner or jump the
 * lifecycle. `tenant_id` is added by the data layer from the authenticated
 * session, and the database re-checks it through RLS.
 */
export const toHackathonWritableFields = (
  values: HackathonFormValues
): HackathonWritableFields => ({
  slug: values.slug.trim(),
  title: values.title.trim(),
  tagline: trimToNull(values.tagline),
  description: trimToNull(values.description),
  banner_url: trimToNull(values.banner_url),
  problem_submission_opens: localDateTimeInputToIso(values.problem_submission_opens),
  problem_submission_closes: localDateTimeInputToIso(values.problem_submission_closes),
  registration_opens: localDateTimeInputToIso(values.registration_opens),
  registration_closes: localDateTimeInputToIso(values.registration_closes),
  team_formation_closes: localDateTimeInputToIso(values.team_formation_closes),
  hacking_starts: localDateTimeInputToIso(values.hacking_starts),
  hacking_ends: localDateTimeInputToIso(values.hacking_ends),
  evaluation_starts: localDateTimeInputToIso(values.evaluation_starts),
  evaluation_ends: localDateTimeInputToIso(values.evaluation_ends),
  results_announced_at: localDateTimeInputToIso(values.results_announced_at),
  min_team_size: parseIntOr(values.min_team_size, 2),
  max_team_size: parseIntOr(values.max_team_size, 4),
  max_teams_per_problem: parseIntOr(values.max_teams_per_problem, 10),
  allow_solo: values.allow_solo,
  require_college_email: values.require_college_email,
  evaluation_rubric: sanitizeRubric(values.evaluation_rubric),
  evaluation_rounds: sanitizeRounds(values.evaluation_rounds),
  prizes: sanitizePrizes(values.prizes),
  visibility: values.visibility,
});