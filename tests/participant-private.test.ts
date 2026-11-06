import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergePrivate, PARTICIPANT_COLUMNS, type ParticipantPublic } from '../lib/ws/participant-private.ts';

const row = (id: string): ParticipantPublic & { group: null } => ({
  id, workshop_id: 'w1', group_id: null, user_id: null, full_name: id, grade: null, roles: [], status: 'active',
  source: 'roster', media_consent: null, joined_at: null, created_at: '', updated_at: '', group: null,
});

test('notes and custom_fields are merged onto the matching row by id', () => {
  const merged = mergePrivate([row('a'), row('b')], [
    { id: 'b', notes: 'late', custom_fields: { shirt: 'M' } },
    { id: 'a', notes: null, custom_fields: {} },
  ]);
  assert.deepEqual(merged.map((r) => [r.id, r.notes, r.custom_fields]), [['a', null, {}], ['b', 'late', { shirt: 'M' }]]);
  assert.equal(merged[1].full_name, 'b');
});

test('rows without a private entry (non-staff: the RPC returns nothing) get empty values', () => {
  const merged = mergePrivate([row('a')], []);
  assert.equal(merged[0].notes, null);
  assert.deepEqual(merged[0].custom_fields, {});
});

test('a null custom_fields from the RPC becomes an empty object, and inputs are not mutated', () => {
  const input = [row('a')];
  const merged = mergePrivate(input, [{ id: 'a', notes: 'x', custom_fields: null }]);
  assert.deepEqual(merged[0].custom_fields, {});
  assert.equal('notes' in input[0], false);
});

test('the explicit column list never names the staff-only columns or a wildcard', () => {
  const cols = PARTICIPANT_COLUMNS.split(',').map((c) => c.trim());
  for (const hidden of ['notes', 'custom_fields', '*']) assert.equal(cols.includes(hidden), false);
  assert.ok(cols.includes('id') && cols.includes('updated_at'));
});
