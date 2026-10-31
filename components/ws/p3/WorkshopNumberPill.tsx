'use client';
import { toast } from '@/lib/store';
import type { WorkshopStatus } from '@/lib/ws/types';
import { COPIED_TOAST, NUMBER_HINT, NUMBER_LABEL, NUMBER_PENDING, isWorkshopNumber } from '@/lib/ws/workshop-number';
import styles from './p3.module.css';

interface WorkshopNumberPillProps {
  shortCode: string | null;
  status: WorkshopStatus;
}

const PENDING_STATUSES: readonly WorkshopStatus[] = ['draft', 'proposal'];

/**
 * Header pill with the 4-digit number the facilitator reads out to the class. Larger than the other pills,
 * monospace and ltr so the digits never flip, with a copy button. Draft/proposal explain when it arrives.
 */
export function WorkshopNumberPill({ shortCode, status }: WorkshopNumberPillProps) {
  if (!isWorkshopNumber(shortCode)) {
    return PENDING_STATUSES.includes(status) ? <span className={styles.numberPending}>{NUMBER_PENDING}</span> : null;
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shortCode);
      toast(COPIED_TOAST, true);
    } catch {
      toast('ההעתקה נכשלה. סמנו והעתיקו ידנית');
    }
  };
  return (
    <>
      <span className={styles.numberPill} title={NUMBER_HINT}>
        <span>{NUMBER_LABEL}:</span>
        <b dir="ltr">{shortCode}</b>
        <button type="button" className="sm ghost" onClick={() => void copy()} aria-label="העתקת מספר הסדנה">העתקה</button>
      </span>
      <span className={styles.numberHint}>{NUMBER_HINT}</span>
    </>
  );
}
