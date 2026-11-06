import { sb } from '../db';
import type { ParticipantPatch, ReconcileResult, WsParticipant } from './types';
import { mergePrivate, PARTICIPANT_COLUMNS, type ParticipantPrivate, type ParticipantPublic } from './participant-private';

const MAX_NAME = 80;

export type ParticipantWithGroup = ParticipantPublic & {
  group: { number: number; display_name: string | null } | null;
};
/** a row of the participants page: the staff-only columns merged in (empty for non-staff) */
export type ParticipantRow = ParticipantWithGroup & Pick<WsParticipant, 'notes' | 'custom_fields'>;

export async function listParticipants(workshopId: string): Promise<ParticipantWithGroup[]> {
  const { data, error } = await sb.from('ws_participants')
    .select(`${PARTICIPANT_COLUMNS}, group:ws_groups(number, display_name)`)
    .eq('workshop_id', workshopId).order('full_name');
  if (error) throw error;
  return data as unknown as ParticipantWithGroup[];
}

/** listParticipants plus notes + custom_fields, which only staff can read (via ws_participant_private). */
export async function listParticipantsWithPrivate(workshopId: string): Promise<ParticipantRow[]> {
  const [rows, priv] = await Promise.all([
    listParticipants(workshopId),
    sb.rpc('ws_participant_private', { p_workshop: workshopId }),
  ]);
  if (priv.error) throw priv.error;
  return mergePrivate(rows, (priv.data ?? []) as ParticipantPrivate[]);
}

// Roster paste: trims, drops empties, dedupes (case-insensitive), caps at 80 chars (DB check).
export function cleanNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  return names
    .map((n) => n.trim().slice(0, MAX_NAME))
    .filter((n) => {
      const key = n.toLowerCase();
      if (!n || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function addParticipants(
  workshopId: string, names: readonly string[], groupId?: string,
): Promise<ParticipantPublic[]> {
  const rows = cleanNames(names).map((full_name) => ({
    workshop_id: workshopId, group_id: groupId ?? null, full_name, source: 'roster', status: 'active',
  }));
  if (rows.length === 0) return [];
  const { data, error } = await sb.from('ws_participants').insert(rows).select(PARTICIPANT_COLUMNS);
  if (error) throw error;
  return data as unknown as ParticipantPublic[];
}

export async function updateParticipant(id: string, patch: ParticipantPatch): Promise<ParticipantPublic> {
  const { data, error } = await sb.from('ws_participants').update(patch).eq('id', id)
    .select(PARTICIPANT_COLUMNS).single();
  if (error) throw error;
  return data as unknown as ParticipantPublic;
}

export async function reconcile(workshopId: string): Promise<ReconcileResult> {
  const { data, error } = await sb.rpc('ws_reconcile_participants', { p_workshop: workshopId });
  if (error) throw error;
  return data as ReconcileResult;
}

export async function linkParticipant(participantId: string, userId: string): Promise<WsParticipant> {
  const { data, error } = await sb.rpc('ws_link_participant', { p_participant: participantId, p_user: userId });
  if (error) throw error;
  return data as WsParticipant;
}

// groupId null = unassign
export async function moveParticipant(participantId: string, groupId: string | null): Promise<WsParticipant> {
  const { data, error } = await sb.rpc('ws_move_participant', { p_participant: participantId, p_group: groupId });
  if (error) throw error;
  return data as WsParticipant;
}
