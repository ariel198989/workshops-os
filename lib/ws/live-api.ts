import type { RealtimeChannel } from '@supabase/supabase-js';
import { sb } from '../db';
import type { LiveState, LiveStepInput } from './live';

// ws_live_state (migration 0013): one row per workshop, written only through the RPCs below.

export async function getLiveState(workshopId: string): Promise<LiveState | null> {
  const { data, error } = await sb.from('ws_live_state').select('*').eq('workshop_id', workshopId).maybeSingle();
  if (error) throw error;
  return (data as LiveState | null) ?? null;
}

export async function setLiveStep(workshopId: string, input: LiveStepInput): Promise<LiveState> {
  const { data, error } = await sb.rpc('ws_set_live_step', {
    p_workshop: workshopId,
    p_session_module: input.moduleId,
    p_step_key: input.stepKey,
    p_label: input.label,
    p_allowed_routes: [...input.routes],
    p_message: input.message,
  });
  if (error) throw error;
  return data as LiveState;
}

export async function clearLiveStep(workshopId: string): Promise<void> {
  const { error } = await sb.rpc('ws_clear_live_step', { p_workshop: workshopId });
  if (error) throw error;
}

export type LiveChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';

export interface LiveSubscription {
  /** the row after an insert / update, null after a delete */
  onChange: (row: LiveState | null) => void;
  onStatus: (status: LiveChannelStatus) => void;
}

/**
 * postgres_changes on this workshop's row. Returns the unsubscribe function.
 * The caller decides what to do on CHANNEL_ERROR / TIMED_OUT (the board falls back to polling).
 */
export function subscribeLiveState(workshopId: string, sub: LiveSubscription): () => void {
  const channel: RealtimeChannel = sb
    .channel(`ws-live-${workshopId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'ws_live_state', filter: `workshop_id=eq.${workshopId}` },
      (payload) => {
        if (payload.eventType === 'DELETE') sub.onChange(null);
        else sub.onChange(payload.new as LiveState);
      })
    .subscribe((status) => sub.onStatus(status as LiveChannelStatus));
  return () => {
    void sb.removeChannel(channel);
  };
}
