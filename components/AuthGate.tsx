'use client';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { authStore, initAuth, login, logout } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { Spinner } from '@/components/ui/Spinner';

function LoginCard() {
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
      setError('פרטי ההתחברות שגויים. נסו שוב.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center-screen">
      <form className="hud login" onSubmit={submit}>
        <img className="login-logo" src="/logo-lockup.png" alt="Corewise" />
        <h1>Workshops OS</h1>
        <p className="hint">כניסה לצוות ההדרכה והניהול</p>
        <label className="field">
          <span className="lbl">אימייל</span>
          <input type="email" autoComplete="email" dir="ltr" required value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="lbl">סיסמה</span>
          <input type="password" autoComplete="current-password" dir="ltr" required value={pass}
            onChange={(e) => setPass(e.target.value)} />
        </label>
        <p className="err" role="alert">{error}</p>
        <button className="primary" type="submit" disabled={busy || !email || !pass}>
          {busy ? <Spinner label="מתחבר" /> : 'כניסה'}
        </button>
      </form>
    </div>
  );
}

function NoAccess({ email }: { email?: string }) {
  return (
    <div className="center-screen">
      <div className="hud denied">
        <h1>אין גישה</h1>
        <p className="muted">
          החשבון <span dir="ltr" className="ink">{email}</span> אינו מורשה לצפות בקונסולה.
        </p>
        <div className="page-actions">
          <button className="primary" onClick={() => void logout()}>התנתקות</button>
        </div>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, admin, loaded } = useStore(authStore);
  useEffect(() => {
    void initAuth();
  }, []);

  if (!loaded) {
    return <div className="center-screen"><Spinner large /></div>;
  }
  if (!user) return <LoginCard />;
  if (!admin) return <NoAccess email={user.email} />;
  return <>{children}</>;
}
