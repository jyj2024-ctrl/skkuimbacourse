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

test('filterCourses applies the group filter', () => {
  const result = Logic.filterCourses(sample, { group: 'B' });
  assert.deepEqual(result.map((c) => c.id), ['b1']);
  assert.deepEqual(Logic.filterCourses(sample, { group: 'A' }).map((c) => c.id), ['a1', 'a2']);
});

test('filterCourses combines group with track/field/query as AND conditions', () => {
  const result = Logic.filterCourses(sample, { group: 'A', track: '전공심화' });
  assert.deepEqual(result.map((c) => c.id), ['a2']);
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

test('parseCurriculum splits "N주차: 내용" entries into week/content pairs', () => {
  const result = Logic.parseCurriculum('1주차: 개관; 2주차: 은행이란?; 8주차: 중간고사');
  assert.deepEqual(result, [
    { week: '1주차', content: '개관' },
    { week: '2주차', content: '은행이란?' },
    { week: '8주차', content: '중간고사' },
  ]);
});

test('parseCurriculum keeps only the first colon as the week/content split', () => {
  const result = Logic.parseCurriculum('6~7,9주차: 재무비율분석: 상세');
  assert.deepEqual(result, [{ week: '6~7,9주차', content: '재무비율분석: 상세' }]);
});

test('parseCurriculum puts a colon-less trailing entry (e.g. "기말고사") in content with an empty week', () => {
  const result = Logic.parseCurriculum('15주차: 소비자행동과 마케팅; 기말고사');
  assert.deepEqual(result, [
    { week: '15주차', content: '소비자행동과 마케팅' },
    { week: '', content: '기말고사' },
  ]);
});

test('parseCurriculum returns an empty array for a null/undefined curriculum', () => {
  assert.deepEqual(Logic.parseCurriculum(null), []);
  assert.deepEqual(Logic.parseCurriculum(undefined), []);
});

test('summarizeOpinion returns only the first line of a multi-line opinion', () => {
  const opinion = '난이도: 중. 핵심 한줄평.\n추가로 덧붙인 상세 코멘트 1\n상세 코멘트 2';
  assert.equal(Logic.summarizeOpinion(opinion), '난이도: 중. 핵심 한줄평.');
});

test('summarizeOpinion returns the whole text unchanged when there is no newline', () => {
  assert.equal(Logic.summarizeOpinion('교수 변경'), '교수 변경');
});

test('summarizeOpinion returns an empty string for empty/null input', () => {
  assert.equal(Logic.summarizeOpinion(''), '');
  assert.equal(Logic.summarizeOpinion(null), '');
});

const scheduleSample = [
  {
    id: 'x1', name: '기업재무전략론',
    sessions: [
      { date: '2026-09-05', startTime: '09:00', endTime: '12:00', type: '오프라인', session: '1/5', period: '1교시' },
      { date: '2026-10-24', startTime: '09:00', endTime: '12:00', type: '오프라인', session: '2/5', period: '1교시' },
    ],
  },
  {
    id: 'x2', name: '창업실무론',
    sessions: [{ date: '2026-09-01', startTime: '08:00', endTime: '10:00', type: '화상', session: '1/3' }],
  },
  { id: 'x3', name: '핀테크와행동재무', sessions: null },
];

test('buildScheduleRows merges sessions from every selected course, sorted by date then time', () => {
  const rows = Logic.buildScheduleRows(scheduleSample);
  assert.deepEqual(
    rows.map((r) => [r.date, r.startTime, r.courseName]),
    [
      ['2026-09-01', '08:00', '창업실무론'],
      ['2026-09-05', '09:00', '기업재무전략론'],
      ['2026-10-24', '09:00', '기업재무전략론'],
    ]
  );
});

test('buildScheduleRows computes the correct Korean weekday label from the date', () => {
  const rows = Logic.buildScheduleRows(scheduleSample);
  assert.equal(rows.find((r) => r.date === '2026-09-01').dayOfWeek, '화');
  assert.equal(rows.find((r) => r.date === '2026-09-05').dayOfWeek, '토');
});

test('buildScheduleRows skips courses with no sessions and carries type/session/period', () => {
  const rows = Logic.buildScheduleRows(scheduleSample);
  assert.equal(rows.length, 3);
  assert.ok(!rows.some((r) => r.courseName === '핀테크와행동재무'));
  const videoRow = rows.find((r) => r.courseName === '창업실무론');
  assert.equal(videoRow.type, '화상');
  assert.equal(videoRow.session, '1/3');
  assert.equal(videoRow.period, '');
  const offlineRow = rows.find((r) => r.date === '2026-10-24');
  assert.equal(offlineRow.type, '오프라인');
  assert.equal(offlineRow.period, '1교시');
});

test('buildScheduleRows returns an empty array when no selected course has sessions', () => {
  assert.deepEqual(Logic.buildScheduleRows([scheduleSample[2]]), []);
  assert.deepEqual(Logic.buildScheduleRows([]), []);
});

test('buildCalendarMonths groups rows into one entry per year-month, sorted chronologically', () => {
  const rows = Logic.buildScheduleRows(scheduleSample); // spans 2026-09 and 2026-10
  const months = Logic.buildCalendarMonths(rows);
  assert.deepEqual(
    months.map((m) => [m.year, m.month, m.label]),
    [
      [2026, 9, '2026년 9월'],
      [2026, 10, '2026년 10월'],
    ]
  );
});

test('buildCalendarMonths pads leading blanks to align the 1st with its weekday, and pads trailing blanks to a full week', () => {
  const months = Logic.buildCalendarMonths(Logic.buildScheduleRows(scheduleSample));
  const september = months.find((m) => m.month === 9); // 2026-09-01 is a Tuesday (weekday 2)
  assert.equal(september.days.length % 7, 0);
  assert.deepEqual(september.days.slice(0, 2), [null, null]);
  assert.equal(september.days[2].date, '2026-09-01');
  assert.equal(september.days[2].day, 1);
  const lastRealDay = september.days.filter(Boolean).at(-1);
  assert.equal(lastRealDay.date, '2026-09-30');
});

test('buildCalendarMonths attaches each date\'s sessions, sorted by start time', () => {
  const rows = [
    { date: '2026-09-05', startTime: '13:00', endTime: '14:00', courseName: 'B과목', type: '오프라인' },
    { date: '2026-09-05', startTime: '09:00', endTime: '10:00', courseName: 'A과목', type: '오프라인' },
  ];
  const months = Logic.buildCalendarMonths(rows);
  const day = months[0].days.find((d) => d && d.date === '2026-09-05');
  assert.deepEqual(
    day.sessions.map((s) => s.courseName),
    ['A과목', 'B과목']
  );
});

test('buildCalendarMonths gives days with no class an empty sessions array', () => {
  const rows = [{ date: '2026-09-05', startTime: '09:00', endTime: '10:00', courseName: 'A과목', type: '오프라인' }];
  const months = Logic.buildCalendarMonths(rows);
  const emptyDay = months[0].days.find((d) => d && d.date === '2026-09-01');
  assert.deepEqual(emptyDay.sessions, []);
});
