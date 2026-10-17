import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasConsoleAccess, roleLabel, isPublicPath, type Whoami } from '../lib/shell-access.ts';
import { visibleNavItems } from '../lib/nav.ts';

const staff = (role: 'owner' | 'admin' | 'instructor' | 'guest'): Whoami => ({
  user_id: 'u1', staff: { role, full_name: 'x' }, workshops: [], participations: [],
});

test('staff member has access', () => {
  assert.equal(hasConsoleAccess(staff('instructor')), true);
});

test('no staff and no participations means no access', () => {
  const w: Whoami = { user_id: 'u', staff: null, workshops: [], participations: [] };
  assert.equal(hasConsoleAccess(w), false);
});

test('participant without staff row has access', () => {
  const w: Whoami = { user_id: 'u', staff: null, workshops: [], participations: [{ id: 'p1' }] };
  assert.equal(hasConsoleAccess(w), true);
});

test('null whoami (rpc missing) means no access', () => {
  assert.equal(hasConsoleAccess(null), false);
});

test('role labels are Hebrew', () => {
  assert.equal(roleLabel('owner'), 'בעלים');
  assert.equal(roleLabel('admin'), 'מנהל');
  assert.equal(roleLabel('instructor'), 'מדריך');
  assert.equal(roleLabel('guest'), 'אורח');
  assert.equal(roleLabel(null), '');
});

test('staff nav item only for owner and admin', () => {
  const has = (r: Parameters<typeof visibleNavItems>[0]) =>
    visibleNavItems(r).some((n) => n.href === '/staff');
  assert.equal(has('owner'), true);
  assert.equal(has('admin'), true);
  assert.equal(has('instructor'), false);
  assert.equal(has('guest'), false);
  assert.equal(has(null), false);
});

test('verify paths are public', () => {
  assert.equal(isPublicPath('/verify/ABC'), true);
  assert.equal(isPublicPath('/verify'), true);
  assert.equal(isPublicPath('/verifying'), false);
  assert.equal(isPublicPath('/workshops'), false);
  assert.equal(isPublicPath(null), false);
});
