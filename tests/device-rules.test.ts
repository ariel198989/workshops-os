import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Same extensionless-import hook as p3-helpers.test.ts (the app uses bundler resolution).
const HOOK = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if (e && e.code === 'ERR_MODULE_NOT_FOUND' && /^\\.\\.?\\//.test(spec)) return next(spec + '.ts', ctx);
    throw e;
  }
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), import.meta.url);

let R: typeof import('../lib/ws/device-rules.ts');
let T: typeof import('../lib/ws/types.ts');
let O: typeof import('../components/ws/p3/options.ts');
let A: typeof import('../lib/ws/assessment.ts');
let G: typeof import('../lib/ws/template-groups.ts');

before(async () => {
  R = await import('../lib/ws/device-rules.ts');
  T = await import('../lib/ws/types.ts');
  O = await import('../components/ws/p3/options.ts');
  A = await import('../lib/ws/assessment.ts');
  G = await import('../lib/ws/template-groups.ts');
});

type Depth = (typeof T.CYCLE_DEPTHS)[number];
type Device = (typeof T.DEVICE_MODES)[number];
type BandOrNull = (typeof T.BANDS)[number] | null;
const note = (band: BandOrNull, cycleDepth: Depth, deviceMode: Device) => R.deviceRuleNotes({ band, cycleDepth, deviceMode });

// ── defaults ──────────────────────────────────────────────────────────
test('every band has a default device, default depth and a recommended list starting with the default', () => {
  for (const band of T.BANDS) {
    const device = R.DEFAULT_DEVICE_BY_BAND[band];
    assert.ok(T.DEVICE_MODES.includes(device), band);
    assert.ok(T.CYCLE_DEPTHS.includes(R.DEFAULT_DEPTH_BY_BAND[band]), band);
    assert.equal(R.RECOMMENDED_DEVICES_BY_BAND[band][0], device, band);
  }
  assert.equal(R.defaultDeviceForBand('a-b'), 'facilitator_screen_only');
  assert.equal(R.defaultDeviceForBand('j-l'), 'laptop_plus_phone');
  assert.equal(R.defaultDeviceForBand('municipal'), 'school_tablet_or_lab_pc');
  assert.equal(R.defaultDepthForBand('c-d'), 'L1');
  assert.equal(R.defaultDepthForBand('teachers'), 'L3');
  assert.equal(R.defaultDeviceForBand(null), null);
  assert.equal(R.defaultDepthForBand(null), null);
});

test('groupDevices puts the recommended modes first and never drops or duplicates a mode', () => {
  const { recommended, other } = R.groupDevices('g-i', T.DEVICE_MODES);
  assert.equal(recommended[0], 'school_tablet_or_lab_pc');
  assert.deepEqual([...recommended, ...other].sort(), [...T.DEVICE_MODES].sort());
  assert.deepEqual(R.groupDevices(null, T.DEVICE_MODES).recommended, []);
});

// ── legality notes ────────────────────────────────────────────────────
test('personal phones in elementary warn, for each elementary band and each phone-bearing mode', () => {
  for (const band of ['a-b', 'c-d', 'e-f'] as const) {
    for (const device of ['own_phones', 'byod_phone_approved_lesson', 'laptop_plus_phone'] as const) {
      assert.ok(note(band, 'L1', device).some((n) => n.level === 'warning' && n.text === R.NO_PHONES_ELEMENTARY), `${band} ${device}`);
    }
  }
  assert.ok(!note('e-f', 'L2', 'school_tablet_teacher_controlled').some((n) => n.text === R.NO_PHONES_ELEMENTARY));
});

test('middle school phones need written approval; laptop_plus_phone is not flagged there', () => {
  assert.ok(note('g-i', 'L3', 'own_phones').some((n) => n.text === R.PHONES_MIDDLE_APPROVAL));
  assert.ok(note('g-i', 'L3', 'byod_phone_approved_lesson').some((n) => n.text === R.PHONES_MIDDLE_APPROVAL));
  assert.equal(note('g-i', 'L3', 'laptop_plus_phone').length, 0);
  assert.equal(note('j-l', 'L4', 'own_phones').length, 0);
});

test('L0 with any student device is an info note, not a warning', () => {
  assert.deepEqual(note('teachers', 'L0', 'adult_laptop'), [{ level: 'info', text: R.L0_NO_STUDENT_DEVICE }]);
  assert.equal(note('a-b', 'L0', 'facilitator_screen_only').length, 0);
});

test('a-b and c-d with L2 or deeper warn about AI tools; L0/L1 do not', () => {
  for (const band of ['a-b', 'c-d'] as const) {
    for (const depth of ['L2', 'L3', 'L4'] as const) {
      assert.ok(note(band, depth, 'school_tablet_capture_only').some((n) => n.text === R.NO_AI_TOOLS_LOWER_ELEMENTARY), `${band} ${depth}`);
    }
    assert.ok(!note(band, 'L1', 'school_tablet_capture_only').some((n) => n.text === R.NO_AI_TOOLS_LOWER_ELEMENTARY));
  }
  assert.ok(!note('e-f', 'L3', 'school_tablet_teacher_controlled').some((n) => n.text === R.NO_AI_TOOLS_LOWER_ELEMENTARY));
});

test('the defaults of every band produce no warning', () => {
  for (const band of T.BANDS) {
    const notes = note(band, R.DEFAULT_DEPTH_BY_BAND[band], R.DEFAULT_DEVICE_BY_BAND[band]);
    assert.deepEqual(notes.filter((n) => n.level === 'warning'), [], band);
  }
});

test('no band: only the L0 rule can fire', () => {
  assert.equal(note(null, 'L3', 'own_phones').length, 0);
  assert.equal(note(null, 'L0', 'own_phones').length, 1);
});

// ── prefill ───────────────────────────────────────────────────────────
const CURRENT = { band: null, cycleDepth: 'L3', deviceMode: 'own_phones' } as const;

test('prefillFromTemplate: template values win, band defaults fill the gaps, current values are the last resort', () => {
  assert.deepEqual(
    R.prefillFromTemplate({ band: 'e-f', cycle_depth: 'L1', default_device_mode: 'facilitator_screen_only' }, CURRENT),
    { band: 'e-f', cycleDepth: 'L1', deviceMode: 'facilitator_screen_only' },
  );
  assert.deepEqual(
    R.prefillFromTemplate({ band: 'j-l', cycle_depth: null, default_device_mode: null }, CURRENT),
    { band: 'j-l', cycleDepth: 'L4', deviceMode: 'laptop_plus_phone' },
  );
  assert.deepEqual(R.prefillFromTemplate({ band: null, cycle_depth: null, default_device_mode: null }, CURRENT), { ...CURRENT });
});

test('prefillFromBand re-derives depth and device, and keeps them when the band is cleared', () => {
  assert.deepEqual(R.prefillFromBand('a-b', CURRENT), { band: 'a-b', cycleDepth: 'L0', deviceMode: 'facilitator_screen_only' });
  assert.deepEqual(
    R.prefillFromBand(null, { band: 'a-b', cycleDepth: 'L0', deviceMode: 'facilitator_screen_only' }),
    { band: null, cycleDepth: 'L0', deviceMode: 'facilitator_screen_only' },
  );
});

// ── labels ────────────────────────────────────────────────────────────
test('every enum value has a Hebrew label, a short label and an option entry', () => {
  for (const d of T.DEVICE_MODES) {
    assert.match(O.DEVICE_LABELS[d], /[֐-׿]/, d);
    assert.match(O.DEVICE_SHORT_LABELS[d], /[֐-׿]/, d);
  }
  for (const c of T.CYCLE_DEPTHS) assert.match(O.CYCLE_DEPTH_LABELS[c], /[֐-׿]/, c);
  for (const b of T.BANDS) assert.match(O.BAND_LABELS[b], /[֐-׿]/, b);
  for (const r of T.RELEASE_STATUSES) assert.match(O.RELEASE_STATUS_LABELS[r], /[֐-׿]/, r);
  assert.deepEqual(O.DEVICE_OPTIONS.map((o) => o.value), [...T.DEVICE_MODES]);
  assert.deepEqual(O.CYCLE_DEPTH_OPTIONS.map((o) => o.value), [...T.CYCLE_DEPTHS]);
  assert.deepEqual(O.BAND_OPTIONS.map((o) => o.value), [...T.BANDS]);
  assert.deepEqual(O.RELEASE_STATUS_OPTIONS.map((o) => o.value), [...T.RELEASE_STATUSES]);
});

// ── assessment rendering ──────────────────────────────────────────────
test('concept summary: under 15 respondents shows "X מתוך Y", otherwise raw counts and a percentage', () => {
  assert.equal(A.MIN_RESPONDENTS, 15);
  assert.equal(A.isSmallSample(14), true);
  assert.equal(A.isSmallSample(15), false);
  assert.deepEqual(A.countLabels(12, [3, 5, 4]), ['3 מתוך 12', '5 מתוך 12', '4 מתוך 12']);
  assert.deepEqual(A.countLabels(20, [10, 6, 4]), ['10', '6', '4']);
  assert.equal(A.correctLabel(null), '-');
  assert.equal(A.correctLabel(66.67), '67%');
  assert.equal(A.correctLabel(0), '0%');
});

test('groupTemplatesByBand follows BANDS order and puts band-less templates last', () => {
  const tpls = [
    { id: '1', band: 'j-l' }, { id: '2', band: null }, { id: '3', band: 'a-b' }, { id: '4', band: 'a-b' },
  ] as const;
  const groups = G.groupTemplatesByBand(tpls, (b) => O.BAND_LABELS[b], O.NO_BAND_LABEL);
  assert.deepEqual(groups.map((g) => g.band), ['a-b', 'j-l', null]);
  assert.deepEqual(groups[0].items.map((t) => t.id), ['3', '4']);
  assert.equal(groups[0].label, 'א-ב');
  assert.equal(groups[2].label, O.NO_BAND_LABEL);
});

test('templateGateNote: live is silent, draft shows the note, blocked falls back to the product list', () => {
  assert.equal(G.templateGateNote({ release_status: 'live', ai_gate_note: 'x', requires_product: ['a'] }), null);
  assert.equal(G.templateGateNote({ release_status: 'draft', ai_gate_note: 'ממתין לאישור', requires_product: [] }), 'ממתין לאישור');
  assert.equal(G.templateGateNote({ release_status: 'draft', ai_gate_note: null, requires_product: [] }), null);
  assert.equal(G.templateGateNote({ release_status: 'blocked', ai_gate_note: null, requires_product: ['pocket_trainer', 'lan'] }),
    'תלוי מוצר: pocket_trainer, lan');
  assert.match(G.templateGateNote({ release_status: 'blocked', ai_gate_note: null, requires_product: [] }) ?? '', /תלוי מוצר/);
});

test('sortConceptRows orders by module title then pre before post, without mutating the input', () => {
  const row = (module_title: string, phase: 'pre' | 'post') =>
    ({ session_module_id: module_title, module_title, phase, n: 0, items: [] });
  const rows = [row('ב', 'post'), row('א', 'post'), row('א', 'pre')];
  const sorted = A.sortConceptRows(rows);
  assert.deepEqual(sorted.map((r) => `${r.module_title}:${r.phase}`), ['א:pre', 'א:post', 'ב:post']);
  assert.equal(rows[0].module_title, 'ב');
});
