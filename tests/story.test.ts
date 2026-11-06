import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStory, openerFor } from '../lib/ws/story.ts';

const raw = {
  premise_he: ' רובי לומד ', hero_he: 'רובי',
  sessions: [
    { session_no: 1, beat_he: 'מגיע', opener_he: 'בוקר טוב', materials_he: 'כרטיסים' },
    { session_no: 2, beat_he: 'סנדל', opener_he: 'שלום' },
    { session_no: 'x', opener_he: 'bad' },
    { session_no: 3, opener_he: '' },
  ],
};

test('normalizeStory trims, keeps valid sessions and drops broken ones', () => {
  const s = normalizeStory(raw);
  assert.equal(s?.premise_he, 'רובי לומד');
  assert.deepEqual(s?.sessions.map((x) => x.session_no), [1, 2]);
  assert.equal(s?.sessions[0].materials_he, 'כרטיסים');
  assert.equal('materials_he' in (s?.sessions[1] ?? {}), false);
});

test('missing or empty stories read as null', () => {
  assert.equal(normalizeStory(null), null);
  assert.equal(normalizeStory('x'), null);
  assert.equal(normalizeStory({ premise_he: '', hero_he: '', sessions: [] }), null);
});

test('openerFor finds the session by number', () => {
  const s = normalizeStory(raw);
  assert.equal(openerFor(s, 2)?.opener_he, 'שלום');
  assert.equal(openerFor(s, 9), null);
  assert.equal(openerFor(null, 1), null);
});
