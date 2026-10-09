import type { Company, CompanyWritableFields } from '../types/database';

/**
 * Phase 2C — form model for creating and editing a company.
 *
 * Every field maps 1:1 to a real column of `public.companies` (Phase 2C).
 * The security columns (id, tenant_id, created_by, created_at, updated_at) and
 * `verified` are deliberately absent: tenant/owner are handled by the data layer
 * and the database, and `verified` is changed only by admins through the
 * admin companies page.
 */

export interface CompanyFormValues {
  name: string;
  website: string;
  logo_url: string;
  description: string;
  industry: string;
}

export type CompanyFormErrors = Partial<Record<keyof CompanyFormValues, string>>;

/** Human labels for the form fields. */
export const COMPANY_FORM_FIELDS: {
  field: keyof CompanyFormValues;
  label: string;
  placeholder: string;
  helper: string;
}[] = [
  {
    field: 'name',
    label: 'Company Name *',
    placeholder: 'Acme Technologies Pvt Ltd',
    helper: 'Must be unique within this college.',
  },
  {
    field: 'website',
    label: 'Website',
    placeholder: 'https://acme.example.com',
    helper: 'Full URL starting with http:// or https://.',
  },
  {
    field: 'logo_url',
    label: 'Logo URL',
    placeholder: 'https://images.example.com/logo.png',
    helper: 'Full URL to the company logo (optional).',
  },
  {
    field: 'description',
    label: 'Description',
    placeholder: 'What your company does, focus areas, and why students should join your challenges.',
    helper: 'Stored in public.companies.description.',
  },
  {
    field: 'industry',
    label: 'Industry',
    placeholder: 'Software / AI / Automotive / Fintech / etc.',
    helper: 'Stored in public.companies.industry (optional).',
  },
];

export const emptyCompanyFormValues = (): CompanyFormValues => ({
  name: '',
  website: '',
  logo_url: '',
  description: '',
  industry: '',
});

export const companyToFormValues = (company: Company): CompanyFormValues => ({
  name: company.name ?? '',
  website: company.website ?? '',
  logo_url: company.logo_url ?? '',
  description: company.description ?? '',
  industry: company.industry ?? '',
});

/* ------------------------------------------------------------------
 * Validation (client-side guidance only — the database stays the authority)
 * ------------------------------------------------------------------ */

const isValidUrl = (value: string): boolean => {
  if (!value.trim()) return true; // optional fields
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validateCompanyForm = (values: CompanyFormValues): CompanyFormErrors => {
  const errors: CompanyFormErrors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = 'A company name is required.';
  } else if (name.length > 255) {
    errors.name = 'Keep the name to 255 characters or fewer.';
  }

  if (values.website && !isValidUrl(values.website)) {
    errors.website = 'Enter a full URL starting with http:// or https://.';
  }

  if (values.logo_url && !isValidUrl(values.logo_url)) {
    errors.logo_url = 'Enter a full URL starting with http:// or https://.';
  }

  if (values.description && values.description.length > 5000) {
    errors.description = 'Description is too long (maximum 5000 characters).';
  }

  if (values.industry && values.industry.length > 100) {
    errors.industry = 'Industry name is too long (maximum 100 characters).';
  }

  return errors;
};

export const hasCompanyFormErrors = (errors: CompanyFormErrors): boolean =>
  Object.keys(errors).length > 0;

/* ------------------------------------------------------------------
 * Mapping to the database payload (Phase 2C writable columns only)
 * ------------------------------------------------------------------ */

const trimToNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/**
 * Converts validated form values into the column payload accepted by
 * `public.companies`.
 *
 * The result contains only `CompanyWritableColumns` — never id, tenant_id,
 * created_by, created_at, updated_at or verified — so the payload cannot be
 * used to move a company between tenants, reassign its owner or flip its
 * verification status. `tenant_id` is added by the data layer from the
 * authenticated session, and the database re-checks it through RLS.
 */
export const toCompanyWritableFields = (
  values: CompanyFormValues
): CompanyWritableFields => ({
  name: values.name.trim(),
  website: trimToNull(values.website),
  logo_url: trimToNull(values.logo_url),
  description: trimToNull(values.description),
  industry: trimToNull(values.industry),
});