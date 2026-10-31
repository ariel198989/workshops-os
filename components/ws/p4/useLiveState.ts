'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveState } from '@/lib/ws/live';
import { getLiveState, subscribeLiveState } from '@/lib/ws/live-api';
import { usePolling } from '@/lib/ws/poll';
import { POLL_MS } from './useBoard';

export type LiveMode = 'connecting' | 'realtime' | 'polling';

export interface LiveHandle {
  live: LiveState | null;
  /** first read finished (with or without a row) */
  loaded: boolean;
  mode: LiveMode;
  refresh: () => Promise<void>;
  /** optimistic apply of an RPC result; the realtime event that follows carries the same row */
  apply: (row: LiveState | null) => void;
}

export const LIVE_MODE_LABELS: Record<LiveMode, string> = {
  connecting: 'מתחבר',
  realtime: 'מסונכרן בזמן אמת',
  polling: `רענון כל ${POLL_MS / 1000} שניות`,
};

/**
 * The workshop's ws_live_state row, kept current over Supabase realtime so two staff devices agree.
 * If the channel errors or times out, the hook falls back to the board's 20 s polling until it recovers.
 */
export function useLiveState(workshopId: string): LiveHandle {
  const [live, setLive] = useState<LiveState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<LiveMode>('connecting');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const row = await getLiveState(workshopId);
    if (!alive.current) return;
    setLive(row);
    setLoaded(true);
  }, [workshopId]);

  useEffect(() => {
    refresh().catch(() => { if (alive.current) setLoaded(true); });
  }, [refresh]);

  useEffect(() => subscribeLiveState(workshopId, {
    onChange: (row) => { if (alive.current) setLive(row); },
    onStatus: (status) => {
      if (!alive.current) return;
      if (status === 'SUBSCRIBED') {
        setMode('realtime');
        // anything written while the channel was joining
        refresh().catch(() => undefined);
      } else {
        setMode('polling');
      }
    },
  }), [workshopId, refresh]);

  usePolling(refresh, POLL_MS, mode === 'polling');

  const apply = useCallback((row: LiveState | null) => setLive(row), []);
  return { live, loaded, mode, refresh, apply };
}
