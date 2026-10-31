'use client';
import { bumpData, toast } from '@/lib/store';
import { STUDENT_URL, joinLine } from '@/lib/student-app';
import type { WorkshopStatus } from '@/lib/ws/types';
import {
  COPIED_TOAST, ROTATED_TOAST, ROTATE_CONFIRM, ROTATE_LABEL, STUDENT_STEPS, TELL_STUDENTS, fullCodeLine,
  isWorkshopNumber, joinCopyTextWithNumber,
} from '@/lib/ws/workshop-number';
import { rotateShortCode } from '@/lib/ws/workshops';
import { ConfirmButton } from './ConfirmButton';
import styles from './join-info.module.css';

export const CODE_INACTIVE_HINT = 'הקוד יפעל רק אחרי פתיחת הסדנה';

interface JoinInfoProps {
  code: string;
  /** the 4-digit workshop number (0015); null until the workshop is confirmed or live */
  shortCode?: string | null;
  /** students can only join a live workshop; any other status shows the hint under the code */
  status?: WorkshopStatus;
  /** needed for "מספר חדש"; the button shows only when `canRotate` is set (admin / instructor) */
  workshopId?: string;
  canRotate?: boolean;
  /** called with the new number after a rotation (the caller patches its local row) */
  onRotated?: (shortCode: string) => void;
}

/**
 * What a teacher tells the class. With a number: "אמרו לתלמידים: 1357" huge, the three-step instruction,
 * and the full code + url on a smaller second line. Without one (draft, closed): the old code + url line.
 */
export function JoinInfo({ code, shortCode = null, status, workshopId, canRotate = false, onRotated }: JoinInfoProps) {
  const number = isWorkshopNumber(shortCode) ? shortCode : null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinCopyTextWithNumber(code, number, STUDENT_URL));
      toast(number ? COPIED_TOAST : 'הקישור והקוד הועתקו', true);
    } catch {
      toast('ההעתקה נכשלה. סמנו והעתיקו ידנית');
    }
  };
  // ConfirmButton toasts a thrown error; the RPC's raw text is replaced with a friendly one
  const rotate = async () => {
    if (!workshopId) return;
    let next: string;
    try {
      next = await rotateShortCode(workshopId);
    } catch {
      throw new Error('החלפת מספר הסדנה נכשלה');
    }
    toast(ROTATED_TOAST, true);
    onRotated?.(next);
    bumpData();
  };
  const inactive = status !== undefined && status !== 'live';
  const hint = inactive ? <span className={styles.inactive} role="status">{CODE_INACTIVE_HINT}</span> : null;

  if (!number) {
    return (
      <span className={styles.join}>
        <span dir="auto">{joinLine(code, STUDENT_URL)}</span>
        <button type="button" className="sm" onClick={() => void copy()}>העתקה</button>
        {hint}
      </span>
    );
  }
  return (
    <div className={styles.joinNumber}>
      <div className={styles.tell}>
        <span className={styles.tellLabel}>{TELL_STUDENTS}</span>
        <b dir="ltr" className={styles.number}>{number}</b>
        <button type="button" className="sm" onClick={() => void copy()}>העתקה</button>
        {canRotate && workshopId
          ? <ConfirmButton label={ROTATE_LABEL} confirmText={ROTATE_CONFIRM} small onConfirm={rotate} />
          : null}
      </div>
      <p className={styles.steps}>{STUDENT_STEPS}</p>
      <span className={styles.secondary} dir="auto">{fullCodeLine(code, STUDENT_URL)}</span>
      {hint}
    </div>
  );
}
