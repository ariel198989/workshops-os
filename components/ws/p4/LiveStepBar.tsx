'use client';
import { useMemo, useState } from 'react';
import { toast } from '@/lib/store';
import {
  LIVE_MESSAGE_MAX, LIVE_PRESETS, type LivePreset, type LiveStepInput, liveSummary, messageInput, pickLiveSession, presetInput,
} from '@/lib/ws/live';
import { clearLiveStep, setLiveStep } from '@/lib/ws/live-api';
import type { Overview } from '@/lib/ws/types';
import { listSessionModules } from '@/lib/ws/workshops';
import { formatTime } from './format';
import { errorText, useLoader } from './hooks';
import { LIVE_MODE_LABELS, type LiveHandle } from './useLiveState';
import styles from './board.module.css';

interface LiveStepBarProps {
  workshopId: string;
  sessions: Overview['sessions'];
  canEdit: boolean;
  handle: LiveHandle;
}

/** "עכשיו בכיתה": what the student app should show right now. Staff only; viewers see the saved state. */
export function LiveStepBar({ workshopId, sessions, canEdit, handle }: LiveStepBarProps) {
  const { live, mode, apply } = handle;
  const session = useMemo(() => pickLiveSession(sessions), [sessions]);
  const { data: modules } = useLoader(() => (session ? listSessionModules(session.id) : Promise.resolve([])), session?.id ?? '');
  const [chosenModule, setChosenModule] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const moduleList = modules ?? [];
  const liveModuleInList = live?.session_module_id && moduleList.some((m) => m.id === live.session_module_id) ? live.session_module_id : null;
  const moduleId = chosenModule ?? liveModuleInList;
  const moduleTitle = moduleList.find((m) => m.id === live?.session_module_id)?.title ?? null;

  const send = async (input: LiveStepInput, done: string) => {
    setBusy(true);
    try {
      apply(await setLiveStep(workshopId, input));
      toast(done, true);
    } catch (err) {
      toast(errorText(err, 'עדכון השלב נכשל'));
    } finally {
      setBusy(false);
    }
  };
  const pick = (preset: LivePreset) => send(presetInput(preset, moduleId, message), `עכשיו: ${preset.label}`);
  const sendMessage = () => send(messageInput(live, moduleId, message), 'ההודעה נשלחה');
  const clear = async () => {
    setBusy(true);
    try {
      await clearLiveStep(workshopId);
      apply(null);
      setMessage('');
      toast('השלב נוקה', true);
    } catch (err) {
      toast(errorText(err, 'הניקוי נכשל'));
    } finally {
      setBusy(false);
    }
  };

  const summary = liveSummary(live, moduleTitle);
  return (
    <section className={`hud ${styles.live}`} aria-label="עכשיו בכיתה">
      <header className={styles.liveHead}>
        <h3>עכשיו בכיתה</h3>
        <span className={styles.stamp}>
          {mode === 'realtime' ? <span className={styles.liveDot} aria-hidden="true" /> : null}
          {LIVE_MODE_LABELS[mode]}
        </span>
      </header>
      <p className={styles.liveNow} role="status">
        {summary ? (
          <>
            <b>{summary}</b>
            {live?.message && summary !== live.message ? <span className={styles.liveMsg}>{live.message}</span> : null}
            {live ? <span className={styles.muted}> · עודכן ב-{formatTime(live.updated_at)}</span> : null}
          </>
        ) : <span className={styles.muted}>לא נבחר שלב. התלמידים רואים את המסך הרגיל.</span>}
      </p>
      {canEdit ? (
        <>
          <div className={styles.liveRow}>
            <label className={styles.liveLbl}>
              מודול
              <select value={moduleId ?? ''} onChange={(e) => setChosenModule(e.target.value || null)} disabled={moduleList.length === 0}>
                <option value="">{session ? `מפגש ${session.session_no}: ללא מודול` : 'אין מפגש פתוח'}</option>
                {moduleList.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </label>
            <div className={styles.liveBtns} role="group" aria-label="שלבים">
              {LIVE_PRESETS.map((p) => (
                <button key={p.key} type="button" className={`sm ${live?.step_key === p.key ? 'primary' : ''}`.trim()}
                  disabled={busy} aria-pressed={live?.step_key === p.key} onClick={() => void pick(p)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.liveRow}>
            <label className={`${styles.liveLbl} ${styles.liveMsgField}`}>
              הודעה לתלמידים
              <input value={message} maxLength={LIVE_MESSAGE_MAX} placeholder="למשל: מסיימים בעוד 5 דקות"
                onChange={(e) => setMessage(e.target.value)} />
            </label>
            <button type="button" className="sm" disabled={busy || message.trim() === ''} onClick={() => void sendMessage()}>שליחת הודעה</button>
            <button type="button" className="ghost sm" disabled={busy || !live} onClick={() => void clear()}>ניקוי</button>
          </div>
        </>
      ) : null}
    </section>
  );
}
