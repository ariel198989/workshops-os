import { mediaMissingText } from '@/lib/ws/signed-urls';
import type { MediaUrls } from './useMediaUrls';

/** One line above a photo list: the links failed to load, or some photos are not in the bucket. */
export function MediaNotice({ media }: { media: MediaUrls }) {
  if (media.error) return <p className="err" role="alert">{media.error}</p>;
  if (media.missing > 0) return <p className="hint">{mediaMissingText(media.missing)}</p>;
  return null;
}
