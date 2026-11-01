import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Same extensionless-import hook as ws-components.test.ts (the app uses bundler resolution).
const HOOK = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(spec)) return next(spec + '.ts', ctx);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url);

let P: typeof import('../lib/ws/pool-scope.ts');
let T: typeof import('../lib/ws/types.ts');

before(async () => {
  P = await import('../lib/ws/pool-scope.ts');
  T = await import('../lib/ws/types.ts');
});

test('pool scope contract: personal and group, personal is the default', () => {
  assert.deepEqual([...T.POOL_SCOPES], ['personal', 'group']);
  assert.equal(P.DEFAULT_POOL_SCOPE, 'personal');
  assert.equal(P.POOL_SCOPE_OPTIONS[0].value, 'personal');
});

test('every scope has one option with a label and a one-line help text', () => {
  assert.deepEqual(P.POOL_SCOPE_OPTIONS.map((o) => o.value), [...T.POOL_SCOPES]);
  for (const o of P.POOL_SCOPE_OPTIONS) {
    assert.ok(o.label.length > 0);
    assert.ok(o.help.length > 0);
    assert.ok(!o.help.includes('\n'));
    assert.ok(!o.label.includes('—') && !o.help.includes('—'), 'no em dashes in Hebrew copy');
  }
  assert.equal(P.POOL_SCOPE_OPTIONS[0].label, 'כל תלמיד לבד (מומלץ)');
  assert.equal(P.POOL_SCOPE_OPTIONS[1].label, 'כל הקבוצה יחד');
  assert.equal(P.POOL_SCOPE_QUESTION, 'איך עובדים על התמונות?');
});

test('pill label is one word per scope', () => {
  assert.equal(P.poolScopePillLabel('personal'), 'אישי');
  assert.equal(P.poolScopePillLabel('group'), 'קבוצתי');
  for (const s of T.POOL_SCOPES) assert.ok(P.POOL_SCOPE_PILL_LABELS[s].length > 0);
});

test('normalizePoolScope falls back to personal for unknown values', () => {
  assert.equal(P.normalizePoolScope('group'), 'group');
  assert.equal(P.normalizePoolScope('personal'), 'personal');
  assert.equal(P.normalizePoolScope(undefined), 'personal');
  assert.equal(P.normalizePoolScope('merged'), 'personal');
  assert.equal(P.isPoolScope('group'), true);
  assert.equal(P.isPoolScope(null), false);
});

test('board labels change only for the personal pool', () => {
  assert.equal(P.photosFactLabel('personal'), 'תמונות (כל התלמידים)');
  assert.equal(P.photosFactLabel('group'), 'תמונות');
  assert.equal(P.trainingPanelTitle('personal'), 'אימונים אישיים');
  assert.equal(P.trainingPanelTitle('group'), 'אימונים פתוחים');
});
