'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/store';
import { listGroups } from '@/lib/ws/groups';
import { listParticipants, moveParticipant, type ParticipantWithGroup } from '@/lib/ws/participants';
import { usePolling } from '@/lib/ws/poll';
import { fetchOverview, getWorkshop, listSubproblems } from '@/lib/ws/workshops';
import type { Overview, WsGroup, WsSubproblem, WsWorkshop } from '@/lib/ws/types';
import { applyMove } from './drag';
import { errorText } from './hooks';

export const POLL_MS = 20_000;
// a poll that fires right after a load adds nothing
const FRESH_MS = 5_000;

export interface Board {
  overview: Overview | null;
  workshop: WsWorkshop | null;
  people: ParticipantWithGroup[];
  subproblems: WsSubproblem[];
  /** ws_groups rows (staff only): pin and share_token live here, not in the overview */
  groupRows: WsGroup[];
  patchGroupRow: (groupId: string, patch: Partial<WsGroup>) => void;
  /** e.g. a rotated workshop number: the row is refetched only on a full reload */
  patchWorkshop: (patch: Partial<WsWorkshop>) => void;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  polling: boolean;
  refresh: () => Promise<void>;
  move: (participantId: string, groupId: string | null) => Promise<void>;
}

/**
 * State of the live groups board. Loads once, then polls every 20 s only while the workshop is live
 * and the tab is visible (usePolling pauses on document.hidden).
 */
export function useBoard(workshopId: string): Board {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [workshop, setWorkshop] = useState<WsWorkshop | null>(null);
  const [people, setPeople] = useState<ParticipantWithGroup[]>([]);
  const [subproblems, setSubproblems] = useState<WsSubproblem[]>([]);
  const [groupRows, setGroupRows] = useState<WsGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadedAt = useRef(0);
  const peopleRef = useRef(people);
  useEffect(() => {
    peopleRef.current = people;
  });

  const tick = useCallback(async () => {
    // the rows carry the PINs; a failing read keeps the previous rows instead of hiding the board
    const [ov, ppl, rows] = await Promise.all([
      fetchOverview(workshopId), listParticipants(workshopId), listGroups(workshopId).catch(() => null),
    ]);
    setOverview(ov);
    setPeople(ppl);
    if (rows) setGroupRows(rows);
    setError(null);
    loadedAt.current = Date.now();
  }, [workshopId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    tick()
      .catch((err) => { if (alive) setError(errorText(err, 'הטעינה נכשלה')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tick]);

  useEffect(() => {
    getWorkshop(workshopId).then(setWorkshop).catch(() => setWorkshop(null));
    listSubproblems(workshopId).then(setSubproblems).catch(() => setSubproblems([]));
  }, [workshopId]);

  const polling = overview?.workshop.status === 'live';
  usePolling(async () => {
    if (Date.now() - loadedAt.current < FRESH_MS) return;
    await tick();
  }, POLL_MS, polling);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await tick();
    } catch (err) {
      toast(errorText(err, 'הרענון נכשל'));
    } finally {
      setRefreshing(false);
    }
  }, [tick]);

  const move = useCallback(async (participantId: string, groupId: string | null) => {
    const before = peopleRef.current;
    if (before.find((p) => p.id === participantId)?.group_id === groupId) return;
    setPeople(applyMove(before, participantId, groupId));
    try {
      await moveParticipant(participantId, groupId);
      fetchOverview(workshopId).then(setOverview).catch(() => undefined);
    } catch (err) {
      setPeople(before);
      toast(errorText(err, 'ההעברה נכשלה'));
    }
  }, [workshopId]);

  const patchGroupRow = useCallback((groupId: string, patch: Partial<WsGroup>) => {
    setGroupRows((rows) => rows.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
  }, []);

  const patchWorkshop = useCallback((patch: Partial<WsWorkshop>) => {
    setWorkshop((w) => (w ? { ...w, ...patch } : w));
  }, []);

  return {
    overview, workshop, people, subproblems, groupRows, patchGroupRow, patchWorkshop, loading, error, refreshing, polling,
    refresh, move,
  };
}
