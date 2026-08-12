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

test('전공기반 courses have no field, 전공심화 courses have a valid field', () => {
  const allowedField = new Set(['Marketing/Management', 'Accounting/Finance', 'Global/Innovation']);
  for (const c of COURSES) {
    if (c.track === '전공기반') {
      assert.equal(c.field, null, `${c.name}: 전공기반 course should have field: null`);
    } else {
      assert.ok(allowedField.has(c.field), `${c.name}: unexpected field "${c.field}"`);
    }
  }
});

test('field distribution matches the field reference table (8 Marketing/Management, 9 Accounting/Finance, 7 Global/Innovation)', () => {
  const counts = {};
  for (const c of COURSES) {
    if (c.field) counts[c.field] = (counts[c.field] || 0) + 1;
  }
  assert.deepEqual(counts, {
    'Marketing/Management': 8,
    'Accounting/Finance': 9,
    'Global/Innovation': 7,
  });
});

test('every course has a sessions array (오프라인/화상 class schedule)', () => {
  for (const c of COURSES) {
    assert.ok('sessions' in c, `${c.name} missing sessions key`);
    assert.ok(Array.isArray(c.sessions) && c.sessions.length > 0, `${c.name}: sessions should be a non-empty array`);
  }
});

test('every session entry has a valid date, start/end time, and type', () => {
  const allowedType = new Set(['오프라인', '화상']);
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const timeRe = /^\d{2}:\d{2}$/;
  for (const c of COURSES) {
    for (const session of c.sessions) {
      assert.ok(dateRe.test(session.date), `${c.name}: invalid date "${session.date}"`);
      assert.ok(timeRe.test(session.startTime), `${c.name}: invalid startTime "${session.startTime}"`);
      assert.ok(timeRe.test(session.endTime), `${c.name}: invalid endTime "${session.endTime}"`);
      assert.ok(allowedType.has(session.type), `${c.name}: unexpected session type "${session.type}"`);
    }
  }
});

test('offline sessions carry a 교시 period label, video sessions do not', () => {
  for (const c of COURSES) {
    for (const session of c.sessions) {
      if (session.type === '오프라인') {
        assert.equal(typeof session.period, 'string', `${c.name}: offline session missing period`);
      } else {
        assert.ok(!('period' in session), `${c.name}: video session should not have a period field`);
      }
    }
  }
});

test('total session count across all courses matches the imported schedule (236)', () => {
  const total = COURSES.reduce((sum, c) => sum + c.sessions.length, 0);
  assert.equal(total, 236);
});
