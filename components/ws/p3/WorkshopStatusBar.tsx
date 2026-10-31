'use client';
import { setWorkshopStatus } from '@/lib/ws/workshops';
import type { WsWorkshop } from '@/lib/ws/types';
import { ConfirmButton } from '../ConfirmButton';
import { withFriendlyError } from './db-errors';
import { NEEDS_GROUPS_HINT, needsGroupsFirst, statusActions } from './workshop-utils';
import styles from './p3.module.css';

interface WorkshopStatusBarProps {
  workshop: WsWorkshop;
  admin: boolean;
  /** null while loading; 0 keeps "פתיחת הסדנה" disabled because going live only activates existing groups */
  groupCount: number | null;
  onChanged: (next: WsWorkshop) => void;
}

/** Transition buttons for the current status (plan B). Each goes through ws_set_workshop_status. */
export function WorkshopStatusBar({ workshop, admin, groupCount, onChanged }: WorkshopStatusBarProps) {
  const actions = statusActions(workshop.status, admin);
  if (actions.length === 0) return null;
  return (
    <div className={styles.statusBar} role="group" aria-label="שינוי סטטוס">
      {actions.map((a) => {
        const blocked = needsGroupsFirst(a, groupCount);
        return (
          <ConfirmButton key={a.to} label={a.label} confirmText={a.confirm} tone={a.tone}
            disabled={blocked} hint={blocked ? NEEDS_GROUPS_HINT : undefined}
            onConfirm={async () => onChanged(await withFriendlyError(() => setWorkshopStatus(workshop.id, a.to)))} />
        );
      })}
    </div>
  );
}
