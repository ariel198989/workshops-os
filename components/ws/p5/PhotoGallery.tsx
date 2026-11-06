'use client';
import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { fetchGroupPhotos, type GroupPhoto } from '@/lib/ws/deliverables';
import { MediaNotice } from './MediaNotice';
import { useLoad } from './useLoad';
import { useMediaUrls } from './useMediaUrls';
import styles from './p5.module.css';

export const GALLERY_PAGE_SIZE = 60;

interface PhotoGalleryProps {
  groupId: string;
  /** pick mode: each photo gets a button (used to attach a frame to a failure case) */
  pickLabel?: string;
  onPick?: (photo: GroupPhoto) => void;
}

/** Group photos from the private ws-media bucket (signed links), 60 per page. */
export function PhotoGallery({ groupId, pickLabel, onPick }: PhotoGalleryProps) {
  const [page, setPage] = useState(0);
  const { data, error, loading } = useLoad(() => fetchGroupPhotos(groupId, page, GALLERY_PAGE_SIZE), [groupId, page]);
  const media = useMediaUrls((data ?? []).map((p) => p.frame_path));

  if (error) return <p className="err" role="alert">{error}</p>;
  const photos = data ?? [];
  return (
    <div className="stack">
      {loading && !data ? <div className={styles.center}><Spinner /></div> : null}
      {!loading && photos.length === 0 ? (
        <p className="hint">{page === 0 ? 'אין עדיין תמונות לקבוצה.' : 'אין עוד תמונות.'}</p>
      ) : null}
      <MediaNotice media={media} />
      <div className={styles.gallery}>
        {photos.map((p) => (
          <figure key={p.id} className={styles.photo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={media.urls[p.frame_path]} alt={p.class_name} loading="lazy" />
            <figcaption dir="auto">{p.class_name}</figcaption>
            {onPick ? (
              <button type="button" className="sm primary" onClick={() => onPick(p)}>{pickLabel ?? 'בחירה'}</button>
            ) : null}
          </figure>
        ))}
      </div>
      <div className={styles.metaRow}>
        <button type="button" className="sm" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>הקודם</button>
        <span className="hint">עמוד {page + 1}</span>
        <button type="button" className="sm" disabled={photos.length < GALLERY_PAGE_SIZE || loading}
          onClick={() => setPage(page + 1)}>הבא</button>
      </div>
    </div>
  );
}
