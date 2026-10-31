'use client';
import { toast } from '@/lib/store';
import { STUDENT_URL, joinCopyText, joinLine } from '@/lib/student-app';
import type { WorkshopStatus } from '@/lib/ws/types';
import styles from './join-info.module.css';

export const CODE_INACTIVE_HINT = 'הקוד יפעל רק אחרי פתיחת הסדנה';

interface JoinInfoProps {
  code: string;
  /** students can only join a live workshop; any other status shows the hint under the code */
  status?: WorkshopStatus;
}

/** Workshop code + student app url together, with a copy button (what a teacher tells the class). */
export function JoinInfo({ code, status }: JoinInfoProps) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinCopyText(code, STUDENT_URL));
      toast('הקישור והקוד הועתקו', true);
    } catch {
      toast('ההעתקה נכשלה. סמנו והעתיקו ידנית');
    }
  };
  const inactive = status !== undefined && status !== 'live';
  return (
    <span className={styles.join}>
      <span dir="auto">{joinLine(code, STUDENT_URL)}</span>
      <button type="button" className="sm" onClick={() => void copy()}>העתקה</button>
      {inactive ? <span className={styles.inactive} role="status">{CODE_INACTIVE_HINT}</span> : null}
    </span>
  );
}
