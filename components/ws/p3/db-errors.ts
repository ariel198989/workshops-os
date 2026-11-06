// Maps Postgres / PostgREST errors to short Hebrew messages. Raw DB text is never shown to the user.

interface PgLike { code?: unknown; message?: unknown }

const DEFAULT_FAIL = 'הפעולה נכשלה';

function parts(err: unknown): { code: string; msg: string } {
  if (err === null || typeof err !== 'object') return { code: '', msg: '' };
  const { code, message } = err as PgLike;
  return { code: typeof code === 'string' ? code : '', msg: typeof message === 'string' ? message : '' };
}

function uniqueMessage(msg: string): string {
  if (/ws_workshops_code|\(code\)/.test(msg)) return 'הקוד כבר בשימוש';
  if (/team_prefix/.test(msg)) return 'הקידומת כבר בשימוש';
  if (/ws_organizations_name/.test(msg)) return 'ארגון בשם הזה בעיר הזו כבר קיים';
  if (/ws_contacts_one_primary/.test(msg)) return 'כבר יש איש קשר ראשי';
  if (/ws_field_definitions_uq/.test(msg)) return 'שדה עם המפתח הזה כבר קיים';
  if (/ws_staff_email/.test(msg)) return 'האימייל כבר רשום בצוות';
  return 'הערך כבר קיים';
}

function checkMessage(msg: string): string {
  if (/locked/.test(msg)) return 'הערך נעול אחרי הפעלת הקבוצות';
  if (/team_prefix/.test(msg)) return 'הקידומת לא תקינה';
  if (/ws_workshops_code|\bcode\b/.test(msg)) return 'הקוד לא תקין';
  return 'הערך לא עומד בכללי המערכת';
}

// RPC messages matched by text first: the same sentence may arrive under different SQLSTATEs
const BY_MESSAGE: readonly [RegExp, string][] = [
  [/template_blocked/, 'התבנית חסומה ואי אפשר להריץ אותה כרגע'],
  [/device_not_allowed_for_band/, 'מצב המכשיר הזה לא מותר לשכבה שנבחרה. ביסודי אין טלפונים אישיים'],
  [/no template for format/, 'אין תבנית תוכנית לפורמט של הסדנה. בחרו תבנית בהגדרות או צרו אחת'],
  [/group is full/, 'הקבוצה מלאה'],
  [/already has sessions/, 'לסדנה כבר יש מפגשים'],
  [/already in another group/, 'התלמיד/ה כבר בקבוצה אחרת'],
  [/not found or not live/, 'הסדנה לא נמצאה או שהיא לא פתוחה'],
];

export function dbErrorMessage(err: unknown, fallback: string = DEFAULT_FAIL): string {
  const { code, msg } = parts(err);
  const known = BY_MESSAGE.find(([re]) => re.test(msg));
  if (known) return known[1];
  switch (code) {
    case '23505': return uniqueMessage(msg);
    case '23514': return checkMessage(msg);
    case '23503': return 'הרשומה מקושרת לנתונים אחרים';
    case '42501': return 'אין הרשאה לפעולה הזו';
    case '22023': return /transition/.test(msg) ? 'המעבר הזה אינו מותר מהמצב הנוכחי' : fallback;
    case 'P0002': return /no account/.test(msg) ? 'אין חשבון למייל הזה. בקשו מהמשתמש להירשם או שלחו הזמנה במייל' : fallback;
    case 'P0003': return 'התבנית חסומה ואי אפשר להריץ אותה כרגע';
    case 'P0004': return 'מצב המכשיר הזה לא מותר לשכבה שנבחרה. ביסודי אין טלפונים אישיים';
    default: return fallback;
  }
}

/** Runs a DB call and rethrows failures as an Error carrying the Hebrew message (InlineEdit and ConfirmButton toast it). */
export async function withFriendlyError<T>(run: () => Promise<T>, fallback: string = DEFAULT_FAIL): Promise<T> {
  try {
    return await run();
  } catch (err) {
    throw new Error(dbErrorMessage(err, fallback));
  }
}
