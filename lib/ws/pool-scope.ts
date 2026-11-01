// Pool scope (migration 0016): who shares photos, tags and the trained model.
// 'personal' = each student works on their own pool and sees their own model (the default);
// 'group' = the whole group collects into one pool and trains one model. Pure labels, unit tested.
import { POOL_SCOPES, type PoolScope } from './types';

export const DEFAULT_POOL_SCOPE: PoolScope = 'personal';
export const POOL_SCOPE_QUESTION = 'איך עובדים על התמונות?';

export interface PoolScopeOption { value: PoolScope; label: string; help: string }

export const POOL_SCOPE_OPTIONS: readonly PoolScopeOption[] = [
  {
    value: 'personal', label: 'כל תלמיד לבד (מומלץ)',
    help: 'כל אחד מצלם, מתייג ומאמן את המודל שלו. המדריך יכול לאחד אחר כך.',
  },
  { value: 'group', label: 'כל הקבוצה יחד', help: 'כל הקבוצה אוספת למאגר אחד ומאמנת מודל אחד' },
];

/** Header pill: one word next to the device pill. */
export const POOL_SCOPE_PILL_LABELS: Record<PoolScope, string> = { personal: 'אישי', group: 'קבוצתי' };

export const isPoolScope = (v: unknown): v is PoolScope => POOL_SCOPES.includes(v as PoolScope);

/** Unknown or missing values (older rows, half-loaded boards) read as the DB default. */
export const normalizePoolScope = (v: unknown): PoolScope => (isPoolScope(v) ? v : DEFAULT_POOL_SCOPE);

export const poolScopePillLabel = (scope: PoolScope): string => POOL_SCOPE_PILL_LABELS[scope];

/** Group card and projector tile: a personal pool means the group count sums every student's photos. */
export const photosFactLabel = (scope: PoolScope): string => (scope === 'personal' ? 'תמונות (כל התלמידים)' : 'תמונות');

/** Live training panel heading. */
export const trainingPanelTitle = (scope: PoolScope): string => (scope === 'personal' ? 'אימונים אישיים' : 'אימונים פתוחים');
