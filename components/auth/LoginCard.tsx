'use client';
import { useState, type FormEvent } from 'react';
import { login } from '@/lib/auth';
import { STUDENT_URL } from '@/lib/student-app';
import styles from './auth.module.css';

/** Signed-out screen: staff sign in only. Students are pointed at the student app. */
export function LoginCard() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), pass);
    } catch {
      setError('האימייל או הסיסמה לא נכונים. נסו שוב');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center-screen">
      <div className={`hud ${styles.card}`}>
        <h1 className="wordmark">Workshops OS</h1>
        <p className="by">by Corewise</p>
        <h2 className={styles.title}>כניסת צוות</h2>
        <form onSubmit={submit}>
          <label className={styles.field}>
            <span className="lbl">אימייל</span>
            <input type="email" autoComplete="email" inputMode="email" dir="ltr" required
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className="lbl">סיסמה</span>
            <input type="password" autoComplete="current-password" dir="ltr" required
              value={pass} onChange={(e) => setPass(e.target.value)} />
          </label>
          <p className="err" role="alert">{error}</p>
          <button type="submit" className={`primary ${styles.full}`} disabled={busy || !email || !pass}>
            {busy ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>
        <p className={`hint ${styles.studentLine}`}>
          תלמיד/ה? <a href={STUDENT_URL}>ההרשמה באפליקציית התלמידים</a>
        </p>
      </div>
    </div>
  );
}
