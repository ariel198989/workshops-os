import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STUDENT_URL, joinCopyText, joinLine, resolveStudentUrl } from '../lib/student-app.ts';

test('falls back to the default student app url when the env var is missing or blank', () => {
  assert.equal(resolveStudentUrl(undefined), DEFAULT_STUDENT_URL);
  assert.equal(resolveStudentUrl(''), DEFAULT_STUDENT_URL);
  assert.equal(resolveStudentUrl('   '), DEFAULT_STUDENT_URL);
});

test('default url is the deployed student app', () => {
  assert.equal(DEFAULT_STUDENT_URL, 'https://workshops-student.vercel.app');
});

test('uses a configured url, trimmed and without trailing slashes', () => {
  assert.equal(resolveStudentUrl(' https://students.example.com// '), 'https://students.example.com');
});

test('rejects values that are not http(s) urls', () => {
  assert.equal(resolveStudentUrl('javascript:alert(1)'), DEFAULT_STUDENT_URL);
  assert.equal(resolveStudentUrl('not a url'), DEFAULT_STUDENT_URL);
});

test('join line shows the workshop code and the student app url together', () => {
  assert.equal(joinLine('OFEK-H2-27', 'https://s.example.com'), 'קוד הצטרפות: OFEK-H2-27 · https://s.example.com');
});

test('copy text carries both the url and the code', () => {
  const text = joinCopyText('OFEK-H2-27', 'https://s.example.com');
  assert.ok(text.includes('https://s.example.com'));
  assert.ok(text.includes('OFEK-H2-27'));
});
