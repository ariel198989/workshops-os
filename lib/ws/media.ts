import { MEDIA_BUCKET } from '../config';
import { sb } from '../db';
import { chunkPaths, notRemoved, readPurgeResult, type PurgeRpcResult } from './media-utils';

// ws_purge_workshop_media (migrations 0011, 0017): admin only, workshop completed / archived / cancelled.
// It deletes the photo and job rows and returns their ws-media paths; removing the objects is the console's job.

export async function purgeWorkshopMedia(workshopId: string): Promise<PurgeRpcResult> {
  const { data, error } = await sb.rpc('ws_purge_workshop_media', { p_workshop: workshopId });
  if (error) throw error;
  return readPurgeResult(data);
}

export interface RemoveResult {
  /** paths the bucket really deleted */
  removed: number;
  /** paths still there: the chunk failed, or the bucket did not confirm them (no object, or no delete right) */
  remaining: string[];
}

/** Removes objects from the private ws-media bucket in chunks of 100; whatever is not confirmed goes to `remaining`. */
export async function removeStoragePaths(paths: readonly string[]): Promise<RemoveResult> {
  const remaining: string[] = [];
  for (const chunk of chunkPaths(paths)) {
    const { data, error } = await sb.storage.from(MEDIA_BUCKET).remove(chunk);
    remaining.push(...(error ? chunk : notRemoved(chunk, data)));
  }
  return { removed: paths.length - remaining.length, remaining };
}
