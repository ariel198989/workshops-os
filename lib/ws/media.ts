import { BUCKET } from '../config';
import { sb } from '../db';
import { chunkPaths, readPurgeResult, type PurgeRpcResult } from './media-utils';

// ws_purge_workshop_media (migration 0011): admin only, workshop completed / archived / cancelled.
// It deletes the photo and job rows and returns the storage paths; removing the objects is the console's job.

export async function purgeWorkshopMedia(workshopId: string): Promise<PurgeRpcResult> {
  const { data, error } = await sb.rpc('ws_purge_workshop_media', { p_workshop: workshopId });
  if (error) throw error;
  return readPurgeResult(data);
}

export interface RemoveResult {
  /** paths the bucket accepted for deletion */
  removed: number;
  /** paths still in the bucket after a failed chunk (the storage policy needs is_thinkcv_admin) */
  remaining: string[];
}

/** Removes objects from the public bucket in chunks of 100; a failing chunk is kept whole in `remaining`. */
export async function removeStoragePaths(paths: readonly string[]): Promise<RemoveResult> {
  let removed = 0;
  const remaining: string[] = [];
  for (const chunk of chunkPaths(paths)) {
    const { error } = await sb.storage.from(BUCKET).remove(chunk);
    if (error) remaining.push(...chunk);
    else removed += chunk.length;
  }
  return { removed, remaining };
}
