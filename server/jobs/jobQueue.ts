/**
 * Lightweight in-process job queue — swap for BullMQ when REDIS_URL is production-ready.
 */
export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface JobRecord<T = unknown> {
  id: string;
  type: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: T;
  error?: string;
  progress?: number;
}

const jobs = new Map<string, JobRecord>();

function newJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function enqueueJob<T>(
  type: string,
  runner: () => Promise<T>,
): string {
  const id = newJobId();
  const record: JobRecord<T> = {
    id,
    type,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  jobs.set(id, record as JobRecord);

  setImmediate(() => {
    record.status = "running";
    record.startedAt = new Date().toISOString();
    runner()
      .then((result) => {
        record.status = "completed";
        record.result = result;
        record.completedAt = new Date().toISOString();
        record.progress = 100;
      })
      .catch((err: Error) => {
        record.status = "failed";
        record.error = err.message || "Job failed";
        record.completedAt = new Date().toISOString();
      });
  });

  return id;
}

export function getJob(id: string): JobRecord | undefined {
  return jobs.get(id);
}

export function pruneOldJobs(maxAgeMs = 24 * 60 * 60 * 1000): void {
  const cutoff = Date.now() - maxAgeMs;
  for (const [id, job] of jobs) {
    const t = new Date(job.completedAt ?? job.createdAt).getTime();
    if (job.status !== "running" && t < cutoff) jobs.delete(id);
  }
}
