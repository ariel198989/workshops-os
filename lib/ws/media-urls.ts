import { MEDIA_BUCKET } from '../config';
import { sb } from '../db';
import { MEDIA_URL_TTL_SECONDS, mergeSigned, readSigned, splitCached, type SignedCache, type UrlByPath } from './signed-urls';

// one cache per browser tab: a path is signed once and reused until shortly before its link expires
let cache: SignedCache = new Map();

/**
 * Signed URLs for objects in the private ws-media bucket (staff of the workshop may read them).
 * One storage call for all the paths that are not cached. A path that is missing or not readable
 * is simply absent from the result; the call throws only when the whole request fails.
 */
export async function signMediaUrls(paths: readonly string[]): Promise<UrlByPath> {
  const now = Date.now();
  const { hits, misses } = splitCached(cache, paths, now);
  if (misses.length === 0) return hits;
  const { data, error } = await sb.storage.from(MEDIA_BUCKET).createSignedUrls(misses, MEDIA_URL_TTL_SECONDS);
  if (error) throw error;
  const fresh = readSigned(data ?? []);
  cache = mergeSigned(cache, fresh, now);
  return { ...hits, ...fresh };
}
