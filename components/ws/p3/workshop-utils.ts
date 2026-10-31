// Pure helpers for the workshop create form, list and status bar (no React, unit tested).
import type { WorkshopFormat, WorkshopStatus } from '../../../lib/ws/types';

// ── code ──────────────────────────────────────────────────────────────
export const CODE_MIN = 3;
export const CODE_MAX = 20;
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,19}$/;
export const CODE_RULE = 'קוד: 3 עד 20 תווים, A-Z, 0-9 ומקף, מתחיל באות או ספרה';

/** Uppercase, keep A-Z 0-9 and dash only, cap at the DB maximum. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, CODE_MAX);
}

export const validateCode = (code: string): string | null => (CODE_PATTERN.test(code) ? null : CODE_RULE);

/** Join-code alphabet without the look-alikes 0/O and 1/I (what a teacher reads out to a class). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_BLOCK = 4;

function randomIndices(n: number): number[] {
  const out = new Uint8Array(n);
  if (typeof globalThis.crypto?.getRandomValues === 'function') globalThis.crypto.getRandomValues(out);
  else for (let i = 0; i < n; i += 1) out[i] = Math.floor(Math.random() * 256);
  // 256 is a multiple of 32, so the modulo keeps the draw uniform
  return Array.from(out, (b) => b % CODE_ALPHABET.length);
}

/** Random XXXX-XXXX code (9 chars) from CODE_ALPHABET. Always passes validateCode; never predictable. */
export function randomCode(): string {
  const chars = randomIndices(CODE_BLOCK * 2).map((i) => CODE_ALPHABET[i]);
  return `${chars.slice(0, CODE_BLOCK).join('')}-${chars.slice(CODE_BLOCK).join('')}`;
}

// ── team prefix ───────────────────────────────────────────────────────
export const PREFIX_MIN = 2;
export const PREFIX_MAX = 24;
export const FORBIDDEN_PREFIX_CHARS: readonly string[] = [',', '(', ')', '"', "'", '\\'];
const PERSONAL_MARKER = 'אישי';

/** Client mirror of the ws_workshops.team_prefix check constraint; the DB stays the authority. */
export function validateTeamPrefix(raw: string): string | null {
  const text = raw.trim();
  if (text === '') return 'יש להזין קידומת קבוצה';
  if (text.length < PREFIX_MIN) return `הקידומת קצרה מדי, לפחות ${PREFIX_MIN} תווים`;
  if (text.length > PREFIX_MAX) return `הקידומת ארוכה מדי, עד ${PREFIX_MAX} תווים`;
  if (text.startsWith(PERSONAL_MARKER)) return `הקידומת לא יכולה להתחיל ב${PERSONAL_MARKER}`;
  const bad = FORBIDDEN_PREFIX_CHARS.find((ch) => text.includes(ch));
  if (bad) return bad === '"' ? 'התו " אסור בקידומת, השתמשו בגרשיים ״' : `התו ${bad} אסור בקידומת`;
  return null;
}

export const teamNamePreview = (prefix: string, n = 1): string => `${prefix.trim()} · קבוצה ${n}`;

// ── template and first session ────────────────────────────────────────
interface TemplateLike { id: string; format: string; is_default: boolean }

export function pickDefaultTemplate<T extends TemplateLike>(templates: readonly T[], format: WorkshopFormat): T | null {
  const ofFormat = templates.filter((t) => t.format === format);
  return ofFormat.find((t) => t.is_default) ?? ofFormat[0] ?? null;
}

const FIRST_SESSION_HOUR = 16;
export const WORKSHOP_TIME_ZONE = 'Asia/Jerusalem';

const tzParts = new Intl.DateTimeFormat('en-US', {
  timeZone: WORKSHOP_TIME_ZONE, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Offset of WORKSHOP_TIME_ZONE from UTC at the given instant, in ms (positive east of Greenwich). */
function zoneOffsetMs(utcMs: number): number {
  const parts = tzParts.formatToParts(new Date(utcMs));
  const num = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(num('year'), num('month') - 1, num('day'), num('hour'), num('minute'), num('second'));
  return wall - utcMs;
}

/** Start date at 16:00 Asia/Jerusalem as an ISO instant, whatever the browser's zone (the RPC takes timestamptz). */
export function firstSessionIso(startsOn: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startsOn ?? '');
  if (!m) return null;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), FIRST_SESSION_HOUR);
  if (Number.isNaN(wall)) return null;
  // two passes so a DST switch on the day itself still lands on 16:00 wall-clock
  const utc = wall - zoneOffsetMs(wall - zoneOffsetMs(wall));
  return new Date(utc).toISOString();
}

// ── status transitions (plan B, restricted to what ws_set_workshop_status accepts) ──
export interface StatusAction {
  to: WorkshopStatus;
  label: string;
  confirm: string;
  tone: 'default' | 'primary' | 'danger';
  adminOnly: boolean;
}

const act = (
  to: WorkshopStatus, label: string, confirm: string,
  tone: StatusAction['tone'] = 'default', adminOnly = false,
): StatusAction => ({ to, label, confirm, tone, adminOnly });

const CANCEL = act('cancelled', 'ביטול הסדנה', 'לבטל את הסדנה?', 'danger', true);

export const GO_LIVE_CONFIRM = 'פתיחת הסדנה מפעילה את הקבוצות הקיימות באפליקציית Smart City ומציגה אותן בהרשמה';
export const NEEDS_GROUPS_HINT = 'צרו קבוצות לפני הפתיחה';
const GO_LIVE = act('live', 'פתיחת הסדנה', GO_LIVE_CONFIRM, 'primary');

// completed -> live and live -> confirmed exist so a premature close is recoverable (admins only)
const TRANSITIONS: Record<WorkshopStatus, readonly StatusAction[]> = {
  draft: [act('proposal', 'העברה להצעה', 'להעביר להצעה?'), act('confirmed', 'אישור הסדנה', 'לאשר את הסדנה?'), CANCEL],
  proposal: [act('confirmed', 'אישור הסדנה', 'לאשר את הסדנה?'), CANCEL],
  confirmed: [GO_LIVE, CANCEL],
  live: [
    act('completed', 'סיום הסדנה', 'הקבוצות יוסתרו מההרשמה, הנתונים נשמרים', 'primary'),
    act('confirmed', 'חזרה להכנה', 'להחזיר את הסדנה להכנה? הקבוצות יוסתרו מההרשמה עד הפתיחה הבאה', 'default', true),
  ],
  completed: [
    act('live', 'פתיחה מחדש', 'לפתוח את הסדנה מחדש? הקבוצות יוצגו שוב בהרשמה', 'default', true),
    act('archived', 'העברה לארכיון', 'להעביר לארכיון?', 'default', true),
  ],
  archived: [],
  cancelled: [act('draft', 'שחזור לטיוטה', 'לשחזר לטיוטה?', 'default', true)],
};

export function statusActions(status: WorkshopStatus, admin: boolean): StatusAction[] {
  return TRANSITIONS[status].filter((a) => admin || !a.adminOnly);
}

/** Going live with no groups activates nothing; null = groups still loading, so the button stays enabled. */
export const needsGroupsFirst = (action: StatusAction, groupCount: number | null): boolean =>
  action.to === 'live' && groupCount === 0;

// ── list ordering ─────────────────────────────────────────────────────
const RANK: Record<WorkshopStatus, number> = {
  live: 0, confirmed: 1, proposal: 2, draft: 3, completed: 4, archived: 5, cancelled: 5,
};

export const statusRank = (status: string): number => RANK[status as WorkshopStatus] ?? 6;

/** live, confirmed, proposal, draft, completed, then archived/cancelled; newest start first inside a group. */
export function sortWorkshops<T extends { status: string; starts_on: string | null }>(rows: readonly T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const byStatus = statusRank(a.row.status) - statusRank(b.row.status);
      if (byStatus !== 0) return byStatus;
      const sa = a.row.starts_on ?? '';
      const sb = b.row.starts_on ?? '';
      if (sa !== sb) return sa < sb ? 1 : -1;
      return a.index - b.index;
    })
    .map((x) => x.row);
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY'; anything else renders empty. */
export function fmtDay(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
