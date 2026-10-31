import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// group-access imports lib/student-app without an extension (bundler resolution); Node needs the .ts retry hook.
const HOOK = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(spec)) return next(spec + '.ts', ctx);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url);

let A: typeof import('../lib/ws/group-access.ts');
let S: typeof import('../lib/student-app.ts');
before(async () => {
  A = await import('../lib/ws/group-access.ts');
  S = await import('../lib/student-app.ts');
});

test('tabletLine shows code and group number and ends with the PIN label (the digits render separately, ltr)', () => {
  assert.equal(A.tabletLine('SDR-7', 3), 'כניסת טאבלט: קוד SDR-7 · קבוצה 3 · PIN');
});

test('tabletCopyText is one Hebrew line with the app url, the entry choice, code, group and PIN', () => {
  const text = A.tabletCopyText('SDR-7', 3, '4821', 'https://app.test');
  assert.equal(text, 'פותחים https://app.test, בוחרים "כניסת קבוצה", מקלידים קוד SDR-7, קבוצה 3, PIN 4821');
  assert.ok(!text.includes('\n'));
  assert.ok(A.tabletCopyText('SDR-7', 3, '4821').startsWith(`פותחים ${S.STUDENT_URL},`));
});

test('tabletCopyText never prints null for a missing PIN', () => {
  const text = A.tabletCopyText('SDR-7', 1, null, 'https://app.test');
  assert.ok(!text.includes('null'));
  assert.ok(text.includes('PIN חסר'));
});

test('takeHomeUrl is <student url>/model/<token>, trailing slashes dropped, token url-encoded', () => {
  assert.equal(A.takeHomeUrl('abc234xyz789', 'https://app.test/'), 'https://app.test/model/abc234xyz789');
  assert.equal(A.takeHomeUrl('abc234xyz789'), `${S.STUDENT_URL}/model/abc234xyz789`);
  assert.equal(A.takeHomeUrl('a b', 'https://app.test'), 'https://app.test/model/a%20b');
});

test('isPin accepts exactly four digits', () => {
  assert.equal(A.isPin('0042'), true);
  assert.equal(A.isPin('123'), false);
  assert.equal(A.isPin('12345'), false);
  assert.equal(A.isPin('12a4'), false);
  assert.equal(A.isPin(null), false);
  assert.equal(A.isPin(1234), false);
});
