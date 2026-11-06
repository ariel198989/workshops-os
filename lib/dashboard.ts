'use client';
import { sb } from './db';
import { startOfLocalDayISO } from './dashboard-time';

export interface QuickCounts {
  activatedGroups: number | undefined;
  models: number | undefined;
  pendingJobs: number | undefined;
  photosToday: number | undefined;
}

type CountResult = PromiseLike<{ count: number | null; error: unknown }>;

// a failed query yields undefined so one broken table never blanks the dashboard
async function settle(query: CountResult): Promise<number | undefined> {
  try {
    const { count, error } = await query;
    return error || count === null ? undefined : count;
  } catch {
    return undefined;
  }
}

const head = { count: 'exact' as const, head: true };

// RLS scopes every count to the workshops the signed-in staff member can see
export async function fetchQuickCounts(): Promise<QuickCounts> {
  const [activatedGroups, models, pendingJobs, photosToday] = await Promise.all([
    settle(sb.from('ws_groups').select('id', head).not('activated_at', 'is', null)),
    settle(sb.from('ws_models').select('id', head)),
    settle(sb.from('ws_training_jobs').select('id', head).eq('status', 'pending')),
    settle(sb.from('ws_photos').select('id', head).neq('status', 'rejected').gte('created_at', startOfLocalDayISO())),
  ]);
  return { activatedGroups, models, pendingJobs, photosToday };
}
