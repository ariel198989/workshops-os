import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qrSvg } from '../lib/qr.ts';

test('qrSvg returns a square module count and a path made of unit-height rectangles', () => {
  const { size, path } = qrSvg('https://workshops-student.vercel.app/model/abc234xyz789');
  assert.ok(size >= 21 && size % 4 === 1, `size ${size} is a valid QR version`);
  assert.ok(path.length > 0);
  // every command is "M<col> <row>h<w>v1h-<w>z": merged horizontal runs, nothing else
  assert.ok(/^(M\d+ \d+h\d+v1h-\d+z)+$/.test(path));
});

test('qrSvg is deterministic and starts with the top-left finder pattern (7 dark modules on row 0)', () => {
  const a = qrSvg('hello');
  const b = qrSvg('hello');
  assert.deepEqual(a, b);
  assert.ok(a.path.startsWith('M0 0h7v1h-7z'));
});

test('qrSvg grows with longer input', () => {
  assert.ok(qrSvg('a'.repeat(120)).size > qrSvg('a').size);
});
