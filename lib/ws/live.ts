// Pure helpers for the "עכשיו בכיתה" live step (ws_live_state, migration 0013). No React, no Supabase; unit tested.
import type { SessionStatus } from './types';

/** Route keys the student app can be opened to; mirrors the check in ws_set_live_step. */
export const LIVE_ROUTES = ['capture', 'tag', 'train', 'results', 'check', 'certificate'] as const;
export type LiveRoute = (typeof LIVE_ROUTES)[number];

export const LIVE_MESSAGE_MAX = 200;
export const LIVE_LABEL_MAX = 120;
export const BREAK_MESSAGE = 'עכשיו בלי מסכים';

export interface LivePreset {
  key: string;
  label: string;
  routes: readonly LiveRoute[];
  /** default message sent with the step when the facilitator typed none */
  message: string | null;
}

/** The quick buttons, in display order. */
export const LIVE_PRESETS: readonly LivePreset[] = [
  { key: 'capture', label: 'מצלמים', routes: ['capture'], message: null },
  { key: 'tag', label: 'מתייגים', routes: ['tag'], message: null },
  { key: 'train', label: 'שולחים לאימון', routes: ['train'], message: null },
  { key: 'results', label: 'תוצאות', routes: ['results'], message: null },
  { key: 'check', label: 'שאלון', routes: ['check'], message: null },
  { key: 'break', label: 'הפסקה', routes: [], message: BREAK_MESSAGE },
];

export const presetByKey = (key: string | null | undefined): LivePreset | null =>
  LIVE_PRESETS.find((p) => p.key === key) ?? null;

/** Row of ws_live_state as the console reads it. */
export interface LiveState {
  workshop_id: string;
  session_id: string | null;
  session_module_id: string | null;
  step_key: string | null;
  label: string | null;
  allowed_routes: string[];
  message: string | null;
  updated_by: string | null;
  updated_at: string;
}

/** What ws_set_live_step takes, minus the workshop. */
export interface LiveStepInput {
  moduleId: string | null;
  stepKey: string | null;
  label: string | null;
  routes: readonly LiveRoute[];
  message: string | null;
}

/** Trims and caps the free-text message; empty becomes null (the RPC stores null, not ''). */
export function clampLiveMessage(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim();
  return text === '' ? null : text.slice(0, LIVE_MESSAGE_MAX);
}

/** A quick-button click: the preset's step, the chosen module, the typed message or the preset's default. */
export function presetInput(preset: LivePreset, moduleId: string | null, message: string | null | undefined): LiveStepInput {
  return {
    moduleId,
    stepKey: preset.key,
    label: preset.label,
    routes: preset.routes,
    message: clampLiveMessage(message) ?? preset.message,
  };
}

const isRoute = (r: string): r is LiveRoute => (LIVE_ROUTES as readonly string[]).includes(r);

/** Message-only update: keeps the current step (or none) and replaces the message. */
export function messageInput(current: LiveState | null, moduleId: string | null, message: string | null | undefined): LiveStepInput {
  return {
    moduleId: moduleId ?? current?.session_module_id ?? null,
    stepKey: current?.step_key ?? null,
    label: current?.label ?? null,
    routes: (current?.allowed_routes ?? []).filter(isRoute),
    message: clampLiveMessage(message),
  };
}

interface SessionLike { id: string; session_no: number; status: SessionStatus }
const OPEN_STATUSES: readonly SessionStatus[] = ['planned', 'scheduled', 'postponed'];

/** The session marked live, otherwise the earliest session that is still ahead; null when every session is over. */
export function pickLiveSession<T extends SessionLike>(sessions: readonly T[]): T | null {
  const live = sessions.find((s) => s.status === 'live');
  if (live) return live;
  const open = sessions.filter((s) => OPEN_STATUSES.includes(s.status));
  if (open.length === 0) return null;
  return open.reduce((best, s) => (s.session_no < best.session_no ? s : best));
}

/** One line for the saved state: "מתייגים · מודול X", "הפסקה", or the message alone when there is no step. */
export function liveSummary(live: LiveState | null, moduleTitle: string | null): string | null {
  if (!live) return null;
  const parts = [live.label, moduleTitle ? `מודול: ${moduleTitle}` : null].filter((p): p is string => !!p);
  if (parts.length > 0) return parts.join(' · ');
  return live.message;
}
