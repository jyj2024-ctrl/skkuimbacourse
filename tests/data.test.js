const test = require('node:test');
const assert = require('node:assert/strict');
const COURSES = require('../data.js');

test('data.js exposes exactly 30 courses', () => {
  assert.equal(COURSES.length, 30);
});

test('every course has the required fields and a valid difficulty', () => {
  const allowedDifficulty = new Set(['상', '중', '하', '신규과목']);
  const allowedTrack = new Set(['전공기반', '전공심화']);
  for (const course of COURSES) {
    assert.equal(typeof course.id, 'string', `${course.name}: id should be a string`);
    assert.equal(typeof course.group, 'string', `${course.name}: group should be a string`);
    assert.ok(allowedTrack.has(course.track), `${course.name}: unexpected track "${course.track}"`);
    assert.equal(typeof course.name, 'string');
    assert.equal(typeof course.professor, 'string');
    assert.ok(allowedDifficulty.has(course.difficulty), `${course.name}: unexpected difficulty "${course.difficulty}"`);
    assert.equal(typeof course.studentOpinion, 'string');
  }
});

test('course ids are unique', () => {
  const ids = COURSES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('group sizes match the source spreadsheet (A6 B6 C6 D6 E5 F1)', () => {
  const counts = {};
  for (const c of COURSES) counts[c.group] = (counts[c.group] || 0) + 1;
  assert.deepEqual(counts, { A: 6, B: 6, C: 6, D: 6, E: 5, F: 1 });
});

test('exactly 22 courses have a non-null syllabus', () => {
  assert.equal(COURSES.filter((c) => c.syllabus !== null).length, 22);
});

test('courses with a syllabus expose all six documented fields (value may be null)', () => {
  for (const c of COURSES) {
    if (c.syllabus === null) continue;
    for (const field of ['method', 'objective', 'evaluation', 'curriculum', 'textbook', 'note']) {
      assert.ok(field in c.syllabus, `${c.name} syllabus missing "${field}" key`);
    }
  }
});
