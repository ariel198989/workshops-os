// Pure helpers for the live training panel (no React, unit tested).
import { teamNames } from '../../../lib/ws/groups';
import type { TrainingJobStatus } from '../../../lib/ws/training';

export const JOB_STATUS_LABELS: Record<TrainingJobStatus, string> = {
  pending: 'ממתין', running: 'רץ', done: 'הושלם', failed: 'נכשל',
};

export const FAIL_REASON_PROMPT = 'סיבת הכישלון (תוצג לקבוצה ולצוות)';
export const FAIL_REASON_REQUIRED = 'נדרשת סיבה כדי לסמן אימון כנכשל';

/** sc_* rows are keyed by team_name: each group has its team and a personal variant. Order and uniqueness kept. */
export function jobTeamKeys(groups: readonly { team_name: string }[]): string[] {
  return [...new Set(groups.flatMap((g) => teamNames(g.team_name)))];
}

/** Group number for a job's team key (personal variants resolve to their group), or null when unknown. */
export function groupNumberForTeam(groups: readonly { team_name: string; number: number }[], teamKey: string): number | null {
  const hit = groups.find((g) => teamNames(g.team_name).includes(teamKey));
  return hit ? hit.number : null;
}

/** Trims the prompt answer; null means cancelled or empty (no RPC call). */
export function cleanFailReason(raw: string | null): string | null {
  const text = (raw ?? '').trim();
  return text === '' ? null : text.slice(0, 200);
}
