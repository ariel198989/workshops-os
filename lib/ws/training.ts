import { sb } from '../db';
import type { TrainingJobStatus, WsTrainingJob } from './types';

// ws_training_jobs (migration 0017): the console only reads the open jobs of its own groups and can fail one.
export type TrainingJob = Pick<WsTrainingJob, 'id' | 'group_id' | 'team_name' | 'status' | 'image_count' | 'created_at' | 'started_at'>;

export const OPEN_JOB_STATUSES: readonly TrainingJobStatus[] = ['pending', 'running'];

/** Pending / running jobs of the given groups, newest first. */
export async function listOpenTrainingJobs(groupIds: readonly string[]): Promise<TrainingJob[]> {
  if (groupIds.length === 0) return [];
  const { data, error } = await sb.from('ws_training_jobs')
    .select('id, group_id, team_name, status, image_count, created_at, started_at')
    .in('group_id', groupIds).in('status', OPEN_JOB_STATUSES)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as TrainingJob[];
}

/** ws_fail_training_job (workshop staff): marks a pending / running job as failed with the given reason. */
export async function failTrainingJob(jobId: string, reason: string): Promise<void> {
  const { error } = await sb.rpc('ws_fail_training_job', { p_job: jobId, p_reason: reason });
  if (error) throw error;
}
