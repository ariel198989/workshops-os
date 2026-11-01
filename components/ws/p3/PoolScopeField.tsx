'use client';
import { POOL_SCOPE_OPTIONS, POOL_SCOPE_QUESTION } from '@/lib/ws/pool-scope';
import type { PoolScope } from '@/lib/ws/types';
import styles from './p3.module.css';

interface PoolScopeFieldProps {
  value: PoolScope;
  disabled?: boolean;
  onChange: (next: PoolScope) => void;
}

/** Two-option segmented control (personal / group pool) with a one-line help text for the chosen option.
 *  Shared by the new-workshop form and the settings card. */
export function PoolScopeField({ value, disabled = false, onChange }: PoolScopeFieldProps) {
  const current = POOL_SCOPE_OPTIONS.find((o) => o.value === value) ?? POOL_SCOPE_OPTIONS[0];
  return (
    <div>
      <div className={styles.seg} role="radiogroup" aria-label={POOL_SCOPE_QUESTION}>
        {POOL_SCOPE_OPTIONS.map((o) => {
          const on = o.value === value;
          return (
            <button key={o.value} type="button" role="radio" aria-checked={on} disabled={disabled}
              className={on ? styles.segOn : undefined} onClick={() => { if (!on) onChange(o.value); }}>
              {o.label}
            </button>
          );
        })}
      </div>
      <p className={styles.segHelp}>{current.help}</p>
    </div>
  );
}
