'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Logout01Icon } from '@hugeicons/core-free-icons';
import { authStore, logout } from '@/lib/auth';
import { visibleNavItems, isActive } from '@/lib/nav';
import { roleLabel } from '@/lib/shell-access';
import { useStore } from '@/lib/store';
import { wsAuthStore } from '@/lib/ws/staff';
import { MobileNav } from './shell/MobileNav';
import { NAV_ICONS } from './shell/nav-icons';

function Sidebar() {
  const pathname = usePathname();
  const { user } = useStore(authStore);
  const { whoami } = useStore(wsAuthStore);
  const role = whoami?.staff?.role ?? null;
  const email = user?.email ?? '';

  return (
    <aside className="sidebar">
      <div className="side-logo">
        <span className="wordmark">Workshops OS</span>
        <span className="by">by Corewise</span>
      </div>
      <nav className="nav" aria-label="ניווט ראשי">
        {visibleNavItems(role).map((item) => {
          const on = isActive(pathname, item.href);
          return (
            <Link key={item.id} href={item.href} title={item.label}
              className={on ? 'nav-item on' : 'nav-item'} aria-current={on ? 'page' : undefined}>
              <HugeiconsIcon icon={NAV_ICONS[item.id]} size={19} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="side-user">
        <span className="avatar" aria-hidden="true">{email.charAt(0) || '?'}</span>
        <div className="who">
          <b dir="ltr">{email.split('@')[0]}</b>
          <span>{roleLabel(role)}</span>
        </div>
        <button className="ghost sm" onClick={() => void logout()} title="התנתקות" aria-label="התנתקות">
          <HugeiconsIcon icon={Logout01Icon} size={17} />
        </button>
      </div>
    </aside>
  );
}

/** Desktop: sidebar + content. Phone (<= 640px): the sidebar is hidden and MobileNav provides a bottom tab bar. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <Sidebar />
      <main className="content">{children}</main>
      <MobileNav />
    </div>
  );
}
