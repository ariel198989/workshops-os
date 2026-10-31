'use client';
import type { MoveTarget } from './groups-utils';
import styles from './board.module.css';

interface MemberMoveSelectProps {
  name: string;
  targets: readonly MoveTarget[];
  onMove: (groupId: string | null) => void;
}

const NONE = '__none__';

/**
 * Phone fallback for drag and drop: a select that moves the student to another group (or out of any group).
 * Rendered always, shown only on coarse pointers by CSS; HTML5 DnD stays the mouse path.
 */
export function MemberMoveSelect({ name, targets, onMove }: MemberMoveSelectProps) {
  if (targets.length === 0) return null;
  return (
    <select className={styles.moveSel} value="" aria-label={`העברה של ${name} ל...`}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '') return;
        onMove(v === NONE ? null : v);
      }}>
      <option value="">העברה ל...</option>
      {targets.map((t) => <option key={t.id ?? NONE} value={t.id ?? NONE}>{t.label}</option>)}
    </select>
  );
}
