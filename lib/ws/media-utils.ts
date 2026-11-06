// Pure helpers for the admin "מחיקת תמונות הסדנה" action (ws_purge_workshop_media + storage remove). Unit tested.

/** Supabase storage remove() takes a list; the console sends at most this many paths per call. */
export const STORAGE_REMOVE_CHUNK = 100;

/** What ws_purge_workshop_media returns. */
export interface PurgeRpcResult {
  frames: string[];
  zips: string[];
  photos_deleted: number;
}

/** Splits paths into fixed-size chunks, order kept; an empty list gives no chunks. */
export function chunkPaths(paths: readonly string[], size: number = STORAGE_REMOVE_CHUNK): string[][] {
  if (size < 1) throw new Error('chunk size must be at least 1');
  const out: string[][] = [];
  for (let i = 0; i < paths.length; i += size) out.push(paths.slice(i, i + size));
  return out;
}

/** Drops nulls / empties / duplicates: the RPC may list the same crop path twice. */
export function uniquePaths(raw: readonly (string | null | undefined)[]): string[] {
  return [...new Set(raw.filter((p): p is string => typeof p === 'string' && p.trim() !== ''))];
}

/**
 * Paths of a chunk that storage remove() did not hand back. It returns the objects it really deleted, and a path
 * with no object or no delete right is skipped without an error, so a silent miss must not count as removed.
 */
export function notRemoved(chunk: readonly string[], removed: readonly { name?: string | null }[] | null): string[] {
  const done = new Set((removed ?? []).map((o) => o.name));
  return chunk.filter((p) => !done.has(p));
}

/** Reads the jsonb result defensively; any malformed field becomes empty. */
export function readPurgeResult(raw: unknown): PurgeRpcResult {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown): string[] => (Array.isArray(v) ? uniquePaths(v as unknown[] as string[]) : []);
  const n = typeof obj.photos_deleted === 'number' && Number.isFinite(obj.photos_deleted) ? obj.photos_deleted : 0;
  return { frames: list(obj.frames), zips: list(obj.zips), photos_deleted: n };
}

export const purgeDoneText = (photos: number, zips: number): string => `נמחקו ${photos} תמונות ו-${zips} קבצי אימון`;

export const purgeRemainingText = (remaining: number): string =>
  `הרשומות נמחקו, אבל ${remaining} קבצים נשארו באחסון. הנתיבים למטה, להעתקה ולמחיקה ידנית`;
