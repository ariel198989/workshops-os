'use client';
import { toast } from '@/lib/store';
import { STUDENT_URL, joinCopyText, joinLine } from '@/lib/student-app';
import styles from './join-info.module.css';

/** Workshop code + student app url together, with a copy button (what a teacher tells the class). */
export function JoinInfo({ code }: { code: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinCopyText(code, STUDENT_URL));
      toast('הקישור והקוד הועתקו', true);
    } catch {
      toast('ההעתקה נכשלה. סמנו והעתיקו ידנית');
    }
  };
  return (
    <span className={styles.join}>
      <span dir="auto">{joinLine(code, STUDENT_URL)}</span>
      <button type="button" className="sm" onClick={() => void copy()}>העתקה</button>
    </span>
  );
}
