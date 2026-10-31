// The 4-digit workshop number (ws_workshops.short_code, migration 0015) that children type on the student
// app's first screen, Kahoot style. Assigned by the DB when a workshop is confirmed or live, cleared when it
// closes. Pure helpers and the Hebrew copy shared by the header pill, JoinInfo, the projector and the QR
// drawer. Unit tested.
import { STUDENT_URL, joinCopyText } from '../student-app';
import { workshopJoinUrl } from './group-access';

export const WORKSHOP_NUMBER_LENGTH = 4;

export const NUMBER_LABEL = 'מספר הסדנה';
/** draft / proposal: the DB assigns the number on the move to confirmed or live */
export const NUMBER_PENDING = 'המספר יינתן בפתיחת הסדנה';
export const NUMBER_HINT = 'התלמידים מקלידים את המספר במסך הראשון של האפליקציה';
export const TELL_STUDENTS = 'אמרו לתלמידים:';
export const STUDENT_STEPS = 'פותחים את האפליקציה ומקלידים את המספר. בוחרים קבוצה, כותבים שם, וזהו.';
export const ROTATE_LABEL = 'מספר חדש';
export const ROTATE_CONFIRM = 'להחליף את מספר הסדנה? המספר הישן יפסיק לעבוד מיד';
export const ROTATED_TOAST = 'מספר חדש נשמר. הישן כבר לא עובד';
export const COPIED_TOAST = 'מספר הסדנה הועתק';

const NUMBER_RE = new RegExp(`^\\d{${WORKSHOP_NUMBER_LENGTH}}$`);

/** Guards against malformed rows: only a string of exactly four digits is a workshop number. */
export const isWorkshopNumber = (v: unknown): v is string => typeof v === 'string' && NUMBER_RE.test(v);

/** Facilitator input or a row value: whitespace is dropped, anything but four digits becomes null. */
export function normalizeWorkshopNumber(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\s+/g, '');
  return isWorkshopNumber(digits) ? digits : null;
}

/** Header pill: "מספר הסדנה: 1357". */
export const numberPillText = (shortCode: string): string => `${NUMBER_LABEL}: ${shortCode}`;

/** First line of JoinInfo: "אמרו לתלמידים: 1357". */
export const tellStudentsText = (shortCode: string): string => `${TELL_STUDENTS} ${shortCode}`;

/** Second, smaller line of JoinInfo: the alphanumeric code and the student url. */
export function fullCodeLine(code: string, url: string = STUDENT_URL): string {
  return `קוד מלא: ${code} · כתובת: ${url}`;
}

/** Entry card fallback: the number first, then the no-camera path (group + PIN rendered separately). */
export function numberedFallbackLine(shortCode: string, groupNumber: number): string {
  return `${NUMBER_LABEL}: ${shortCode} · אם אין מצלמה: קבוצה ${groupNumber}, PIN`;
}

/** The class join url prefers the number (what the student app's first screen expects); the code is the fallback. */
export function studentJoinUrl(code: string, shortCode: string | null | undefined, url: string = STUDENT_URL): string {
  return workshopJoinUrl(url, isWorkshopNumber(shortCode) ? shortCode : code);
}

/** Clipboard text for JoinInfo: with a number, the Kahoot-style instruction; without, the old code + url. */
export function joinCopyTextWithNumber(code: string, shortCode: string | null | undefined, url: string = STUDENT_URL): string {
  if (!isWorkshopNumber(shortCode)) return joinCopyText(code, url);
  return `${tellStudentsText(shortCode)}\n${STUDENT_STEPS}\n${fullCodeLine(code, url)}`;
}
