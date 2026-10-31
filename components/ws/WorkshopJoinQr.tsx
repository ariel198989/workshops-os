import { QrCode } from '@/components/ws/QrCode';
import { STUDENT_URL } from '@/lib/student-app';
import { CLASS_QR_HINT, CLASS_QR_TITLE } from '@/lib/ws/group-access';
import { NUMBER_LABEL, isWorkshopNumber, studentJoinUrl } from '@/lib/ws/workshop-number';
import { CODE_INACTIVE_HINT } from './JoinInfo';
import styles from './join-info.module.css';

export const CLASS_QR_SIZE = 320;
export const CLASS_QR_CLOSED = `${CODE_INACTIVE_HINT}. פתחו את הסדנה בכפתור הסטטוס, ואז ה-QR יופיע כאן.`;

interface WorkshopJoinQrProps {
  code: string;
  /** the 4-digit workshop number (0015); when set the QR carries it and it is shown large under the QR */
  shortCode?: string | null;
  /** students can only join a live workshop; closed shows the explanation instead of a QR */
  live: boolean;
  /** CSS px, default 320 */
  size?: number;
  /** render the title inside (projector); the drawer already shows it as its header */
  heading?: boolean;
}

/** The class-wide join QR (<student url>/join?code=<number or code>): for students with their own phone and account. */
export function WorkshopJoinQr({ code, shortCode = null, live, size = CLASS_QR_SIZE, heading = false }: WorkshopJoinQrProps) {
  if (!live) return <p className={styles.closed} role="status">{CLASS_QR_CLOSED}</p>;
  const number = isWorkshopNumber(shortCode) ? shortCode : null;
  return (
    <div className={styles.classQr}>
      {heading ? <h3 className={styles.classTitle}>{CLASS_QR_TITLE}</h3> : null}
      <QrCode value={studentJoinUrl(code, number, STUDENT_URL)} size={size} label={`קוד QR להצטרפות לסדנה ${number ?? code}`} />
      {number ? (
        <>
          <div className={styles.classNumber}><span>{NUMBER_LABEL}</span><b dir="ltr">{number}</b></div>
          <code dir="ltr" className={styles.classCodeSmall}>{code}</code>
        </>
      ) : <code dir="ltr" className={styles.classCode}>{code}</code>}
      <p className={styles.classHint}>{CLASS_QR_HINT}</p>
    </div>
  );
}
