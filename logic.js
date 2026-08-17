const GROUP_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];

const FIELD_ORDER = ['Marketing/Management', 'Accounting/Finance', 'Global/Innovation'];

const SYLLABUS_FIELDS = ['method', 'objective', 'evaluation', 'curriculum', 'textbook', 'note'];

const COMPARE_ROWS = [
  { key: 'group', label: '그룹' },
  { key: 'track', label: '구분' },
  { key: 'field', label: '분야' },
  { key: 'professor', label: '교수' },
  { key: 'studentOpinion', label: '학생 의견' },
  { key: 'method', label: '강의방식' },
  { key: 'objective', label: '수업목표/개요' },
  { key: 'evaluation', label: '평가방법' },
  { key: 'curriculum', label: '주차별 커리큘럼' },
  { key: 'textbook', label: '교재/참고자료' },
  { key: 'note', label: '비고' },
];

function filterCourses(courses, options) {
  const { query = '', track = 'all', field = 'all', group = 'all' } = options || {};
  const q = query.trim().toLowerCase();
  return courses.filter((course) => {
    if (track !== 'all' && course.track !== track) return false;
    if (field !== 'all' && course.field !== field) return false;
    if (group !== 'all' && course.group !== group) return false;
    if (q) {
      const haystack = `${course.name} ${course.professor}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function groupCourses(courses) {
  const grouped = {};
  for (const group of GROUP_ORDER) grouped[group] = [];
  for (const course of courses) {
    if (!grouped[course.group]) grouped[course.group] = [];
    grouped[course.group].push(course);
  }
  return grouped;
}

function findGroupConflicts(selectedCourses) {
  const byGroup = {};
  for (const course of selectedCourses) {
    if (!byGroup[course.group]) byGroup[course.group] = [];
    byGroup[course.group].push(course.name);
  }
  return Object.keys(byGroup)
    .filter((group) => byGroup[group].length > 1)
    .sort()
    .map((group) => ({ group, names: byGroup[group] }));
}

function cellValue(course, key) {
  if (SYLLABUS_FIELDS.includes(key)) {
    if (!course.syllabus) return '수업계획서 미제출';
    return course.syllabus[key] || '정보 없음';
  }
  if (key === 'studentOpinion') return course.studentOpinion || '정보 없음';
  if (key === 'field') return course.field || '-';
  return course[key];
}

function buildCompareRows(selectedCourses) {
  return COMPARE_ROWS.map((row) => ({
    key: row.key,
    label: row.label,
    values: selectedCourses.map((course) => cellValue(course, row.key)),
  }));
}

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

function buildScheduleRows(selectedCourses) {
  const rows = [];
  for (const course of selectedCourses) {
    if (!course.sessions) continue;
    for (const session of course.sessions) {
      const parsedDate = new Date(`${session.date}T00:00:00`);
      const dayOfWeek = Number.isNaN(parsedDate.getTime()) ? '' : WEEKDAY_LABEL[parsedDate.getDay()];
      rows.push({
        date: session.date,
        dayOfWeek,
        startTime: session.startTime || '',
        endTime: session.endTime || '',
        courseName: course.name,
        type: session.type || '',
        session: session.session || '',
        period: session.period || '',
      });
    }
  }
  return rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    return 0;
  });
}

function buildCalendarMonths(scheduleRows) {
  const byMonth = {};
  for (const row of scheduleRows) {
    const ym = row.date.slice(0, 7);
    if (!byMonth[ym]) byMonth[ym] = {};
    if (!byMonth[ym][row.date]) byMonth[ym][row.date] = [];
    byMonth[ym][row.date].push(row);
  }

  return Object.keys(byMonth)
    .sort()
    .map((ym) => {
      const [year, month] = ym.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const startWeekday = new Date(year, month - 1, 1).getDay();

      const days = [];
      for (let i = 0; i < startWeekday; i++) days.push(null);
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${ym}-${String(d).padStart(2, '0')}`;
        const sessions = (byMonth[ym][dateStr] || [])
          .slice()
          .sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0));
        days.push({ date: dateStr, day: d, sessions });
      }
      while (days.length % 7 !== 0) days.push(null);

      return { year, month, label: `${year}년 ${month}월`, days };
    });
}

function summarizeOpinion(studentOpinion) {
  if (!studentOpinion) return '';
  const firstLine = studentOpinion.split('\n')[0].trim();
  return firstLine || studentOpinion.trim();
}

function parseCurriculum(curriculum) {
  if (!curriculum) return [];
  return curriculum
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.indexOf(':');
      if (idx === -1) return { week: '', content: entry };
      return { week: entry.slice(0, idx).trim(), content: entry.slice(idx + 1).trim() };
    });
}

const Logic = {
  GROUP_ORDER,
  FIELD_ORDER,
  filterCourses,
  groupCourses,
  findGroupConflicts,
  buildCompareRows,
  parseCurriculum,
  buildScheduleRows,
  buildCalendarMonths,
  summarizeOpinion,
};

if (typeof module !== 'undefined') {
  module.exports = Logic;
} else if (typeof window !== 'undefined') {
  window.Logic = Logic;
}
