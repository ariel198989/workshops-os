// Pills and inline rule notes for band / cycle depth / device / release status, shared by the
// workshop header, the new-workshop template picker, the settings card and the curriculum screens.
import type { RuleNote } from '@/lib/ws/device-rules';
import type { Band, CycleDepth, DeviceMode, ReleaseStatus } from '@/lib/ws/types';
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

/** band · depth · device in one row (the workshop header). */
export function WorkshopPills({ band, depth, device }: { band: Band | null; depth: CycleDepth; device: DeviceMode }) {
  return (
    <>
      <BandPill band={band} />
      <DepthPill depth={depth} />
      <DevicePill device={device} />
    </>
  );
}

/** Non-blocking legality notes from lib/ws/device-rules. Renders nothing when the list is empty. */
export function RuleNotes({ notes }: { notes: readonly RuleNote[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className={styles.notes} role="status">
      {notes.map((n) => (
        <li key={n.text} className={n.level === 'warning' ? styles.noteWarn : styles.noteInfo}>{n.text}</li>
      ))}
    </ul>
  );
}
