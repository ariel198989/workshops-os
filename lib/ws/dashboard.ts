// Data + pure helpers for the dashboard (/) and the read-only models mirror (/models).
// New file: existing lib/ws/* modules are reused, not edited.
import { sb } from '../db';
import type { WorkshopWithOrg } from './workshops';
import type { WsEvent, WsGroup, WsModel, WsSession } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
export const RECENT_EVENTS_LIMIT = 15;

// ── pure helpers ──────────────────────────────────────────────────────
const UPCOMING_ORDER: Record<string, number> = { confirmed: 0, proposal: 1, draft: 2 };

/** Live workshop first, then upcoming (confirmed, proposal, draft) by start date. Finished ones are hidden. */
export function myWorkshops(list: readonly WorkshopWithOrg[]): WorkshopWithOrg[] {
  const visible = list.filter((w) => w.status === 'live' || Object.hasOwn(UPCOMING_ORDER, w.status));
  const start = (w: WorkshopWithOrg): number => (w.starts_on ? Date.parse(w.starts_on) : Number.POSITIVE_INFINITY);
  return [...visible].sort((a, b) => {
    if ((a.status === 'live') !== (b.status === 'live')) return a.status === 'live' ? -1 : 1;
    return start(a) - start(b);
  });
}

export function weekWindow(now: Date): { from: string; to: string } {
  return { from: now.toISOString(), to: new Date(now.getTime() + WEEK_DAYS * DAY_MS).toISOString() };
}

export const isNewInstall = (c: { orgs: number; workshops: number }): boolean => c.orgs === 0 && c.workshops === 0;

export const accuracyPercent = (v: number | null): string => (v === null ? '' : `${Math.round(v * 100)}%`);

export type ModelRow = Pick<WsModel, 'id' | 'group_id' | 'name' | 'accuracy' | 'image_count' | 'approved' | 'created_at'>;
export type GroupRef = Pick<WsGroup, 'id' | 'number' | 'display_name' | 'team_name' | 'workshop_id'>;
export interface MatchedModel<G extends GroupRef = GroupRef> { model: ModelRow; group: G }

/** Pairs each model with its group by group_id; a model whose group is not in the list is dropped. */
export function matchModels<G extends GroupRef>(models: readonly ModelRow[], groups: readonly G[]): MatchedModel<G>[] {
  const byId = new Map(groups.map((g) => [g.id, g] as const));
  return models.flatMap((model) => {
    const group = byId.get(model.group_id);
    return group ? [{ model, group }] : [];
  });
}

// ── data ──────────────────────────────────────────────────────────────
export type SessionWithWorkshop = WsSession & { workshop: { id: string; title: string } | null };
export type EventWithWorkshop = WsEvent & { workshop: { id: string; title: string } | null };

export async function listWeekSessions(now: Date = new Date()): Promise<SessionWithWorkshop[]> {
  const { from, to } = weekWindow(now);
  const { data, error } = await sb.from('ws_sessions').select('*, workshop:ws_workshops(id, title)')
    .gte('scheduled_at', from).lt('scheduled_at', to).neq('status', 'cancelled')
    .order('scheduled_at').limit(50);
  if (error) throw error;
  return data as SessionWithWorkshop[];
}

export async function listRecentEvents(limit = RECENT_EVENTS_LIMIT): Promise<EventWithWorkshop[]> {
  const { data, error } = await sb.from('ws_events').select('*, workshop:ws_workshops(id, title)')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data as EventWithWorkshop[];
}

export async function countOrganizations(): Promise<number> {
  const { count, error } = await sb.from('ws_organizations').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

export type GroupWithWorkshop = GroupRef & { workshop: { id: string; title: string } | null };

export async function listGroupRefs(): Promise<GroupWithWorkshop[]> {
  const { data, error } = await sb.from('ws_groups')
    .select('id, number, display_name, team_name, workshop_id, workshop:ws_workshops(id, title)')
    .order('workshop_id').order('number');
  if (error) throw error;
  return data as unknown as GroupWithWorkshop[];
}

const MODELS_LIMIT = 1000;

/** ws_models, newest first. RLS returns only the models of workshops the signed-in staff member can see. */
export async function listModels(): Promise<ModelRow[]> {
  const { data, error } = await sb.from('ws_models')
    .select('id, group_id, name, accuracy, image_count, approved, created_at')
    .order('created_at', { ascending: false }).limit(MODELS_LIMIT);
  if (error) throw error;
  return data as ModelRow[];
}
