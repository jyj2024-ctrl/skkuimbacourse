const test = require('node:test');
const assert = require('node:assert/strict');
const Logic = require('../logic.js');

const sample = [
  {
    id: 'a1', group: 'A', track: '전공기반', name: '회계와기업경영', professor: '이종은',
    field: null, difficulty: '하', studentOpinion: '기초',
    syllabus: { method: '온라인', objective: '목표', evaluation: '시험', curriculum: '1주차', textbook: '교재', note: null },
  },
  {
    id: 'a2', group: 'A', track: '전공심화', name: '유통관리론', professor: '류성민',
    field: 'Marketing/Management', difficulty: '중', studentOpinion: '출석중요', syllabus: null,
  },
  {
    id: 'b1', group: 'B', track: '전공기반', name: '재무의이해', professor: '오종민',
    field: null, difficulty: '중', studentOpinion: '엑셀', syllabus: null,
  },
];

test('filterCourses matches by name or professor substring, case-insensitive', () => {
  assert.equal(Logic.filterCourses(sample, {}).length, 3);
  assert.equal(Logic.filterCourses(sample, { query: '재무' }).length, 1);
  assert.equal(Logic.filterCourses(sample, { query: '류성민' }).length, 1);
  assert.equal(Logic.filterCourses(sample, { query: 'zzz' }).length, 0);
});

test('filterCourses applies the track filter', () => {
  const result = Logic.filterCourses(sample, { track: '전공심화' });
  assert.deepEqual(result.map((c) => c.id), ['a2']);
});

test('filterCourses applies the field filter, excluding courses with no field', () => {
  const result = Logic.filterCourses(sample, { field: 'Marketing/Management' });
  assert.deepEqual(result.map((c) => c.id), ['a2']);
  assert.deepEqual(Logic.filterCourses(sample, { field: 'Accounting/Finance' }), []);
});

test('groupCourses buckets courses under every known group letter, in GROUP_ORDER', () => {
  const grouped = Logic.groupCourses(sample);
  assert.deepEqual(Object.keys(grouped), Logic.GROUP_ORDER);
  assert.equal(grouped.A.length, 2);
  assert.equal(grouped.B.length, 1);
  assert.equal(grouped.C.length, 0);
});

test('findGroupConflicts flags groups with 2+ selected courses', () => {
  const conflicts = Logic.findGroupConflicts(sample); // a1 + a2 both group A
  assert.deepEqual(conflicts, [{ group: 'A', names: ['회계와기업경영', '유통관리론'] }]);
});

test('findGroupConflicts returns an empty array when no group repeats', () => {
  const conflicts = Logic.findGroupConflicts([sample[0], sample[2]]); // group A + B
  assert.deepEqual(conflicts, []);
});

test('buildCompareRows shows "수업계획서 미제출" for a course without a syllabus', () => {
  const rows = Logic.buildCompareRows([sample[0], sample[1]]);
  const methodRow = rows.find((r) => r.key === 'method');
  assert.deepEqual(methodRow.values, ['온라인', '수업계획서 미제출']);
});

test('buildCompareRows falls back to "정보 없음" for a present syllabus with a null field', () => {
  const rows = Logic.buildCompareRows([sample[0]]);
  const noteRow = rows.find((r) => r.key === 'note');
  assert.deepEqual(noteRow.values, ['정보 없음']);
});

test('buildCompareRows includes base fields (group/track/professor/studentOpinion)', () => {
  const rows = Logic.buildCompareRows([sample[0]]);
  assert.deepEqual(rows.find((r) => r.key === 'group').values, ['A']);
  assert.deepEqual(rows.find((r) => r.key === 'studentOpinion').values, ['기초']);
  assert.equal(rows.find((r) => r.key === 'difficulty'), undefined);
});

test('buildCompareRows shows "-" for the field row on a 전공기반 course, and the field value otherwise', () => {
  const rows = Logic.buildCompareRows([sample[0], sample[1]]);
  const fieldRow = rows.find((r) => r.key === 'field');
  assert.deepEqual(fieldRow.values, ['-', 'Marketing/Management']);
});
