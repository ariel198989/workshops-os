'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Logout01Icon, MoreHorizontalIcon } from '@hugeicons/core-free-icons';
import { authStore, logout } from '@/lib/auth';
import { isActive, mobileLabel, splitMobileNav, visibleNavItems } from '@/lib/nav';
import { roleLabel } from '@/lib/shell-access';
import { useStore } from '@/lib/store';
import { wsAuthStore } from '@/lib/ws/staff';
import { NAV_ICONS } from './nav-icons';
import styles from './mobile-nav.module.css';

const MORE_LABEL = 'עוד';

/**
 * Phone navigation: a 56px bottom tab bar with the four main sections and "עוד",
 * which opens a bottom sheet with the remaining sections, the signed-in user and logout.
 * Hidden above the phone breakpoint by CSS; the desktop sidebar is hidden below it.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { user } = useStore(authStore);
  const { whoami } = useStore(wsAuthStore);
  const role = whoami?.staff?.role ?? null;
  const email = user?.email ?? '';
  const [open, setOpen] = useState(false);
  const { primary, more } = splitMobileNav(visibleNavItems(role));
  const moreOn = more.some((item) => isActive(pathname, item.href));

  // navigating (from the sheet or anywhere else) closes the sheet
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <nav className={styles.bar} aria-label="ניווט ראשי">
        {primary.map((item) => {
          const on = isActive(pathname, item.href);
          return (
            <Link key={item.id} href={item.href} className={on ? `${styles.item} ${styles.on}` : styles.item}
              aria-current={on ? 'page' : undefined}>
              <HugeiconsIcon icon={NAV_ICONS[item.id]} size={22} />
              <span>{mobileLabel(item)}</span>
            </Link>
          );
        })}
        <button type="button" className={moreOn || open ? `${styles.item} ${styles.on}` : styles.item}
          aria-expanded={open} aria-controls="mobile-more" onClick={() => setOpen((v) => !v)}>
          <HugeiconsIcon icon={MoreHorizontalIcon} size={22} />
          <span>{MORE_LABEL}</span>
        </button>
      </nav>

      {open ? (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} aria-hidden="true" />
          <div id="mobile-more" className={styles.sheet} role="dialog" aria-modal="true" aria-label={MORE_LABEL}>
            <div className={styles.sheetHead}>
              <span className="wordmark">Workshops OS</span>
              <button type="button" className="ghost" onClick={() => setOpen(false)}>סגירה</button>
            </div>
            <ul className={styles.sheetList}>
              {more.map((item) => {
                const on = isActive(pathname, item.href);
                return (
                  <li key={item.id}>
                    <Link href={item.href} className={on ? `${styles.sheetItem} ${styles.on}` : styles.sheetItem}
                      aria-current={on ? 'page' : undefined}>
                      <HugeiconsIcon icon={NAV_ICONS[item.id]} size={20} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className={styles.sheetUser}>
              <span className="avatar" aria-hidden="true">{email.charAt(0) || '?'}</span>
              <div className={styles.who}>
                <b dir="ltr">{email.split('@')[0]}</b>
                <span>{roleLabel(role)}</span>
              </div>
              <button type="button" className="ghost" onClick={() => void logout()}>
                <HugeiconsIcon icon={Logout01Icon} size={17} />
                התנתקות
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
