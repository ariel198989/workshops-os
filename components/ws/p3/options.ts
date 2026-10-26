// Hebrew option lists shared by the P3 screens (orgs, workshops, staff, field definitions).
import type { InlineOption } from '../InlineEdit';
import type {
  Band, CycleDepth, DeviceMode, FieldEntity, FieldType, OrgKind, OrgStatus, ReleaseStatus, StaffRole,
  WorkshopFormat, WorkshopRole,
} from '../../../lib/ws/types';
import type { PillTone } from '../../../lib/ws/labels';

const opts = <T extends string>(map: Record<T, string>): InlineOption[] =>
  (Object.keys(map) as T[]).map((value) => ({ value, label: map[value] }));

export const ORG_KIND_LABELS: Record<OrgKind, string> = {
  school: 'בית ספר', company: 'חברה', municipality: 'רשות', ngo: 'עמותה', other: 'אחר',
};
export const ORG_STATUS_LABELS: Record<OrgStatus, string> = {
  lead: 'ליד', active: 'פעיל', paused: 'מושהה', archived: 'בארכיון',
};
export const FORMAT_LABELS: Record<WorkshopFormat, string> = {
  sessions: '6 מפגשים', hackathon: 'האקתון יום', custom: 'מותאם',
};
export const DEVICE_LABELS: Record<DeviceMode, string> = {
  own_phones: 'טלפונים אישיים (ישן)', tablets_addon: 'טאבלטים (ישן)', mixed: 'משולב (ישן)',
  facilitator_screen_only: 'מכשיר המדריך בלבד',
  school_tablet_capture_only: 'טאבלט בית ספרי לצילום בלבד, המדריך מאמן',
  school_tablet_teacher_controlled: 'טאבלט נעול בשליטת מורה',
  school_tablet_or_lab_pc: 'טאבלט או מחשב בית ספרי',
  byod_phone_approved_lesson: 'טלפון אישי בשיעור ייעודי (אישור מנהל בכתב)',
  laptop_plus_phone: 'לפטופ וטלפון',
  teacher_laptop_offline_lan: 'שרת כיתה אופליין',
  travelling_kit: 'ערכה נודדת',
  adult_laptop: 'לפטופ (מבוגרים)',
};
/** Header pills: the same modes in a few words. */
export const DEVICE_SHORT_LABELS: Record<DeviceMode, string> = {
  own_phones: 'טלפונים אישיים', tablets_addon: 'טאבלטים', mixed: 'משולב',
  facilitator_screen_only: 'מכשיר המדריך', school_tablet_capture_only: 'טאבלט לצילום',
  school_tablet_teacher_controlled: 'טאבלט נעול', school_tablet_or_lab_pc: 'טאבלט / מחשב בית ספרי',
  byod_phone_approved_lesson: 'טלפון אישי באישור', laptop_plus_phone: 'לפטופ וטלפון',
  teacher_laptop_offline_lan: 'שרת כיתה', travelling_kit: 'ערכה נודדת', adult_laptop: 'לפטופ',
};
export const CYCLE_DEPTH_LABELS: Record<CycleDepth, string> = {
  L0: 'לא מחובר: אני המודל',
  L1: 'סיווג תמונה שלמה (המדריך מאמן)',
  L2: 'ספירה ותיוג בנקודה (אימון בהפעלת מורה)',
  L3: 'תיבות מלאות ו-YOLO בענן',
  L4: 'הנדסת נתונים, מדדים ופריסה',
};
export const CYCLE_DEPTH_SHORT_LABELS: Record<CycleDepth, string> = {
  L0: 'L0 · לא מחובר', L1: 'L1 · סיווג תמונה', L2: 'L2 · ספירה ותיוג', L3: 'L3 · תיבות ו-YOLO', L4: 'L4 · הנדסת נתונים',
};
export const BAND_LABELS: Record<Band, string> = {
  'a-b': 'א-ב', 'c-d': 'ג-ד', 'e-f': 'ה-ו', 'g-i': 'ז-ט', 'j-l': 'י-יב',
  teachers: 'מורים', corporate: 'ארגונים', municipal: 'רשות מקומית',
};
export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  live: 'פעיל', draft: 'טיוטה עד אישור כתוב', blocked: 'חסום: תלוי מוצר',
};
export const RELEASE_STATUS_TONES: Record<ReleaseStatus, PillTone> = { live: 'green', draft: 'amber', blocked: 'red' };
/** Templates without a band sit in their own group at the end of every list. */
export const NO_BAND_LABEL = 'ללא שכבה';
export const WORKSHOP_ROLE_LABELS: Record<WorkshopRole, string> = {
  lead: 'מוביל', instructor: 'מדריך', assistant: 'עוזר', observer: 'צופה',
};
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'בעלים', admin: 'מנהל', instructor: 'מדריך', guest: 'אורח',
};
export const ENTITY_LABELS: Record<FieldEntity, string> = {
  organization: 'ארגון', workshop: 'סדנה', group: 'קבוצה', participant: 'משתתף',
};
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'טקסט', number: 'מספר', date: 'תאריך', boolean: 'כן / לא', select: 'בחירה',
  multiselect: 'בחירה מרובה', url: 'קישור',
};

export const ORG_KIND_OPTIONS = opts(ORG_KIND_LABELS);
export const ORG_STATUS_OPTIONS = opts(ORG_STATUS_LABELS);
export const FORMAT_OPTIONS = opts(FORMAT_LABELS);
export const DEVICE_OPTIONS = opts(DEVICE_LABELS);
export const CYCLE_DEPTH_OPTIONS = opts(CYCLE_DEPTH_LABELS).map((o) => ({ ...o, label: `${o.value}: ${o.label}` }));
export const BAND_OPTIONS = opts(BAND_LABELS);
export const RELEASE_STATUS_OPTIONS = opts(RELEASE_STATUS_LABELS);
export const WORKSHOP_ROLE_OPTIONS = opts(WORKSHOP_ROLE_LABELS);
export const ENTITY_OPTIONS = opts(ENTITY_LABELS);
export const FIELD_TYPE_OPTIONS = opts(FIELD_TYPE_LABELS);
/** roles an admin may grant through ws_add_staff (owner is SQL only) */
export const GRANTABLE_ROLE_OPTIONS = opts<Exclude<StaffRole, 'owner'>>({
  admin: STAFF_ROLE_LABELS.admin, instructor: STAFF_ROLE_LABELS.instructor, guest: STAFF_ROLE_LABELS.guest,
});
