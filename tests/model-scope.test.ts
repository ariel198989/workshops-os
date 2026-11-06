import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupModelsFirst, jobScope, modelScopeLabel, normalizeModelScope } from '../lib/ws/model-scope.ts';

test('scope labels; anything but personal (old "team" rows, null) reads as the group model', () => {
  assert.equal(modelScopeLabel('group'), 'מודל קבוצתי');
  assert.equal(modelScopeLabel('personal'), 'מודל אישי של תלמיד/ה');
  assert.equal(normalizeModelScope('team'), 'group');
  assert.equal(normalizeModelScope(null), 'group');
});

test('groupModelsFirst puts group models first and keeps newest-first inside each scope', () => {
  const models = [
    { id: 'p2', scope: 'personal' }, { id: 'g2', scope: 'group' }, { id: 'p1', scope: 'personal' }, { id: 'g1', scope: 'group' },
  ];
  assert.deepEqual(groupModelsFirst(models).map((m) => m.id), ['g2', 'g1', 'p2', 'p1']);
  assert.deepEqual(models.map((m) => m.id), ['p2', 'g2', 'p1', 'g1'], 'input untouched');
});

test('jobScope mirrors ws-register-model: personal only for an active member in a personal-pool workshop', () => {
  const members = [
    { user_id: 'u1', group_id: 'g1', status: 'active' },
    { user_id: 'u2', group_id: 'g1', status: 'withdrawn' },
  ];
  assert.equal(jobScope({ group_id: 'g1', requested_by: 'u1' }, 'personal', members), 'personal');
  assert.equal(jobScope({ group_id: 'g1', requested_by: 'u1' }, 'group', members), 'group');
  assert.equal(jobScope({ group_id: 'g2', requested_by: 'u1' }, 'personal', members), 'group');
  assert.equal(jobScope({ group_id: 'g1', requested_by: 'u2' }, 'personal', members), 'group');
  assert.equal(jobScope({ group_id: 'g1', requested_by: 'staff' }, 'personal', members), 'group');
  assert.equal(jobScope({ group_id: 'g1', requested_by: null }, 'personal', members), 'group');
});
