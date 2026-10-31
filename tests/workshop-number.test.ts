import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// workshop-number imports group-access -> student-app without extensions (bundler resolution); Node needs the .ts retry hook.
const HOOK = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(spec)) return next(spec + '.ts', ctx);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url);

let N: typeof import('../lib/ws/workshop-number.ts');
before(async () => {
  N = await import('../lib/ws/workshop-number.ts');
});

const URL = 'https://s.example.com';

test('isWorkshopNumber accepts exactly four digits and nothing else', () => {
  assert.equal(N.isWorkshopNumber('1357'), true);
  assert.equal(N.isWorkshopNumber('0042'), true);
  assert.equal(N.isWorkshopNumber('135'), false);
  assert.equal(N.isWorkshopNumber('13579'), false);
  assert.equal(N.isWorkshopNumber('13a7'), false);
  assert.equal(N.isWorkshopNumber(1357), false);
  assert.equal(N.isWorkshopNumber(null), false);
  assert.equal(N.isWorkshopNumber(undefined), false);
});

test('normalizeWorkshopNumber drops whitespace, rejects anything but four digits', () => {
  assert.equal(N.normalizeWorkshopNumber(' 1 3 5 7 '), '1357');
  assert.equal(N.normalizeWorkshopNumber('1357'), '1357');
  assert.equal(N.normalizeWorkshopNumber('12'), null);
  assert.equal(N.normalizeWorkshopNumber('PILOT-1'), null);
  assert.equal(N.normalizeWorkshopNumber(null), null);
  assert.equal(N.normalizeWorkshopNumber(1357), null);
});

test('header pill and first JoinInfo line carry the number after the Hebrew label', () => {
  assert.equal(N.numberPillText('1357'), 'מספר הסדנה: 1357');
  assert.equal(N.tellStudentsText('1357'), 'אמרו לתלמידים: 1357');
});

test('the smaller second line keeps the full code and the student url', () => {
  assert.equal(N.fullCodeLine('PILOT-1', URL), 'קוד מלא: PILOT-1 · כתובת: https://s.example.com');
});

test('entry card fallback starts with the workshop number, then the no-camera group/PIN text', () => {
  const line = N.numberedFallbackLine('1357', 2);
  assert.ok(line.startsWith('מספר הסדנה: 1357'));
  assert.ok(line.includes('קבוצה 2'));
  assert.ok(line.endsWith('PIN'));
});

test('studentJoinUrl prefers the number and falls back to the code', () => {
  assert.equal(N.studentJoinUrl('PILOT-1', '1357', URL), 'https://s.example.com/join?code=1357');
  assert.equal(N.studentJoinUrl('PILOT-1', null, URL), 'https://s.example.com/join?code=PILOT-1');
  assert.equal(N.studentJoinUrl('PILOT-1', '13', URL), 'https://s.example.com/join?code=PILOT-1');
  assert.equal(N.studentJoinUrl('PILOT-1', '1357', `${URL}/`), 'https://s.example.com/join?code=1357');
});

test('copy text with a number is the Kahoot-style instruction; without one it is the old code + url', () => {
  const withNumber = N.joinCopyTextWithNumber('PILOT-1', '1357', URL).split('\n');
  assert.equal(withNumber[0], 'אמרו לתלמידים: 1357');
  assert.equal(withNumber[1], N.STUDENT_STEPS);
  assert.equal(withNumber[2], 'קוד מלא: PILOT-1 · כתובת: https://s.example.com');
  const without = N.joinCopyTextWithNumber('PILOT-1', null, URL);
  assert.ok(without.includes('PILOT-1'));
  assert.ok(without.includes(URL));
  assert.ok(!without.includes('אמרו לתלמידים'));
});

test('Hebrew copy has no em dashes and no console-only placeholders', () => {
  for (const s of [N.NUMBER_LABEL, N.NUMBER_PENDING, N.NUMBER_HINT, N.TELL_STUDENTS, N.STUDENT_STEPS, N.ROTATE_CONFIRM, N.ROTATED_TOAST]) {
    assert.ok(!s.includes('—'), s);
    assert.ok(s.length > 0);
  }
});
