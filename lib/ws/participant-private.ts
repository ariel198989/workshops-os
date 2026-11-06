import type { JsonObject, WsParticipant } from './types';

// notes + custom_fields are hidden from the authenticated role (students could read them on their own
// row); staff read them through ws_participant_private. Every ws_participants read selects this list.
export const PARTICIPANT_COLUMNS =
  'id, workshop_id, group_id, user_id, full_name, grade, roles, status, source, media_consent, joined_at, created_at, updated_at';

export type ParticipantPublic = Omit<WsParticipant, 'notes' | 'custom_fields'>;
export interface ParticipantPrivate { id: string; notes: string | null; custom_fields: JsonObject | null }

/** Puts the staff-only columns back on each row by id; rows without a private entry get empty values. */
export function mergePrivate<T extends ParticipantPublic>(
  rows: readonly T[], priv: readonly ParticipantPrivate[],
): (T & Pick<WsParticipant, 'notes' | 'custom_fields'>)[] {
  const byId = new Map(priv.map((p) => [p.id, p]));
  return rows.map((r) => {
    const p = byId.get(r.id);
    return { ...r, notes: p?.notes ?? null, custom_fields: p?.custom_fields ?? {} };
  });
}
