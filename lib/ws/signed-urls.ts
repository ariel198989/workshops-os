// Pure cache logic for signed URLs of the private ws-media bucket (no Supabase, unit tested).
// The bucket has no public URL: every thumbnail is shown through a signed link that lives for an hour.

export const MEDIA_URL_TTL_SECONDS = 60 * 60;
/** A cached link is reused only while it has this much life left, so a lazily loaded image never gets a dying link. */
export const MEDIA_URL_MARGIN_SECONDS = 5 * 60;

export const MEDIA_LOAD_FAILED = 'התמונות לא נטענו. רעננו את הדף ונסו שוב';
export const mediaMissingText = (missing: number): string =>
  (missing === 1 ? 'תמונה אחת לא נמצאה באחסון' : `${missing} תמונות לא נמצאו באחסון`);

export interface SignedEntry { url: string; expiresAt: number }
export type SignedCache = ReadonlyMap<string, SignedEntry>;
export type UrlByPath = Readonly<Record<string, string>>;

/** One item of storage createSignedUrls(): a path the caller may not read comes back with an error and no URL. */
export interface SignedItem { path: string | null; signedUrl: string | null; error: string | null }

const isFresh = (entry: SignedEntry | undefined, now: number): entry is SignedEntry =>
  entry !== undefined && entry.expiresAt - MEDIA_URL_MARGIN_SECONDS * 1000 > now;

/** Splits the wanted paths into cached links that are still good and paths that need signing. Duplicates collapse. */
export function splitCached(cache: SignedCache, paths: readonly string[], now: number): { hits: UrlByPath; misses: string[] } {
  const unique = [...new Set(paths.filter((p) => p !== ''))];
  const hits = Object.fromEntries(unique.flatMap((p) => {
    const entry = cache.get(p);
    return isFresh(entry, now) ? [[p, entry.url] as const] : [];
  }));
  return { hits, misses: unique.filter((p) => !Object.hasOwn(hits, p)) };
}

/** Keeps only the items that were really signed, as path to URL. */
export function readSigned(items: readonly SignedItem[]): UrlByPath {
  return Object.fromEntries(items.flatMap((i) => (i.path && i.signedUrl && !i.error ? [[i.path, i.signedUrl] as const] : [])));
}

/** A new cache with the fresh links added and every expired entry dropped; the input cache is not touched. */
export function mergeSigned(
  cache: SignedCache, fresh: UrlByPath, now: number, ttlSeconds: number = MEDIA_URL_TTL_SECONDS,
): SignedCache {
  const kept = [...cache].filter(([, entry]) => isFresh(entry, now));
  const added = Object.entries(fresh).map(([path, url]) => [path, { url, expiresAt: now + ttlSeconds * 1000 }] as const);
  return new Map([...kept, ...added]);
}

/** How many of the wanted paths ended up without a link. */
export function countMissing(paths: readonly string[], urls: UrlByPath): number {
  return new Set(paths.filter((p) => p !== '' && !Object.hasOwn(urls, p))).size;
}
