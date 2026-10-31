'use client';
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { canEdit, wsAuthStore } from '@/lib/ws/staff';
import { dbErrorMessage } from '../p3/db-errors';

/**
 * Supabase errors are plain objects with a code and a message, not Error instances.
 * Those go through dbErrorMessage so raw English RPC text (group is full, no template for format...) never reaches a toast.
 */
export function errorText(err: unknown, fallback = 'הפעולה נכשלה'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err !== null && 'code' in err) return dbErrorMessage(err, fallback);
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
}

/** The [id] segment of /workshops/[id]/... */
export function useWorkshopId(): string {
  const params = useParams<{ id: string }>();
  return params.id;
}

export function useCanEdit(workshopId: string): boolean {
  const { whoami } = useStore(wsAuthStore);
  return canEdit(whoami, workshopId);
}

export interface Loader<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: Dispatch<SetStateAction<T | null>>;
}

/**
 * Loads once on mount (and whenever `key` changes) and exposes reload().
 * A reload keeps the old data on screen; only the very first load shows `loading`.
 */
export function useLoader<T>(load: () => Promise<T>, key: string): Loader<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  const alive = useRef(true);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      const next = await loadRef.current();
      if (!alive.current) return;
      setData(next);
      setError(null);
    } catch (err) {
      if (alive.current) setError(errorText(err, 'הטעינה נכשלה'));
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [key, reload]);

  return { data, error, loading, reload, setData };
}
