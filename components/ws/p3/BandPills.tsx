// Pills and inline rule notes for band / cycle depth / device / release status, shared by the
// workshop header, the new-workshop template picker, the settings card and the curriculum screens.
import type { RuleNote } from '@/lib/ws/device-rules';
import { poolScopePillLabel } from '@/lib/ws/pool-scope';
import type { Band, CycleDepth, DeviceMode, PoolScope, ReleaseStatus } from '@/lib/ws/types';
import { Pill } from '../StatusPill';
import {
  BAND_LABELS, CYCLE_DEPTH_SHORT_LABELS, DEVICE_SHORT_LABELS, RELEASE_STATUS_LABELS, RELEASE_STATUS_TONES,
} from './options';
import styles from './p3.module.css';

export const BandPill = ({ band }: { band: Band | null }) =>
  band ? <Pill label={BAND_LABELS[band]} tone="navy" /> : null;

export const DepthPill = ({ depth }: { depth: CycleDepth | null }) =>
  depth ? <Pill label={CYCLE_DEPTH_SHORT_LABELS[depth]} tone="teal" /> : null;

export const DevicePill = ({ device }: { device: DeviceMode | null }) =>
  device ? <Pill label={DEVICE_SHORT_LABELS[device]} tone="gray" /> : null;

/** `live` is the normal state, so it stays quiet unless `always` is set. */
export const ReleasePill = ({ status, always = false }: { status: ReleaseStatus; always?: boolean }) =>
  status === 'live' && !always ? null : <Pill label={RELEASE_STATUS_LABELS[status]} tone={RELEASE_STATUS_TONES[status]} />;

/** 'אישי' or 'קבוצתי' (migration 0016): who shares the photo pool and the model. */
export const PoolScopePill = ({ scope }: { scope: PoolScope }) =>
  <Pill label={poolScopePillLabel(scope)} tone="outline" />;

/** band · depth · device · pool scope in one row (the workshop header). */
export function WorkshopPills({ band, depth, device, poolScope }: {
  band: Band | null; depth: CycleDepth; device: DeviceMode; poolScope?: PoolScope;
}) {
  return (
    <>
      <BandPill band={band} />
      <DepthPill depth={depth} />
      <DevicePill device={device} />
      {poolScope ? <PoolScopePill scope={poolScope} /> : null}
    </>
  );
}

const NOTE_CLASS: Record<RuleNote['level'], string> = {
  error: styles.noteError, warning: styles.noteWarn, info: styles.noteInfo,
};

/** Legality notes from lib/ws/device-rules; 'error' ones block the save. Renders nothing when the list is empty. */
export function RuleNotes({ notes }: { notes: readonly RuleNote[] }) {
  if (notes.length === 0) return null;
  const blocking = notes.some((n) => n.level === 'error');
  return (
    <ul className={styles.notes} role={blocking ? 'alert' : 'status'}>
      {notes.map((n) => <li key={n.text} className={NOTE_CLASS[n.level]}>{n.text}</li>)}
    </ul>
  );
}
