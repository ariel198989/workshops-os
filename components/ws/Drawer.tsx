'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import styles from './ws.module.css';

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** CSS width, default 440px */
  width?: string;
  children: ReactNode;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Keeps Tab / Shift+Tab inside `root` (a modal dialog). Returns true when it handled the key. */
export function trapTab(e: KeyboardEvent, root: HTMLElement): boolean {
  if (e.key !== 'Tab') return false;
  const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
  if (items.length === 0) {
    e.preventDefault();
    root.focus();
    return true;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === root || !root.contains(active))) {
    e.preventDefault();
    last.focus();
    return true;
  }
  if (!e.shiftKey && (active === last || !root.contains(active))) {
    e.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

/** Detail panel that slides in from the LEFT edge (the far side in RTL). Esc and backdrop close it; Tab stays inside. */
export function Drawer({ open, title, onClose, width = '440px', children }: DrawerProps) {
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<Element | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      else if (panel.current) trapTab(e, panel.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <aside ref={panel} className={styles.drawer} style={{ width }} role="dialog" aria-modal="true"
        aria-label={title} tabIndex={-1}>
        <header className={styles.drawerHead}>
          <h2>{title}</h2>
          <button type="button" className="ghost sm" onClick={onClose} aria-label="סגירה">סגירה</button>
        </header>
        <div className={styles.drawerBody}>{children}</div>
        {/* phone only (CSS): a second close control within thumb reach at the bottom of the sheet */}
        <footer className={styles.drawerFoot}>
          <button type="button" onClick={onClose}>סגירה</button>
        </footer>
      </aside>
    </>
  );
}
