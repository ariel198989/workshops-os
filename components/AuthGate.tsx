'use client';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { authStore, initAuth, login, logout } from '@/lib/auth';
import { sb } from '@/lib/db';
import { hasConsoleAccess, type Whoami } from '@/lib/shell-access';
import { createStore, useStore } from '@/lib/store';
import { Spinner } from '@/components/ui/Spinner';

/** Temporary shell-local copy of ws_whoami; the lib/ws store is canonical once it lands. */
export const shellAuthStore = createStore<{ whoami: Whoami | null; loaded: boolean }>({
  whoami: null,
  loaded: false,
});

let whoamiRequested = false;

async function loadWhoami(): Promise<void> {
  if (whoamiRequested) return;
  whoamiRequested = true;
  try {
    // 42883 (function missing) and any other error fail closed to no-access
    const { data, error } = await sb.rpc('ws_whoami');
    shellAuthStore.set({ whoami: error ? null : (data as Whoami | null), loaded: true });
  } catch {
    shellAuthStore.set({ whoami: null, loaded: true });
  }
}

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
        <h1 className="wordmark">Workshops OS</h1>
        <p className="by">by Corewise</p>
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
  const { user, loaded } = useStore(authStore);
  const { whoami, loaded: whoamiLoaded } = useStore(shellAuthStore);
  const userId = user?.id;
  useEffect(() => {
    void initAuth();
  }, []);
  useEffect(() => {
    if (userId) void loadWhoami();
  }, [userId]);

  if (!loaded || (user && !whoamiLoaded)) {
    return <div className="center-screen"><Spinner large /></div>;
  }
  if (!user) return <LoginCard />;
  if (!hasConsoleAccess(whoami)) return <NoAccess email={user.email} />;
  return <>{children}</>;
}
