import { QrCode } from '@/components/ws/QrCode';
import { STUDENT_URL } from '@/lib/student-app';
import { CLASS_QR_HINT, CLASS_QR_TITLE, workshopJoinUrl } from '@/lib/ws/group-access';
import { CODE_INACTIVE_HINT } from './JoinInfo';
import styles from './join-info.module.css';

export const CLASS_QR_SIZE = 320;
export const CLASS_QR_CLOSED = `${CODE_INACTIVE_HINT}. פתחו את הסדנה בכפתור הסטטוס, ואז ה-QR יופיע כאן.`;

interface WorkshopJoinQrProps {
  code: string;
  /** students can only join a live workshop; closed shows the explanation instead of a QR */
  live: boolean;
  /** CSS px, default 320 */
  size?: number;
  /** render the title inside (projector); the drawer already shows it as its header */
  heading?: boolean;
}

/** The class-wide join QR (<student url>/join?code=...): for students with their own phone and account. */
export function WorkshopJoinQr({ code, live, size = CLASS_QR_SIZE, heading = false }: WorkshopJoinQrProps) {
  if (!live) return <p className={styles.closed} role="status">{CLASS_QR_CLOSED}</p>;
  return (
    <div className={styles.classQr}>
      {heading ? <h3 className={styles.classTitle}>{CLASS_QR_TITLE}</h3> : null}
      <QrCode value={workshopJoinUrl(STUDENT_URL, code)} size={size} label={`קוד QR להצטרפות לסדנה ${code}`} />
      <code dir="ltr" className={styles.classCode}>{code}</code>
      <p className={styles.classHint}>{CLASS_QR_HINT}</p>
    </div>
  );
}
