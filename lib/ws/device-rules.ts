// Band → defaults and legality notes for devices and cycle depth (pure, unit tested).
// Notes never block a save: the DB check constraints are the only hard gate.
import type { Band, CycleDepth, DeviceMode } from './types';

export type RuleLevel = 'warning' | 'info';
export interface RuleNote { level: RuleLevel; text: string }
export interface DeviceRuleInput { band: Band | null; cycleDepth: CycleDepth; deviceMode: DeviceMode }

export const DEFAULT_DEVICE_BY_BAND: Record<Band, DeviceMode> = {
  'a-b': 'facilitator_screen_only', 'c-d': 'school_tablet_capture_only', 'e-f': 'school_tablet_teacher_controlled',
  'g-i': 'school_tablet_or_lab_pc', 'j-l': 'laptop_plus_phone', teachers: 'adult_laptop', corporate: 'adult_laptop',
  municipal: 'school_tablet_or_lab_pc',
};
export const DEFAULT_DEPTH_BY_BAND: Record<Band, CycleDepth> = {
  'a-b': 'L0', 'c-d': 'L1', 'e-f': 'L2', 'g-i': 'L3', 'j-l': 'L4', teachers: 'L3', corporate: 'L3', municipal: 'L3',
};

/** Shown first in the device select, default first; everything else follows in a second group. */
export const RECOMMENDED_DEVICES_BY_BAND: Record<Band, readonly DeviceMode[]> = {
  'a-b': ['facilitator_screen_only'],
  'c-d': ['school_tablet_capture_only', 'facilitator_screen_only'],
  'e-f': ['school_tablet_teacher_controlled', 'school_tablet_capture_only', 'facilitator_screen_only'],
  'g-i': ['school_tablet_or_lab_pc', 'school_tablet_teacher_controlled', 'teacher_laptop_offline_lan'],
  'j-l': ['laptop_plus_phone', 'school_tablet_or_lab_pc', 'teacher_laptop_offline_lan'],
  teachers: ['adult_laptop', 'laptop_plus_phone'],
  corporate: ['adult_laptop', 'laptop_plus_phone'],
  municipal: ['school_tablet_or_lab_pc', 'travelling_kit', 'adult_laptop'],
};

export const DEPTH_RANK: Record<CycleDepth, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };

const ELEMENTARY: readonly Band[] = ['a-b', 'c-d', 'e-f'];
const LOWER_ELEMENTARY: readonly Band[] = ['a-b', 'c-d'];
const PERSONAL_PHONE: readonly DeviceMode[] = ['own_phones', 'byod_phone_approved_lesson', 'laptop_plus_phone'];
const PHONE_ONLY: readonly DeviceMode[] = ['own_phones', 'byod_phone_approved_lesson'];

export const NO_PHONES_ELEMENTARY = 'אין טלפונים אישיים ביסודי (חוזר 2.2.2026). בחרו טאבלט בית ספרי או מכשיר המדריך.';
export const PHONES_MIDDLE_APPROVAL = 'בחט״ב טלפון רק בשיעור ייעודי באישור כתוב של המנהל (מתשפ״ז).';
export const L0_NO_STUDENT_DEVICE = 'ב-L0 אין מכשיר בידי התלמידים; האפליקציה משמשת רק את המדריך.';
export const NO_AI_TOOLS_LOWER_ELEMENTARY = 'כיתות א-ד: אין כלי AI בידי תלמידים (הנחיות משרד החינוך). מומלץ L0/L1.';

export const defaultDeviceForBand = (band: Band | null): DeviceMode | null => (band ? DEFAULT_DEVICE_BY_BAND[band] : null);
export const defaultDepthForBand = (band: Band | null): CycleDepth | null => (band ? DEFAULT_DEPTH_BY_BAND[band] : null);

/** Devices split into the band's recommended list (default first) and the rest, in the given order. */
export function groupDevices(
  band: Band | null, all: readonly DeviceMode[],
): { recommended: DeviceMode[]; other: DeviceMode[] } {
  const rec = band ? RECOMMENDED_DEVICES_BY_BAND[band] : [];
  return { recommended: [...rec], other: all.filter((d) => !rec.includes(d)) };
}

export function deviceRuleNotes({ band, cycleDepth, deviceMode }: DeviceRuleInput): RuleNote[] {
  const notes: RuleNote[] = [];
  if (band && ELEMENTARY.includes(band) && PERSONAL_PHONE.includes(deviceMode)) {
    notes.push({ level: 'warning', text: NO_PHONES_ELEMENTARY });
  }
  if (band === 'g-i' && PHONE_ONLY.includes(deviceMode)) {
    notes.push({ level: 'warning', text: PHONES_MIDDLE_APPROVAL });
  }
  if (cycleDepth === 'L0' && deviceMode !== 'facilitator_screen_only') {
    notes.push({ level: 'info', text: L0_NO_STUDENT_DEVICE });
  }
  if (band && LOWER_ELEMENTARY.includes(band) && DEPTH_RANK[cycleDepth] >= DEPTH_RANK.L2) {
    notes.push({ level: 'warning', text: NO_AI_TOOLS_LOWER_ELEMENTARY });
  }
  return notes;
}

export interface TemplatePrefillSource {
  band: Band | null; cycle_depth: CycleDepth | null; default_device_mode: DeviceMode | null;
}
export interface Prefill { band: Band | null; cycleDepth: CycleDepth; deviceMode: DeviceMode }

/** Template values win; missing ones fall back to the band defaults, then to the current form values. */
export function prefillFromTemplate(tpl: TemplatePrefillSource, current: Prefill): Prefill {
  const band = tpl.band ?? current.band;
  return {
    band,
    cycleDepth: tpl.cycle_depth ?? defaultDepthForBand(band) ?? current.cycleDepth,
    deviceMode: tpl.default_device_mode ?? defaultDeviceForBand(band) ?? current.deviceMode,
  };
}

/** A band change re-derives depth and device from the band table (the user can still override after). */
export function prefillFromBand(band: Band | null, current: Prefill): Prefill {
  return {
    band,
    cycleDepth: defaultDepthForBand(band) ?? current.cycleDepth,
    deviceMode: defaultDeviceForBand(band) ?? current.deviceMode,
  };
}
