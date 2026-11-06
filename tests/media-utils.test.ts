import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_REMOVE_CHUNK, chunkPaths, notRemoved, purgeDoneText, purgeRemainingText, readPurgeResult, uniquePaths,
} from '../lib/ws/media-utils.ts';

test('chunkPaths splits into chunks of 100 by default, order kept, last chunk shorter', () => {
  const paths = Array.from({ length: 250 }, (_, i) => `frames/${i}.jpg`);
  const chunks = chunkPaths(paths);
  assert.equal(STORAGE_REMOVE_CHUNK, 100);
  assert.deepEqual(chunks.map((c) => c.length), [100, 100, 50]);
  assert.equal(chunks[0][0], 'frames/0.jpg');
  assert.equal(chunks[2][49], 'frames/249.jpg');
  assert.deepEqual(chunks.flat(), paths);
});

test('chunkPaths: empty list gives no chunks, exact multiple gives no empty tail, custom size works', () => {
  assert.deepEqual(chunkPaths([]), []);
  assert.deepEqual(chunkPaths(['a', 'b', 'c', 'd'], 2), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(chunkPaths(['a', 'b', 'c'], 5), [['a', 'b', 'c']]);
  assert.throws(() => chunkPaths(['a'], 0));
});

test('uniquePaths drops nulls, blanks and duplicates', () => {
  assert.deepEqual(uniquePaths(['a', null, 'b', '', 'a', undefined, '  ']), ['a', 'b']);
});

test('notRemoved lists the paths the bucket did not hand back', () => {
  const chunk = ['w/1/g/2/p/a.jpg', 'w/1/g/2/p/b.jpg', 'w/1/g/2/jobs/c.zip'];
  assert.deepEqual(notRemoved(chunk, chunk.map((name) => ({ name }))), []);
  assert.deepEqual(notRemoved(chunk, [{ name: 'w/1/g/2/p/b.jpg' }]), ['w/1/g/2/p/a.jpg', 'w/1/g/2/jobs/c.zip']);
  // nothing confirmed (no delete right, or the objects are not in this bucket): every path stays
  assert.deepEqual(notRemoved(chunk, []), chunk);
  assert.deepEqual(notRemoved(chunk, null), chunk);
  assert.deepEqual(notRemoved([], [{ name: 'x' }]), []);
});

test('readPurgeResult reads the jsonb and tolerates garbage', () => {
  assert.deepEqual(readPurgeResult({ frames: ['f1', 'f1', 'f2'], zips: ['z1'], photos_deleted: 2 }),
    { frames: ['f1', 'f2'], zips: ['z1'], photos_deleted: 2 });
  assert.deepEqual(readPurgeResult(null), { frames: [], zips: [], photos_deleted: 0 });
  assert.deepEqual(readPurgeResult({ frames: 'x', zips: null, photos_deleted: 'many' }), { frames: [], zips: [], photos_deleted: 0 });
});

test('result lines', () => {
  assert.equal(purgeDoneText(120, 3), 'נמחקו 120 תמונות ו-3 קבצי אימון');
  assert.ok(purgeRemainingText(7).includes('7 קבצים'));
});
