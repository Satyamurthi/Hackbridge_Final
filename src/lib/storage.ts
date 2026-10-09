import { supabase, isSupabaseConfigured } from './supabase';

export const STORAGE_MIGRATION_FILE =
  'supabase/migrations/20260928000001_phase12_storage_and_production_infrastructure.sql';

export const STORAGE_BUCKETS = {
  BANNERS: 'hackathon-banners',
  LOGOS: 'company-logos',
  DATASETS: 'problem-datasets',
  SUBMISSIONS: 'student-submissions',
  RESUMES: 'resumes',
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export interface BucketConstraint {
  maxSizeBytes: number;
  maxSizeLabel: string;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  isPublic: boolean;
}

export const BUCKET_CONSTRAINTS: Record<StorageBucket, BucketConstraint> = {
  [STORAGE_BUCKETS.BANNERS]: {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    maxSizeLabel: '5 MB',
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
    isPublic: true,
  },
  [STORAGE_BUCKETS.LOGOS]: {
    maxSizeBytes: 2 * 1024 * 1024, // 2MB
    maxSizeLabel: '2 MB',
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.svg'],
    isPublic: true,
  },
  [STORAGE_BUCKETS.DATASETS]: {
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    maxSizeLabel: '50 MB',
    allowedMimeTypes: [
      'application/zip',
      'text/csv',
      'application/json',
      'application/pdf',
      'application/gzip',
      'application/x-zip-compressed',
    ],
    allowedExtensions: ['.zip', '.csv', '.json', '.pdf', '.gz'],
    isPublic: false,
  },
  [STORAGE_BUCKETS.SUBMISSIONS]: {
    maxSizeBytes: 25 * 1024 * 1024, // 25MB
    maxSizeLabel: '25 MB',
    allowedMimeTypes: [
      'application/pdf',
      'application/zip',
      'image/png',
      'image/jpeg',
      'application/x-zip-compressed',
    ],
    allowedExtensions: ['.pdf', '.zip', '.png', '.jpg', '.jpeg'],
    isPublic: false,
  },
  [STORAGE_BUCKETS.RESUMES]: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    maxSizeLabel: '10 MB',
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    allowedExtensions: ['.pdf', '.doc', '.docx'],
    isPublic: false,
  },
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a file against specific bucket size and format constraints.
 */
export function validateStorageFile(file: File, bucket: StorageBucket): FileValidationResult {
  const constraints = BUCKET_CONSTRAINTS[bucket];
  if (!constraints) {
    return { valid: false, error: `Unknown storage bucket: ${bucket}` };
  }

  // 1. File Size Check
  if (file.size > constraints.maxSizeBytes) {
    return {
      valid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed size of ${constraints.maxSizeLabel}.`,
    };
  }

  // 2. MIME Type / Extension Check
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  const isMimeValid = constraints.allowedMimeTypes.includes(file.type);
  const isExtValid = constraints.allowedExtensions.includes(extension);

  if (!isMimeValid && !isExtValid) {
    return {
      valid: false,
      error: `Unsupported file format (${file.type || extension}). Allowed formats: ${constraints.allowedExtensions.join(', ')}.`,
    };
  }

  return { valid: true };
}

/**
 * Uploads a file directly to a designated Supabase Storage bucket.
 */
export async function uploadFileToBucket(
  bucket: StorageBucket,
  path: string,
  file: File,
  options?: { upsert?: boolean }
): Promise<{ path: string | null; url: string | null; error: string | null }> {
  // Validate file
  const validation = validateStorageFile(file, bucket);
  if (!validation.valid) {
    return { path: null, url: null, error: validation.error || 'Invalid file.' };
  }

  if (!isSupabaseConfigured) {
    // Dev mock fallback: Generate a client URL
    const mockUrl = URL.createObjectURL(file);
    return {
      path,
      url: mockUrl,
      error: null,
    };
  }

  try {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: options?.upsert ?? true,
      cacheControl: '3600',
    });

    if (error) {
      return { path: null, url: null, error: error.message };
    }

    const uploadedPath = data.path;
    let url: string | null = null;

    if (BUCKET_CONSTRAINTS[bucket].isPublic) {
      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(uploadedPath);
      url = publicData.publicUrl;
    } else {
      // For private buckets, generate a 1-hour signed URL
      const { data: signedData } = await supabase.storage
        .from(bucket)
        .createSignedUrl(uploadedPath, 3600);
      url = signedData?.signedUrl || uploadedPath;
    }

    return { path: uploadedPath, url, error: null };
  } catch (err) {
    return {
      path: null,
      url: null,
      error: err instanceof Error ? err.message : 'Storage upload failed.',
    };
  }
}

/**
 * Uploads a student resume PDF into the private `resumes` bucket under `resumes/{userId}/...`.
 */
export async function uploadStudentResume(
  file: File,
  userId: string
): Promise<{ path: string | null; url: string | null; error: string | null }> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  const cleanFilename = `resume-${Date.now()}.${extension}`;
  const path = `${userId}/${cleanFilename}`;

  return uploadFileToBucket(STORAGE_BUCKETS.RESUMES, path, file, { upsert: true });
}

/**
 * Uploads a student project deliverable (presentation deck, zip code, diagram) to `student-submissions`.
 */
export async function uploadSubmissionDeliverable(
  file: File,
  teamId: string,
  submissionId: string
): Promise<{ path: string | null; url: string | null; error: string | null }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${teamId}/${submissionId}/${Date.now()}_${safeName}`;

  return uploadFileToBucket(STORAGE_BUCKETS.SUBMISSIONS, path, file, { upsert: true });
}

/**
 * Uploads a hackathon banner image into the public CDN `hackathon-banners` bucket.
 */
export async function uploadHackathonBanner(
  file: File,
  tenantId: string,
  hackathonId: string
): Promise<{ path: string | null; url: string | null; error: string | null }> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${tenantId}/${hackathonId}/banner-${Date.now()}.${extension}`;

  return uploadFileToBucket(STORAGE_BUCKETS.BANNERS, path, file, { upsert: true });
}

/**
 * Uploads a company logo image into the public CDN `company-logos` bucket.
 */
export async function uploadCompanyLogo(
  file: File,
  companyId: string
): Promise<{ path: string | null; url: string | null; error: string | null }> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${companyId}/logo-${Date.now()}.${extension}`;

  return uploadFileToBucket(STORAGE_BUCKETS.LOGOS, path, file, { upsert: true });
}

/**
 * Uploads a challenge problem dataset into the private `problem-datasets` bucket.
 */
export async function uploadProblemDataset(
  file: File,
  problemId: string
): Promise<{ path: string | null; url: string | null; error: string | null }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${problemId}/${Date.now()}_${safeName}`;

  return uploadFileToBucket(STORAGE_BUCKETS.DATASETS, path, file, { upsert: true });
}

/**
 * Resolves a public CDN URL for an asset in a public bucket.
 */
export function getPublicAssetUrl(bucket: StorageBucket, path: string): string {
  if (!isSupabaseConfigured) {
    return path.startsWith('blob:') ? path : `/sample-assets/${path}`;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Generates a temporary signed URL for a protected private asset.
 */
export async function createSignedAssetUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 3600
): Promise<{ signedUrl: string | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { signedUrl: path, error: null };
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      return { signedUrl: null, error: error.message };
    }

    return { signedUrl: data.signedUrl, error: null };
  } catch (err) {
    return {
      signedUrl: null,
      error: err instanceof Error ? err.message : 'Failed to create signed URL',
    };
  }
}
