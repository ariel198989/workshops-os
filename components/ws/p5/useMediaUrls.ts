'use client';
import { useEffect, useState } from 'react';
import { signMediaUrls } from '@/lib/ws/media-urls';
import { MEDIA_LOAD_FAILED, countMissing, type UrlByPath } from '@/lib/ws/signed-urls';

export interface MediaUrls {
  /** frame_path to signed link; a path without a link renders as a blank tile */
  urls: UrlByPath;
  /** Hebrew line when the whole signing request failed */
  error: string | null;
  /** paths the bucket gave no link for (no such object, or no read right) */
  missing: number;
}

interface Signed extends MediaUrls { key: string }
const EMPTY: Signed = { key: '', urls: {}, error: null, missing: 0 };
const SEP = '\n';

/** Signed links for photos in the private ws-media bucket, one request per change of the path list. */
export function useMediaUrls(paths: readonly string[]): MediaUrls {
  const key = paths.join(SEP);
  const [state, setState] = useState<Signed>(EMPTY);

  useEffect(() => {
    if (key === '') return undefined;
    let alive = true;
    const wanted = key.split(SEP);
    signMediaUrls(wanted)
      .then((urls) => { if (alive) setState({ key, urls, error: null, missing: countMissing(wanted, urls) }); })
      .catch(() => { if (alive) setState({ key, urls: {}, error: MEDIA_LOAD_FAILED, missing: 0 }); });
    return () => { alive = false; };
  }, [key]);

  // while a new list is being signed the old links stay (unchanged photos do not blink), without the old notice
  return state.key === key ? state : { urls: state.urls, error: null, missing: 0 };
}
