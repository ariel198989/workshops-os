// Pure helpers for a group's tablet sign-in (code + group number + PIN) and its take-home page. Unit tested.
import { STUDENT_URL } from '../student-app';

export const PIN_LENGTH = 4;
export const GROUP_ENTRY_LABEL = 'כניסת קבוצה';

/** Short line shown on the group card. The PIN is rendered separately so it can be dir="ltr" monospace. */
export function tabletLine(code: string, groupNumber: number): string {
  return `כניסת טאבלט: קוד ${code} · קבוצה ${groupNumber} · PIN`;
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
  return `${base.replace(/\/+$/, '')}/model/${encodeURIComponent(shareToken)}`;
}

/** Guards against malformed rows: only a 4-digit string is a PIN. */
export const isPin = (v: unknown): v is string => typeof v === 'string' && new RegExp(`^\\d{${PIN_LENGTH}}$`).test(v);
