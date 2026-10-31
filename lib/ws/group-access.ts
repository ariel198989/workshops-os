// Pure helpers for a group's sign-in (one-scan join link, or code + group number + PIN) and its take-home page. Unit tested.
import { STUDENT_URL } from '../student-app';

export const PIN_LENGTH = 4;
export const JOIN_TOKEN_LENGTH = 20;
export const GROUP_ENTRY_LABEL = 'כניסת קבוצה';

/** Copy on the group card and on the printed entry card. */
export const SCAN_TITLE = 'סריקה אחת ומחוברים';
export const SCAN_INSTRUCTION = 'סרקו עם הטאבלט או הטלפון של הקבוצה';
/** Copy for the class-wide join QR (students with their own phone and account). */
export const CLASS_QR_TITLE = 'סרקו כדי להצטרף לסדנה';
export const CLASS_QR_HINT = 'לתלמידים עם טלפון וחשבון';

const trim = (base: string) => base.replace(/\/+$/, '');

/** One scan signs the tablet into the group: <student url>/g/<join_token>. */
export function joinUrl(studentUrl: string, token: string): string {
  return `${trim(studentUrl)}/g/${encodeURIComponent(token)}`;
}

/** Prefills the workshop code for students on their own phones: <student url>/join?code=<code>. */
export function workshopJoinUrl(studentUrl: string, code: string): string {
  return `${trim(studentUrl)}/join?code=${encodeURIComponent(code)}`;
}

/** Short line shown on the group card. The PIN is rendered separately so it can be dir="ltr" monospace. */
export function tabletLine(code: string, groupNumber: number): string {
  return `כניסת טאבלט: קוד ${code} · קבוצה ${groupNumber} · PIN`;
}

/** The no-camera fallback under the QR. The PIN is rendered separately (dir="ltr" monospace). */
export function fallbackLine(code: string, groupNumber: number): string {
  return `אם אין מצלמה: קוד ${code}, קבוצה ${groupNumber}, PIN`;
}

/**
 * One-line Hebrew instruction for the clipboard: where to open, what to choose, what to type.
 * A missing PIN (should not happen after 0013) is spelled out instead of printing "null".
 */
export function tabletCopyText(code: string, groupNumber: number, pin: string | null, url: string = STUDENT_URL): string {
  const pinText = pin ?? 'PIN חסר, בקשו מהמדריך';
  return `פותחים ${url}, בוחרים "${GROUP_ENTRY_LABEL}", מקלידים קוד ${code}, קבוצה ${groupNumber}, PIN ${pinText}`;
}

/** The public take-home page served by the student app. */
export function takeHomeUrl(shareToken: string, base: string = STUDENT_URL): string {
  return `${trim(base)}/model/${encodeURIComponent(shareToken)}`;
}

/** Guards against malformed rows: only a 4-digit string is a PIN. */
export const isPin = (v: unknown): v is string => typeof v === 'string' && new RegExp(`^\\d{${PIN_LENGTH}}$`).test(v);

/** Guards against malformed rows: only 20 chars of [a-z2-9] is a join token (0014). */
export const isJoinToken = (v: unknown): v is string =>
  typeof v === 'string' && new RegExp(`^[a-z2-9]{${JOIN_TOKEN_LENGTH}}$`).test(v);
