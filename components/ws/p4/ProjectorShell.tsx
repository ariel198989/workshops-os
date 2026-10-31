'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import type { LiveState } from '@/lib/ws/live';
import styles from './board.module.css';

interface ProjectorShellProps {
  title: string;
  stamp: string | null;
  /** the facilitator's current step, shown large above the groups */
  live?: LiveState | null;
  onExit: () => void;
  children: ReactNode;
}

/** Full-screen overlay for projecting the board to the class. Esc or the exit button leaves. */
export function ProjectorShell({ title, stamp, live = null, onExit, children }: ProjectorShellProps) {
  const exitRef = useRef(onExit);
  useEffect(() => {
    exitRef.current = onExit;
  });

  useEffect(() => {
    // fullscreen is a bonus: browsers may refuse it, the overlay still works
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitRef.current();
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) exitRef.current();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  return (
    <div className={styles.projector} role="dialog" aria-label="מצב מקרן">
      <div className={styles.projHead}>
        <h2>{title}</h2>
        <div className={styles.barEnd}>
          {stamp ? <span className={styles.stamp}>עודכן ב-{stamp}</span> : null}
          <button type="button" onClick={onExit}>יציאה ממצב מקרן</button>
        </div>
      </div>
      {live && (live.label || live.message) ? (
        <div className={styles.projLive} role="status">
          {live.label ? <b>{live.label}</b> : null}
          {live.message ? <span>{live.message}</span> : null}
        </div>
      ) : null}
      <div>{children}</div>
    </div>
  );
}
