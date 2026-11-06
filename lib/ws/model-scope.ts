// Model scope (migration 0020): 'group' = the group's model (a facilitator merge, or a group-pool workshop),
// 'personal' = one student's own model. Pure labels and ordering, unit tested.
import type { ModelScope, PoolScope } from './types';

export const MODEL_SCOPE_LABELS: Record<ModelScope, string> = {
  group: 'מודל קבוצתי',
  personal: 'מודל אישי של תלמיד/ה',
};

/** Anything but 'personal' (e.g. the pre-0020 'team' default) is the group's model, as the migration set it. */
export const normalizeModelScope = (v: unknown): ModelScope => (v === 'personal' ? 'personal' : 'group');

export const modelScopeLabel = (v: unknown): string => MODEL_SCOPE_LABELS[normalizeModelScope(v)];

/** Group models first, otherwise the incoming order (newest first) is kept. Returns a new array. */
export function groupModelsFirst<T extends { scope: unknown }>(models: readonly T[]): T[] {
  const rank = (m: T) => (normalizeModelScope(m.scope) === 'group' ? 0 : 1);
  return models.map((m, i) => ({ m, i })).sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i).map((x) => x.m);
}

export interface ScopeMember { user_id: string | null; group_id: string | null; status: string }

/**
 * The scope ws-register-model will give the job's model: personal only when the workshop runs personal
 * pools and the requester is an active member of the job's group; group otherwise.
 */
export function jobScope(
  job: { group_id: string; requested_by: string | null }, poolScope: PoolScope, members: readonly ScopeMember[],
): ModelScope {
  if (!job.requested_by || poolScope !== 'personal') return 'group';
  const member = members.some((p) => p.user_id === job.requested_by && p.group_id === job.group_id && p.status === 'active');
  return member ? 'personal' : 'group';
}

/** Student-app page where the facilitator merges every member's photos and trains one group model. */
export function mergeHref(
  studentUrl: string, workshopId: string, group: { group_id: string; tagged: number }, poolScope: PoolScope,
): string | null {
  if (poolScope !== 'personal' || group.tagged <= 0) return null;
  const q = new URLSearchParams({ w: workshopId, g: group.group_id });
  return `${studentUrl}/facilitator/merge?${q.toString()}`;
}
