import { sb } from '../db';
import type { GroupPatch, WsGroup } from './types';

export async function listGroups(workshopId: string): Promise<WsGroup[]> {
  const { data, error } = await sb.from('ws_groups').select('*')
    .eq('workshop_id', workshopId).order('number');
  if (error) throw error;
  return data as WsGroup[];
}

// p_count null lets the RPC derive it from audience_size / group_size.
export async function createGroups(workshopId: string, count?: number, activate = false): Promise<WsGroup[]> {
  const { data, error } = await sb.rpc('ws_create_groups', {
    p_workshop: workshopId, p_count: count ?? null, p_activate: activate,
  });
  if (error) throw error;
  return data as WsGroup[];
}

// idempotent; only groups without sc_class_id are touched
export async function activateGroups(workshopId: string): Promise<WsGroup[]> {
  const { data, error } = await sb.rpc('ws_activate_groups', { p_workshop: workshopId });
  if (error) throw error;
  return data as WsGroup[];
}

// team_name / number / sc_class_id are not in the grant and never editable here
export async function updateGroup(id: string, patch: GroupPatch): Promise<WsGroup> {
  const { data, error } = await sb.from('ws_groups').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as WsGroup;
}

// pin is not client-updatable (0013): a new 4-digit PIN comes only from this RPC (ws_can_edit_workshop).
export async function rotateGroupPin(groupId: string): Promise<string> {
  const { data, error } = await sb.rpc('ws_rotate_group_pin', { p_group: groupId });
  if (error) throw error;
  return data as string;
}

// The two sc_* team keys of a group: the team itself and its personal variant.
export const teamNames = (team: string): [string, string] => [team, 'אישי · ' + team];
