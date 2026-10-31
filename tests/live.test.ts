import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BREAK_MESSAGE, LIVE_MESSAGE_MAX, LIVE_PRESETS, LIVE_ROUTES, clampLiveMessage, liveSummary, messageInput,
  pickLiveSession, presetByKey, presetInput, type LiveState,
} from '../lib/ws/live.ts';

const live: LiveState = {
  workshop_id: 'w1', session_id: 's1', session_module_id: 'm1', step_key: 'tag', label: 'מתייגים',
  allowed_routes: ['tag'], message: null, updated_by: 'u1', updated_at: '2026-10-31T10:00:00Z',
};

test('presets: six quick buttons, each route is one the RPC accepts, break has no routes and a message', () => {
  assert.equal(LIVE_PRESETS.length, 6);
  assert.deepEqual(LIVE_PRESETS.map((p) => p.key), ['capture', 'tag', 'train', 'results', 'check', 'break']);
  assert.deepEqual(LIVE_PRESETS.map((p) => p.label), ['מצלמים', 'מתייגים', 'שולחים לאימון', 'תוצאות', 'שאלון', 'הפסקה']);
  for (const p of LIVE_PRESETS) {
    for (const r of p.routes) assert.ok((LIVE_ROUTES as readonly string[]).includes(r), `${p.key}: ${r}`);
  }
  const brk = presetByKey('break');
  assert.deepEqual(brk?.routes, []);
  assert.equal(brk?.message, BREAK_MESSAGE);
  assert.equal(presetByKey('nope'), null);
  assert.equal(presetByKey(null), null);
});

test('clampLiveMessage trims, caps at 200 and turns empty into null', () => {
  assert.equal(clampLiveMessage('  שלום  '), 'שלום');
  assert.equal(clampLiveMessage(''), null);
  assert.equal(clampLiveMessage('   '), null);
  assert.equal(clampLiveMessage(null), null);
  assert.equal(clampLiveMessage(undefined), null);
  assert.equal(clampLiveMessage('א'.repeat(250))?.length, LIVE_MESSAGE_MAX);
});

test('presetInput: typed message wins, otherwise the preset default', () => {
  const tag = presetByKey('tag')!;
  assert.deepEqual(presetInput(tag, 'm1', ''), { moduleId: 'm1', stepKey: 'tag', label: 'מתייגים', routes: ['tag'], message: null });
  assert.equal(presetInput(tag, null, ' עוד 5 דקות ').message, 'עוד 5 דקות');
  assert.equal(presetInput(presetByKey('break')!, null, '').message, BREAK_MESSAGE);
  assert.equal(presetInput(presetByKey('break')!, null, 'חוזרים ב-11:00').message, 'חוזרים ב-11:00');
});

test('messageInput keeps the current step and drops unknown routes', () => {
  const out = messageInput({ ...live, allowed_routes: ['tag', 'bogus'] }, null, 'יש שאלות?');
  assert.deepEqual(out, { moduleId: 'm1', stepKey: 'tag', label: 'מתייגים', routes: ['tag'], message: 'יש שאלות?' });
  assert.deepEqual(messageInput(null, 'm2', 'x'), { moduleId: 'm2', stepKey: null, label: null, routes: [], message: 'x' });
  assert.equal(messageInput(live, 'm9', '').moduleId, 'm9');
});

test('pickLiveSession: live first, else the earliest open session, else null', () => {
  const s = (session_no: number, status: LiveSessionStatus) => ({ id: `s${session_no}`, session_no, status });
  assert.equal(pickLiveSession([s(1, 'done'), s(3, 'scheduled'), s(2, 'live')])?.id, 's2');
  assert.equal(pickLiveSession([s(1, 'done'), s(3, 'scheduled'), s(2, 'planned')])?.id, 's2');
  assert.equal(pickLiveSession([s(1, 'done'), s(2, 'cancelled')]), null);
  assert.equal(pickLiveSession([]), null);
});
type LiveSessionStatus = Parameters<typeof pickLiveSession>[0][number]['status'];

test('liveSummary joins label and module, falls back to the message, null without a row', () => {
  assert.equal(liveSummary(live, 'תיוג תמונות'), 'מתייגים · מודול: תיוג תמונות');
  assert.equal(liveSummary(live, null), 'מתייגים');
  assert.equal(liveSummary({ ...live, step_key: null, label: null, message: 'עכשיו בלי מסכים' }, null), 'עכשיו בלי מסכים');
  assert.equal(liveSummary(null, 'x'), null);
});
