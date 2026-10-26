'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './ws.module.css';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface TabStripProps {
  /** e.g. /workshops/<id>; each tab links to `${base}/${tab.id}` */
  base: string;
  tabs: readonly TabItem[];
  active: string;
}

export function TabStrip({ base, tabs, active }: TabStripProps) {
  const nav = useRef<HTMLElement>(null);

  // phone: the strip scrolls horizontally, so bring the active chip into view when it changes
  useEffect(() => {
    const el = nav.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    el.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [active]);

  return (
    <nav ref={nav} className={styles.tabs} aria-label="לשוניות">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <Link key={t.id} href={`${base}/${t.id}`} className={`${styles.tab} ${on ? styles.tabOn : ''}`}
            aria-current={on ? 'page' : undefined}>
            {t.label}
            {t.count !== undefined ? <span className={styles.tabCount}>{t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
