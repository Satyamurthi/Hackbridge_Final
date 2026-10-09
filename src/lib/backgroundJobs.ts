/**
 * HackBridge Background Jobs & Worker Architecture Interface
 * 
 * Reference: HackBridge.pdf
 *   - Section 1: Architecture Overview (BullMQ + Redis background worker pool)
 *   - Section 3.8: Asynchronous job queue processing
 * 
 * Provides job queue dispatching, progress tracking, and worker simulations
 * for production deployment and local environments.
 */

export type JobType =
  | 'score_recompute'
  | 'notification_dispatch'
  | 'ai_triage_batch'
  | 'hackathon_archive';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface BackgroundJob<T = Record<string, unknown>> {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: T;
  progress: number; // 0 to 100
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// In-memory runtime job store for browser session & mock background processing
const activeJobs = new Map<string, BackgroundJob>();

/**
 * Dispatches a new background job to the queue.
 */
export async function dispatchBackgroundJob<T extends Record<string, unknown>>(
  type: JobType,
  payload: T
): Promise<BackgroundJob<T>> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const job: BackgroundJob<T> = {
    id: jobId,
    type,
    status: 'queued',
    payload,
    progress: 0,
    createdAt: new Date().toISOString(),
  };

  activeJobs.set(jobId, job as BackgroundJob);

  // Trigger simulated worker execution in background
  simulateJobWorker(jobId);

  return job;
}

/**
 * Retrieves the current state of a background job.
 */
export function getBackgroundJobStatus(jobId: string): BackgroundJob | undefined {
  return activeJobs.get(jobId);
}

/**
 * Lists all active or recently finished background jobs.
 */
export function listBackgroundJobs(filterType?: JobType): BackgroundJob[] {
  const jobs = Array.from(activeJobs.values());
  if (filterType) {
    return jobs.filter((j) => j.type === filterType);
  }
  return jobs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Lightweight worker simulator providing async job progression and telemetry.
 */
async function simulateJobWorker(jobId: string): Promise<void> {
  const job = activeJobs.get(jobId);
  if (!job) return;

  // Small async delay before start
  await new Promise((resolve) => setTimeout(resolve, 300));
  job.status = 'running';
  job.startedAt = new Date().toISOString();
  job.progress = 25;

  // Step 2: Processing
  await new Promise((resolve) => setTimeout(resolve, 800));
  job.progress = 75;

  // Step 3: Completion
  await new Promise((resolve) => setTimeout(resolve, 400));
  job.progress = 100;
  job.status = 'completed';
  job.completedAt = new Date().toISOString();

  // Attach job-specific outcome metadata
  switch (job.type) {
    case 'score_recompute':
      job.result = {
        message: 'Scores aggregated and variance normalized.',
        processedSubmissions: 12,
        durationMs: 1500,
      };
      break;
    case 'notification_dispatch':
      job.result = {
        dispatchedCount: 24,
        channels: ['in_app', 'email_relay'],
      };
      break;
    case 'ai_triage_batch':
      job.result = {
        triageCount: 8,
        flaggedCount: 1,
        avgCompleteness: 8.9,
      };
      break;
    case 'hackathon_archive':
      job.result = {
        status: 'archived',
        snapshotCreated: true,
      };
      break;
  }
}
