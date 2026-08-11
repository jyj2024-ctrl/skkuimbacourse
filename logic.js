const GROUP_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];

const FIELD_ORDER = ['Marketing/Management', 'Accounting/Finance', 'Global/Innovation'];

const SYLLABUS_FIELDS = ['method', 'objective', 'evaluation', 'curriculum', 'textbook', 'note'];

const COMPARE_ROWS = [
  { key: 'group', label: '그룹' },
  { key: 'track', label: '구분' },
  { key: 'field', label: '분야' },
  { key: 'professor', label: '교수' },
  { key: 'difficulty', label: '난이도' },
  { key: 'studentOpinion', label: '학생 의견' },
  { key: 'method', label: '강의방식' },
  { key: 'objective', label: '수업목표/개요' },
  { key: 'evaluation', label: '평가방법' },
  { key: 'curriculum', label: '주차별 커리큘럼' },
  { key: 'textbook', label: '교재/참고자료' },
  { key: 'note', label: '비고' },
];

function filterCourses(courses, options) {
  const { query = '', track = 'all', difficulty = 'all', field = 'all' } = options || {};
  const q = query.trim().toLowerCase();
  return courses.filter((course) => {
    if (track !== 'all' && course.track !== track) return false;
    if (difficulty !== 'all' && course.difficulty !== difficulty) return false;
    if (field !== 'all' && course.field !== field) return false;
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

const Logic = { GROUP_ORDER, FIELD_ORDER, filterCourses, groupCourses, findGroupConflicts, buildCompareRows };

if (typeof module !== 'undefined') {
  module.exports = Logic;
} else if (typeof window !== 'undefined') {
  window.Logic = Logic;
}
