// Pure helpers for the live training panel (no React, unit tested).
import type { TrainingJobStatus } from '../../../lib/ws/types';

export const JOB_STATUS_LABELS: Record<TrainingJobStatus, string> = {
  pending: 'ממתין', running: 'רץ', done: 'הושלם', failed: 'נכשל', cancelled: 'בוטל',
};

export const FAIL_REASON_PROMPT = 'סיבת הכישלון (תוצג לקבוצה ולצוות)';
export const FAIL_REASON_REQUIRED = 'נדרשת סיבה כדי לסמן אימון כנכשל';

/** Training jobs are keyed by group_id. Order and uniqueness kept. */
export function jobGroupIds(groups: readonly { group_id: string }[]): string[] {
  return [...new Set(groups.map((g) => g.group_id))];
}

/** Group number for a job's group_id, or null when the group is not on the board. */
export function groupNumberForJob(groups: readonly { group_id: string; number: number }[], groupId: string): number | null {
  const hit = groups.find((g) => g.group_id === groupId);
  return hit ? hit.number : null;
}

/** Trims the prompt answer; null means cancelled or empty (no RPC call). */
export function cleanFailReason(raw: string | null): string | null {
  const text = (raw ?? '').trim();
  return text === '' ? null : text.slice(0, 200);
}
