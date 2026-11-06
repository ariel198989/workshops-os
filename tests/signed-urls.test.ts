import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEDIA_LOAD_FAILED, MEDIA_URL_MARGIN_SECONDS, MEDIA_URL_TTL_SECONDS, countMissing, mediaMissingText, mergeSigned,
  readSigned, splitCached, type SignedCache,
} from '../lib/ws/signed-urls.ts';

const NOW = 1_800_000_000_000;
const TTL_MS = MEDIA_URL_TTL_SECONDS * 1000;
const MARGIN_MS = MEDIA_URL_MARGIN_SECONDS * 1000;
const A = 'w/1/g/2/p/a.jpg';
const B = 'w/1/g/2/p/b.jpg';
const C = 'w/1/g/2/p/c.jpg';

test('links live for an hour and are reused until five minutes before they expire', () => {
  assert.equal(MEDIA_URL_TTL_SECONDS, 3600);
  assert.equal(MEDIA_URL_MARGIN_SECONDS, 300);
  const cache = mergeSigned(new Map(), { [A]: 'https://x/a?token=1' }, NOW);
  assert.equal(cache.get(A)?.expiresAt, NOW + TTL_MS);
  assert.deepEqual(splitCached(cache, [A], NOW + TTL_MS - MARGIN_MS - 1), { hits: { [A]: 'https://x/a?token=1' }, misses: [] });
  assert.deepEqual(splitCached(cache, [A], NOW + TTL_MS - MARGIN_MS), { hits: {}, misses: [A] });
});

test('splitCached: an empty cache misses everything, duplicates and blanks collapse, order is kept', () => {
  assert.deepEqual(splitCached(new Map(), [B, A, B, '', A], NOW), { hits: {}, misses: [B, A] });
  assert.deepEqual(splitCached(new Map(), [], NOW), { hits: {}, misses: [] });
  const cache = mergeSigned(new Map(), { [A]: 'ua' }, NOW);
  assert.deepEqual(splitCached(cache, [A, B, C], NOW + 1000), { hits: { [A]: 'ua' }, misses: [B, C] });
});

test('readSigned keeps only the items that were really signed', () => {
  const urls = readSigned([
    { path: A, signedUrl: 'ua', error: null },
    { path: B, signedUrl: null, error: 'Either the object does not exist or you do not have access to it' },
    { path: null, signedUrl: 'orphan', error: null },
    { path: C, signedUrl: 'uc', error: 'boom' },
  ]);
  assert.deepEqual(urls, { [A]: 'ua' });
  assert.deepEqual(readSigned([]), {});
});

test('mergeSigned returns a new cache, drops expired entries and never touches the old one', () => {
  const first: SignedCache = mergeSigned(new Map(), { [A]: 'ua' }, NOW);
  const later = NOW + TTL_MS;
  const second = mergeSigned(first, { [B]: 'ub' }, later);
  assert.notEqual(second, first);
  assert.deepEqual([...first.keys()], [A]);
  assert.deepEqual([...second.keys()], [B]);
  assert.equal(second.get(B)?.expiresAt, later + TTL_MS);
  // a path signed again replaces its old link
  const third = mergeSigned(second, { [B]: 'ub2' }, later + 1000);
  assert.equal(third.get(B)?.url, 'ub2');
  assert.equal(third.size, 1);
});

test('a failed path is not cached, so the next call asks for it again', () => {
  const fresh = readSigned([{ path: A, signedUrl: 'ua', error: null }, { path: B, signedUrl: null, error: 'not found' }]);
  const cache = mergeSigned(new Map(), fresh, NOW);
  assert.deepEqual(splitCached(cache, [A, B], NOW + 1).misses, [B]);
});

test('countMissing counts each unsigned path once', () => {
  assert.equal(countMissing([A, B, B, C, ''], { [A]: 'ua' }), 2);
  assert.equal(countMissing([A], { [A]: 'ua' }), 0);
  assert.equal(countMissing([], {}), 0);
});

test('notice lines are short Hebrew without a dash', () => {
  assert.equal(mediaMissingText(1), 'תמונה אחת לא נמצאה באחסון');
  assert.equal(mediaMissingText(7), '7 תמונות לא נמצאו באחסון');
  for (const line of [MEDIA_LOAD_FAILED, mediaMissingText(1), mediaMissingText(3)]) {
    assert.match(line, /[\u0590-\u05FF]/);
    assert.ok(!/[\u2013\u2014]/.test(line), line);
  }
});
