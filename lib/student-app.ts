/** The student app lives in its own deployment (repo workshops-student); the console only links to it. */
export const DEFAULT_STUDENT_URL = 'https://workshops-student.vercel.app';

/** Accepts only http(s) urls; anything else falls back to the default. Trailing slashes are dropped. */
export function resolveStudentUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (!/^https?:\/\/\S+$/i.test(value)) return DEFAULT_STUDENT_URL;
  return value.replace(/\/+$/, '');
}

// NEXT_PUBLIC_* must be read as a literal property so Next can inline it into the client bundle.
export const STUDENT_URL = resolveStudentUrl(process.env.NEXT_PUBLIC_STUDENT_URL);

/** One line shown next to a workshop: the code and where students enter it. */
export function joinLine(code: string, url: string = STUDENT_URL): string {
  return `קוד הצטרפות: ${code} · ${url}`;
}

/** What the copy button puts on the clipboard (ready to paste to students). */
export function joinCopyText(code: string, url: string = STUDENT_URL): string {
  return `${url}\nקוד הצטרפות: ${code}`;
}
