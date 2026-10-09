import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import {
  hasCompanyFormErrors,
  validateCompanyForm,
  type CompanyFormValues,
} from '../../lib/companyForm';
import { STORAGE_BUCKETS } from '../../lib/storage';
import { FileUploadDropzone } from '../ui/FileUploadDropzone';

/**
 * Phase 2C — create/edit form for `public.companies`.
 *
 * The component is presentation + client-side validation only: the caller
 * performs the Supabase write, and the Phase 2C database rules (RLS,
 * unique name, ownership trigger) stay the final authority.
 */

interface CompanyFormProps {
  mode: 'create' | 'edit';
  initialValues: CompanyFormValues;
  isSubmitting: boolean;
  submitError: string | null;
  submitLabel: string;
  /** Non-error information, e.g. helpful notice after create. */
  notice?: string | null;
  onSubmit: (values: CompanyFormValues) => void;
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

export const CompanyForm: React.FC<CompanyFormProps> = ({
  mode,
  initialValues,
  isSubmitting,
  submitError,
  submitLabel,
  notice,
  onSubmit,
  onCancel,
}) => {
  const [values, setValues] = useState<CompanyFormValues>(initialValues);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<boolean>(false);

  const validationErrors = useMemo(() => validateCompanyForm(values), [values]);

  const visibleError = (key: keyof CompanyFormValues): string | undefined =>
    submitted || touched[key] ? validationErrors[key] : undefined;

  const setField = <K extends keyof CompanyFormValues>(
    key: K,
    value: CompanyFormValues[K]
  ): void => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const markTouched = (key: keyof CompanyFormValues): void =>
    setTouched((current) => (current[key] ? current : { ...current, [key]: true }));

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSubmitted(true);
    if (isSubmitting || hasCompanyFormErrors(validationErrors)) return;
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
        title="Company Identity"
        description="Basic information about your company."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Company Name *"
            value={values.name}
            placeholder="Acme Technologies Pvt Ltd"
            helperText="Must be unique within this college."
            error={visibleError('name')}
            onChange={(event) => setField('name', event.target.value)}
            onBlur={() => markTouched('name')}
          />
          <Input
            label="Website"
            type="url"
            value={values.website}
            placeholder="https://acme.example.com"
            helperText="Full URL starting with http:// or https://."
            error={visibleError('website')}
            onChange={(event) => setField('website', event.target.value)}
            onBlur={() => markTouched('website')}
          />
          <div className="md:col-span-2 space-y-2">
            <FileUploadDropzone
              bucket={STORAGE_BUCKETS.LOGOS}
              pathPrefix={values.name ? values.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'company'}
              label="Company Logo"
              currentUrl={values.logo_url}
              onUploadComplete={(res) => setField('logo_url', res.url)}
              onRemove={() => setField('logo_url', '')}
              helperText="Upload your company logo (PNG, SVG, WEBP up to 2MB) or enter an external URL below."
            />
            <Input
              label="Or specify Logo URL directly"
              type="url"
              value={values.logo_url}
              placeholder="https://images.example.com/logo.png"
              helperText="Full URL to the company logo (optional)."
              error={visibleError('logo_url')}
              onChange={(event) => setField('logo_url', event.target.value)}
              onBlur={() => markTouched('logo_url')}
            />
          </div>
          <Input
            label="Industry"
            value={values.industry}
            placeholder="Software / AI / Automotive / Fintech / etc."
            helperText="Stored in public.companies.industry (optional)."
            error={visibleError('industry')}
            onChange={(event) => setField('industry', event.target.value)}
            onBlur={() => markTouched('industry')}
          />
        </div>
        <div className="md:col-span-2">
          <Textarea
            label="Description"
            value={values.description}
            rows={5}
            placeholder="What your company does, focus areas, and why students should join your challenges."
            helperText="Stored in public.companies.description."
            error={visibleError('description')}
            onChange={(event) => setField('description', event.target.value)}
            onBlur={() => markTouched('description')}
          />
        </div>
      </Section>

      {mode === 'edit' && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-700">Verification Status</p>
          <p className="text-[11px] text-slate-500 mt-1">
            The <code className="font-mono">verified</code> status is managed by college admins.
            Once verified, your company can submit problem statements to hackathons.
          </p>
        </div>
      )}

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