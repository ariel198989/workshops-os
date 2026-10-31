import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// entry-cards imports group-access -> student-app without extensions (bundler resolution); Node needs the .ts retry hook.
const HOOK = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(spec)) return next(spec + '.ts', ctx);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url);

let E: typeof import('../lib/ws/entry-cards.ts');
before(async () => {
  E = await import('../lib/ws/entry-cards.ts');
});

type OverviewGroup = import('../lib/ws/types.ts').OverviewGroup;
type WsGroup = import('../lib/ws/types.ts').WsGroup;

const group = (n: number, display: string | null = null) =>
  ({ group_id: `g${n}`, number: n, display_name: display, team_name: `T${n}` }) as unknown as OverviewGroup;
const row = (n: number, pin: string | null, token: string | null) =>
  ({ id: `g${n}`, pin, join_token: token }) as unknown as WsGroup;
const TOKEN = 'abcd2345efgh6789jkmn';

test('entryCards keeps board order, labels fall back to "קבוצה N", url and pin come from the row', () => {
  const cards = E.entryCards([group(2, 'הנמרים'), group(1)], [row(1, '4821', TOKEN), row(2, '0007', TOKEN)], 'SDR-7', 'https://app.test');
  assert.deepEqual(cards.map((c) => c.number), [2, 1]);
  assert.equal(cards[0].label, 'הנמרים');
  assert.equal(cards[1].label, 'קבוצה 1');
  assert.equal(cards[0].joinUrl, `https://app.test/g/${TOKEN}`);
  assert.equal(cards[0].pin, '0007');
  assert.equal(cards[1].pin, '4821');
  assert.ok(cards.every((c) => c.code === 'SDR-7'));
});

test('entryCards gives a card without QR or PIN when the row is missing or malformed', () => {
  const cards = E.entryCards([group(1), group(2)], [row(2, '12', 'short')], 'SDR-7', 'https://app.test');
  assert.equal(cards[0].joinUrl, null);
  assert.equal(cards[0].pin, null);
  assert.equal(cards[1].joinUrl, null);
  assert.equal(cards[1].pin, null);
});

test('paginate puts six cards per page by default and never emits an empty page', () => {
  assert.equal(E.CARDS_PER_PAGE, 6);
  assert.deepEqual(E.paginate([]), []);
  assert.deepEqual(E.paginate([1, 2, 3]).map((p) => p.length), [3]);
  assert.deepEqual(E.paginate([1, 2, 3, 4, 5, 6]).map((p) => p.length), [6]);
  assert.deepEqual(E.paginate([1, 2, 3, 4, 5, 6, 7]).map((p) => p.length), [6, 1]);
  assert.deepEqual(E.paginate(Array.from({ length: 13 }, (_, i) => i)).map((p) => p.length), [6, 6, 1]);
});

test('paginate honours a custom page size and rejects zero', () => {
  assert.deepEqual(E.paginate([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.throws(() => E.paginate([1], 0));
});
