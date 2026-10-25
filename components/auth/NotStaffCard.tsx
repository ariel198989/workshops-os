'use client';
import { logout } from '@/lib/auth';
import { STUDENT_URL } from '@/lib/student-app';
import styles from './auth.module.css';

/** Signed in but not a staff member (a student or an unknown account): send them to the student app. */
export function NotStaffCard() {
  return (
    <div className="center-screen">
      <div className="hud denied">
        <h1>האזור הזה מיועד לצוות Corewise</h1>
        <p className="muted">תלמידים נכנסים לאפליקציית התלמידים</p>
        <div className="page-actions">
          <a href={STUDENT_URL} className={styles.primaryLink}>לאפליקציית התלמידים</a>
          <button type="button" onClick={() => void logout()}>התנתקות</button>
        </div>
      </div>
    </div>
  );
}
