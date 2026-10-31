import { sb } from '../db';

// sc_training_jobs (Smart City): the console only reads the open jobs of its own teams and can fail one.
export type TrainingJobStatus = 'pending' | 'running' | 'done' | 'failed';
export interface TrainingJob {
  id: string;
  team_name: string;
  status: TrainingJobStatus;
  image_count: number | null;
  created_at: string;
  started_at: string | null;
}

export const OPEN_JOB_STATUSES: readonly TrainingJobStatus[] = ['pending', 'running'];

/** Pending / running jobs of the given team keys (team names and their personal variants), newest first. */
export async function listOpenTrainingJobs(teamKeys: readonly string[]): Promise<TrainingJob[]> {
  if (teamKeys.length === 0) return [];
  const { data, error } = await sb.from('sc_training_jobs')
    .select('id, team_name, status, image_count, created_at, started_at')
    .in('team_name', teamKeys).in('status', OPEN_JOB_STATUSES)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as TrainingJob[];
}

/** ws_fail_training_job (workshop staff): marks a pending / running job as failed with the given reason. */
export async function failTrainingJob(jobId: string, reason: string): Promise<void> {
  const { error } = await sb.rpc('ws_fail_training_job', { p_job: jobId, p_reason: reason });
  if (error) throw error;
}
