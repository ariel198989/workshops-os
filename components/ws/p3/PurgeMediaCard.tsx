'use client';
import { useState } from 'react';
import { ConfirmButton } from '@/components/ws/ConfirmButton';
import { toast } from '@/lib/store';
import { purgeWorkshopMedia, removeStoragePaths } from '@/lib/ws/media';
import { purgeDoneText, purgeRemainingText, uniquePaths } from '@/lib/ws/media-utils';
import type { WorkshopStatus } from '@/lib/ws/types';
import { withFriendlyError } from './db-errors';
import styles from './p3.module.css';

/** Mirrors the status check inside ws_purge_workshop_media. */
export const PURGEABLE_STATUSES: readonly WorkshopStatus[] = ['completed', 'archived', 'cancelled'];

interface PurgeMediaCardProps {
  workshopId: string;
  status: WorkshopStatus;
  admin: boolean;
}

interface PurgeOutcome { line: string; remaining: string[] }

/** Admin only, finished workshops only: deletes the photos and training files, keeps certificates and models. */
export function PurgeMediaCard({ workshopId, status, admin }: PurgeMediaCardProps) {
  const [outcome, setOutcome] = useState<PurgeOutcome | null>(null);
  if (!admin || !PURGEABLE_STATUSES.includes(status)) return null;

  const run = async () => {
    const res = await withFriendlyError(() => purgeWorkshopMedia(workshopId), 'מחיקת התמונות נכשלה');
    const rm = await removeStoragePaths(uniquePaths([...res.frames, ...res.zips]));
    setOutcome(rm.remaining.length === 0
      ? { line: purgeDoneText(res.photos_deleted, res.zips.length), remaining: [] }
      : { line: purgeRemainingText(rm.remaining.length), remaining: rm.remaining });
  };

  const copyRemaining = async () => {
    try {
      await navigator.clipboard.writeText(outcome?.remaining.join('\n') ?? '');
      toast('הנתיבים הועתקו', true);
    } catch {
      toast('ההעתקה נכשלה. סמנו והעתיקו ידנית');
    }
  };

  return (
    <section className={`hud ${styles.card}`} aria-label="מחיקת תמונות הסדנה">
      <h2>מחיקת תמונות הסדנה</h2>
      <p className="hint">
        המחיקה מסירה לצמיתות את כל התמונות שהקבוצות צילמו בסדנה, את התיוגים שלהן ואת קבצי האימון מהאחסון.
        התעודות, המודלים שאושרו, הקבוצות והמשתתפים נשארים כפי שהם. אי אפשר לבטל את הפעולה.
      </p>
      <div className="row">
        <ConfirmButton label="מחיקת תמונות הסדנה" tone="danger"
          confirmText="למחוק את כל תמונות הסדנה וקבצי האימון? התעודות נשארות." onConfirm={run} />
        {outcome ? <span role="status" className={outcome.remaining.length === 0 ? 'ink' : 'err'}>{outcome.line}</span> : null}
      </div>
      {outcome && outcome.remaining.length > 0 ? (
        <div className="stack">
          <textarea readOnly rows={6} dir="ltr" value={outcome.remaining.join('\n')} aria-label="נתיבים שלא נמחקו" />
          <button type="button" className="sm" onClick={() => void copyRemaining()}>העתקת הנתיבים</button>
        </div>
      ) : null}
    </section>
  );
}
