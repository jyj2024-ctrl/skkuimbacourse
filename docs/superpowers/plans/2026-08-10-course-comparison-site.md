# SKKU IMBA 과목 비교 사이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, dependency-free web page where students browse SKKU IMBA 2026-2 courses grouped by A–F scheduling group, filter/search them, and select courses via checkboxes to see a side-by-side comparison table (with a warning when two selected courses share a group and can't be taken together).

**Architecture:** Plain HTML/CSS/JS, no build step. `data.js` holds the merged course dataset as a browser global (`COURSES`) and a CommonJS export (for tests). `logic.js` holds pure, DOM-free functions (filtering, grouping, conflict detection, compare-table construction) also dual-exposed for browser/Node. `app.js` wires DOM rendering and event handling using `COURSES` + the `Logic` object. Tests run with Node's built-in test runner (`node --test`, no dependencies) against `data.js` and `logic.js` only — `app.js` (DOM code) is verified with the Playwright browser tool by loading `index.html` directly (`file://` URL) and inspecting the rendered page, since there is no bundler/dev server in this project.

**Tech Stack:** Vanilla HTML/CSS/JS, Pretendard font via CDN `<link>`, Node.js built-in test runner (`node:test`, `node:assert/strict`) for logic tests, Playwright browser tool for UI verification.

## Global Constraints

- No build tools, no npm dependencies, no framework — the shipped site is plain HTML/CSS/JS files opened directly or hosted as static files.
- All 30 courses must render; 22 have a `syllabus` object, 8 have `syllabus: null` and must show "수업계획서 미제출 (교수님 미등록)" wherever syllabus fields would appear.
- Same-group course selection (2+ checked courses sharing `group`) must show a warning but must NOT block selection.
- UI language is Korean throughout.
- `data.js` already exists in the repo root (committed in `ceb4c1e`) — do not regenerate it; only add tests that verify its shape.
- Visual design follows `docs/superpowers/specs/2026-08-10-course-comparison-site-design.md` (sage-green background `#C9CFA9`-ish, white cards, lime accent `#D8F24C`-ish, pill buttons/badges, Pretendard font, rounded ~20px cards).

---

## Task 1: Data layer tests

**Files:**
- Create: `tests/data.test.js`
- (Reference, not modified) `data.js` — already committed, exposes global `COURSES` in browsers and `module.exports = COURSES` in Node.

**Interfaces:**
- Consumes: `require('../data.js')` → array of 30 course objects: `{ id, group, track, name, professor, difficulty, studentOpinion, syllabus }` where `syllabus` is `null` or `{ method, objective, evaluation, curriculum, textbook, note }` (each a string or `null`).
- Produces: nothing new — this task only adds verification coverage for a file later tasks (`logic.js`, `app.js`) will `require`/`<script src="data.js">`.

- [ ] **Step 1: Write the data shape tests**

Create `tests/data.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests and confirm they pass**

Run: `node --test`
Expected: all 6 tests in `tests/data.test.js` report `pass` (this validates the data prepared during design — there is no red/green cycle here since `data.js` was already generated from the source spreadsheets and committed).

- [ ] **Step 3: Commit**

```bash
git add tests/data.test.js
git commit -m "test: verify data.js shape and counts"
```

---

## Task 2: Pure logic functions (`logic.js`)

**Files:**
- Create: `logic.js`
- Create: `tests/logic.test.js`

**Interfaces:**
- Consumes: nothing (pure functions operating on plain course objects matching the shape from Task 1).
- Produces (used by `app.js` in Task 4+):
  - `Logic.GROUP_ORDER` — `['A', 'B', 'C', 'D', 'E', 'F']`
  - `Logic.filterCourses(courses, { query, track, difficulty })` → filtered array. `track`/`difficulty` default to `'all'` (no filtering), `query` defaults to `''` and matches against `name` or `professor`, case-insensitive substring.
  - `Logic.groupCourses(courses)` → `{ A: [...], B: [...], ..., F: [...] }`, every key from `GROUP_ORDER` always present (possibly empty array).
  - `Logic.findGroupConflicts(selectedCourses)` → `[{ group, names }]` for every group with 2+ courses in `selectedCourses`, sorted by group letter.
  - `Logic.buildCompareRows(selectedCourses)` → array of `{ key, label, values }`, one entry per comparison row (`group, track, professor, difficulty, studentOpinion, method, objective, evaluation, curriculum, textbook, note`), `values` aligned index-for-index with `selectedCourses`. Missing syllabus → `'수업계획서 미제출'` for syllabus-derived rows; present syllabus with a null field → `'정보 없음'`.
  - In the browser, `logic.js` is loaded via `<script src="logic.js">` after `data.js` and defines the same `Logic` object as a global (`window.Logic`); in Node it's `module.exports = Logic`.

- [ ] **Step 1: Write the failing tests**

Create `tests/logic.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const Logic = require('../logic.js');

const sample = [
  {
    id: 'a1', group: 'A', track: '전공기반', name: '회계와기업경영', professor: '이종은',
    difficulty: '하', studentOpinion: '기초',
    syllabus: { method: '온라인', objective: '목표', evaluation: '시험', curriculum: '1주차', textbook: '교재', note: null },
  },
  {
    id: 'a2', group: 'A', track: '전공심화', name: '유통관리론', professor: '류성민',
    difficulty: '중', studentOpinion: '출석중요', syllabus: null,
  },
  {
    id: 'b1', group: 'B', track: '전공기반', name: '재무의이해', professor: '오종민',
    difficulty: '중', studentOpinion: '엑셀', syllabus: null,
  },
];

test('filterCourses matches by name or professor substring, case-insensitive', () => {
  assert.equal(Logic.filterCourses(sample, {}).length, 3);
  assert.equal(Logic.filterCourses(sample, { query: '재무' }).length, 1);
  assert.equal(Logic.filterCourses(sample, { query: '류성민' }).length, 1);
  assert.equal(Logic.filterCourses(sample, { query: 'zzz' }).length, 0);
});

test('filterCourses applies track and difficulty filters as AND conditions', () => {
  const result = Logic.filterCourses(sample, { track: '전공기반', difficulty: '하' });
  assert.deepEqual(result.map((c) => c.id), ['a1']);
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

test('buildCompareRows includes base fields (group/track/professor/difficulty/studentOpinion)', () => {
  const rows = Logic.buildCompareRows([sample[0]]);
  assert.deepEqual(rows.find((r) => r.key === 'group').values, ['A']);
  assert.deepEqual(rows.find((r) => r.key === 'difficulty').values, ['하']);
  assert.deepEqual(rows.find((r) => r.key === 'studentOpinion').values, ['기초']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test`
Expected: FAIL — `Cannot find module '../logic.js'`

- [ ] **Step 3: Implement `logic.js`**

Create `logic.js`:

```js
const GROUP_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];

const SYLLABUS_FIELDS = ['method', 'objective', 'evaluation', 'curriculum', 'textbook', 'note'];

const COMPARE_ROWS = [
  { key: 'group', label: '그룹' },
  { key: 'track', label: '구분' },
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
  const { query = '', track = 'all', difficulty = 'all' } = options || {};
  const q = query.trim().toLowerCase();
  return courses.filter((course) => {
    if (track !== 'all' && course.track !== track) return false;
    if (difficulty !== 'all' && course.difficulty !== difficulty) return false;
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
  return course[key];
}

function buildCompareRows(selectedCourses) {
  return COMPARE_ROWS.map((row) => ({
    key: row.key,
    label: row.label,
    values: selectedCourses.map((course) => cellValue(course, row.key)),
  }));
}

const Logic = { GROUP_ORDER, filterCourses, groupCourses, findGroupConflicts, buildCompareRows };

if (typeof module !== 'undefined') {
  module.exports = Logic;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test`
Expected: all tests in `tests/data.test.js` and `tests/logic.test.js` report `pass`.

- [ ] **Step 5: Commit**

```bash
git add logic.js tests/logic.test.js
git commit -m "feat: add pure filter/group/conflict/compare logic with tests"
```

---

## Task 3: HTML skeleton and base visual design (`index.html`, `style.css`)

**Files:**
- Create: `index.html`
- Create: `style.css`

**Interfaces:**
- Consumes: none yet (no `<script>` wiring in this task beyond `<script src="data.js">`/`logic.js` placeholders — `app.js` is added in Task 4).
- Produces: DOM element IDs/classes that Task 4+ relies on:
  - `#course-list` (empty `<main>`, filled by `app.js`)
  - `#search-input`, `#track-filter`, `#difficulty-filter` (toolbar controls)
  - `#compare-bar` (fixed bottom bar, starts with class `hidden`) containing `.compare-count`, `.compare-chips`, `.compare-warning`, `#compare-btn`, `#reset-btn`
  - `#compare-section` (starts with class `hidden`)
  - `#modal-overlay` (starts with class `hidden`) containing `#modal-close` and `#modal-body`
  - CSS classes used by later tasks: `.course-card`, `.course-card-checkbox`, `.course-checkbox`, `.group-section`, `.group-heading`, `.group-badge`, `.group-{A..F}`, `.badge`, `.diff-high`, `.diff-mid`, `.diff-low`, `.diff-new`, `.chip`, `.compare-table`, `.compare-table-wrap`, `.compare-conflict-banner`, `.compare-col-conflict`, `.visually-hidden`, `.hidden`

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SKKU IMBA 2026-2 과목비교</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="site-header">
    <div class="site-header-inner">
      <div class="logo"><span class="logo-mark">S</span> SKKU IMBA 과목비교</div>
      <span class="badge badge-notice">⚠ 같은 그룹 과목은 동시 수강이 불가합니다</span>
    </div>
    <h1 class="hero-title">2026년 2학기, <em>어떤 과목</em>을<br />들을지 <strong>비교</strong>해보세요</h1>
    <p class="hero-subtitle">그룹 A~F · 전공기반/전공심화 · 교수·난이도·학생 의견·강의계획서 요약까지 한눈에</p>
  </header>

  <div class="toolbar">
    <input id="search-input" type="text" class="search-input" placeholder="과목명 또는 교수명 검색" />
    <div class="filter-group" id="track-filter" data-value="all">
      <button type="button" class="filter-pill is-active" data-value="all">전체</button>
      <button type="button" class="filter-pill" data-value="전공기반">전공기반</button>
      <button type="button" class="filter-pill" data-value="전공심화">전공심화</button>
    </div>
    <div class="filter-group" id="difficulty-filter" data-value="all">
      <button type="button" class="filter-pill is-active" data-value="all">난이도 전체</button>
      <button type="button" class="filter-pill" data-value="상">상</button>
      <button type="button" class="filter-pill" data-value="중">중</button>
      <button type="button" class="filter-pill" data-value="하">하</button>
    </div>
  </div>

  <main id="course-list"></main>

  <section id="compare-section" class="compare-section hidden"></section>

  <div id="compare-bar" class="compare-bar hidden">
    <div class="compare-bar-inner">
      <span class="compare-count">0개 과목 선택됨</span>
      <div class="compare-chips"></div>
      <span class="compare-warning"></span>
      <div class="compare-bar-actions">
        <button type="button" id="reset-btn" class="btn btn-ghost">초기화</button>
        <button type="button" id="compare-btn" class="btn btn-primary">비교하기</button>
      </div>
    </div>
  </div>

  <div id="modal-overlay" class="modal-overlay hidden">
    <div class="modal" role="dialog" aria-modal="true">
      <button type="button" id="modal-close" class="modal-close" aria-label="닫기">×</button>
      <div id="modal-body"></div>
    </div>
  </div>

  <script src="data.js"></script>
  <script src="logic.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `style.css`**

```css
:root {
  --bg: #c9cfa6;
  --card-bg: #ffffff;
  --ink: #16160f;
  --ink-muted: #5b5f47;
  --accent: #d8f24c;
  --accent-ink: #16160f;
  --border-soft: rgba(22, 22, 15, 0.08);
  --shadow-card: 0 10px 30px rgba(22, 22, 15, 0.10);
  --radius-lg: 20px;
  --radius-md: 14px;
  --radius-pill: 999px;

  --diff-high-bg: #f6c9c2;
  --diff-high-ink: #7a2015;
  --diff-mid-bg: #fcebb0;
  --diff-mid-ink: #7a5400;
  --diff-low-bg: #dcefc0;
  --diff-low-ink: #385c1a;
  --diff-new-bg: #eaeade;
  --diff-new-ink: #4a4a3a;

  --group-a: #f4d9c6;
  --group-b: #d6e8f5;
  --group-c: #e6d9f5;
  --group-d: #d9f0e0;
  --group-e: #f5e4d6;
  --group-f: #f0d6e8;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif;
  line-height: 1.5;
}

.hidden { display: none !important; }

.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Header */
.site-header { max-width: 1100px; margin: 0 auto; padding: 32px 24px 12px; }
.site-header-inner {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 12px; margin-bottom: 28px;
}
.logo { font-weight: 700; font-size: 1.05rem; display: flex; align-items: center; gap: 8px; }
.logo-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--ink); color: var(--accent); font-weight: 800;
}
.hero-title { font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 700; margin: 0 0 12px; }
.hero-title em { font-style: italic; font-weight: 400; }
.hero-title strong { background: var(--accent); padding: 0 6px; border-radius: 6px; }
.hero-subtitle { color: var(--ink-muted); margin: 0; font-size: 1rem; }

/* Toolbar */
.toolbar {
  max-width: 1100px; margin: 0 auto 24px; padding: 0 24px;
  display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
}
.search-input {
  flex: 1 1 220px; padding: 12px 18px; border-radius: var(--radius-pill);
  border: 1px solid var(--border-soft); background: var(--card-bg);
  font-family: inherit; font-size: 0.95rem;
}
.filter-group { display: flex; gap: 6px; flex-wrap: wrap; }
.filter-pill {
  padding: 10px 16px; border-radius: var(--radius-pill); border: 1px solid var(--border-soft);
  background: var(--card-bg); color: var(--ink); font-family: inherit; font-size: 0.85rem;
  cursor: pointer;
}
.filter-pill.is-active { background: var(--ink); color: var(--accent); border-color: var(--ink); }

/* Group sections */
#course-list { max-width: 1100px; margin: 0 auto; padding: 0 24px 40px; }
.group-section { margin-bottom: 36px; }
.group-heading { display: flex; align-items: center; gap: 12px; margin: 0 0 16px; font-size: 1.1rem; }
.group-count { color: var(--ink-muted); font-size: 0.85rem; }

.badge {
  display: inline-flex; align-items: center; padding: 4px 12px;
  border-radius: var(--radius-pill); font-size: 0.78rem; font-weight: 600;
}
.badge-notice { background: var(--card-bg); border: 1px solid var(--border-soft); }
.badge-track { background: var(--ink); color: #fff; }
.group-badge { font-weight: 700; }
.group-A { background: var(--group-a); }
.group-B { background: var(--group-b); }
.group-C { background: var(--group-c); }
.group-D { background: var(--group-d); }
.group-E { background: var(--group-e); }
.group-F { background: var(--group-f); }
.diff-high { background: var(--diff-high-bg); color: var(--diff-high-ink); }
.diff-mid { background: var(--diff-mid-bg); color: var(--diff-mid-ink); }
.diff-low { background: var(--diff-low-bg); color: var(--diff-low-ink); }
.diff-new { background: var(--diff-new-bg); color: var(--diff-new-ink); outline: 1px solid var(--accent); }

/* Cards */
.course-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
}
.course-card {
  position: relative; background: var(--card-bg); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card); padding: 18px; cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.course-card:hover { transform: translateY(-3px); box-shadow: 0 16px 36px rgba(22, 22, 15, 0.14); }
.course-card-checkbox {
  position: absolute; top: 14px; right: 14px; cursor: pointer;
}
.course-card-checkbox input { width: 18px; height: 18px; cursor: pointer; }
.course-card-badges { display: flex; gap: 6px; margin-bottom: 10px; padding-right: 28px; }
.course-card-name { font-size: 1.05rem; margin: 0 0 4px; font-weight: 700; }
.course-card-professor { margin: 0 0 8px; color: var(--ink-muted); font-size: 0.85rem; }
.course-card-opinion {
  margin: 0; font-size: 0.85rem; color: var(--ink);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

/* Compare bar */
.compare-bar {
  position: fixed; left: 0; right: 0; bottom: 0; background: var(--ink); color: #fff;
  padding: 14px 24px; z-index: 40;
}
.compare-bar-inner {
  max-width: 1100px; margin: 0 auto; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
}
.compare-count { font-weight: 700; }
.compare-chips { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; }
.chip {
  background: rgba(255, 255, 255, 0.12); color: #fff; border: none;
  border-radius: var(--radius-pill); padding: 6px 12px; font-size: 0.78rem; cursor: pointer;
}
.compare-warning { color: var(--diff-high-bg); font-size: 0.8rem; }
.compare-bar-actions { display: flex; gap: 8px; }
.btn {
  border: none; border-radius: var(--radius-pill); padding: 10px 20px;
  font-family: inherit; font-weight: 700; cursor: pointer; font-size: 0.85rem;
}
.btn-primary { background: var(--accent); color: var(--accent-ink); }
.btn-ghost { background: transparent; color: #fff; border: 1px solid rgba(255, 255, 255, 0.4); }

/* Compare section */
.compare-section { max-width: 1100px; margin: 0 auto; padding: 40px 24px 120px; }
.compare-heading { font-size: 1.4rem; margin: 0 0 16px; }
.compare-conflict-banner {
  background: var(--diff-high-bg); color: var(--diff-high-ink); padding: 12px 18px;
  border-radius: var(--radius-md); margin-bottom: 16px; font-size: 0.88rem;
}
.compare-table-wrap { overflow-x: auto; border-radius: var(--radius-lg); background: var(--card-bg); box-shadow: var(--shadow-card); }
.compare-table { border-collapse: collapse; width: 100%; min-width: 640px; }
.compare-table th, .compare-table td {
  padding: 12px 16px; border-bottom: 1px solid var(--border-soft); text-align: left; vertical-align: top;
  font-size: 0.85rem;
}
.compare-table thead th { background: #f4f5ec; position: sticky; top: 0; }
.compare-table tbody th { width: 140px; font-weight: 700; background: #fafaf3; }
.compare-col-conflict { background: #fdece9; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(22, 22, 15, 0.5);
  display: flex; align-items: center; justify-content: center; z-index: 50; padding: 24px;
}
.modal {
  position: relative; background: var(--card-bg); border-radius: var(--radius-lg);
  max-width: 640px; width: 100%; max-height: 85vh; overflow-y: auto; padding: 32px;
}
.modal-close {
  position: absolute; top: 16px; right: 16px; width: 32px; height: 32px; border-radius: 50%;
  border: none; background: #f0f0e6; font-size: 1.2rem; cursor: pointer;
}
.modal-professor { color: var(--ink-muted); margin-top: 0; }
.modal-syllabus dt { font-weight: 700; margin-top: 12px; }
.modal-syllabus dd { margin: 4px 0 0; color: var(--ink); }
.modal-no-syllabus { color: var(--ink-muted); font-style: italic; }
.modal-compare-toggle { display: flex; align-items: center; gap: 8px; margin-top: 24px; font-weight: 600; }

/* Responsive */
@media (max-width: 900px) {
  .course-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 600px) {
  .course-grid { grid-template-columns: 1fr; }
  .compare-bar-inner { flex-direction: column; align-items: stretch; }
}
```

- [ ] **Step 3: Verify the skeleton renders without errors**

Use the Playwright browser tool:
1. `browser_navigate` to `file:///c:/Users/yj202/OneDrive/Desktop/바이브코딩/imba subject/index.html`
2. `browser_console_messages` — expect no errors (the `data.js`/`logic.js`/`app.js` `<script>` tags will 404 on `app.js` since it doesn't exist yet; confirm the *only* console error is the missing `app.js`, and `data.js`/`logic.js` load cleanly with no syntax errors)
3. `browser_take_screenshot` — confirm the sage-green background, header, search bar and filter pills render with no layout breakage

- [ ] **Step 4: Commit**

```bash
git add index.html style.css
git commit -m "feat: add page skeleton and base visual design"
```

---

## Task 4: Render course groups and cards (`app.js` part 1)

**Files:**
- Create: `app.js`

**Interfaces:**
- Consumes: `COURSES` (global from `data.js`), `Logic.GROUP_ORDER`/`Logic.groupCourses`/`Logic.filterCourses` (global from `logic.js`), DOM IDs from Task 3 (`#course-list`, `#search-input`, `#track-filter`, `#difficulty-filter`).
- Produces: module-level `state` object (`{ query, track, difficulty, selectedIds }`), `renderGroups()` function — later tasks (5–8) extend this same file and call `renderGroups()` after state changes.

- [ ] **Step 1: Implement rendering and filter wiring in `app.js`**

```js
(function () {
  const state = {
    query: '',
    track: 'all',
    difficulty: 'all',
    selectedIds: new Set(),
  };

  const courseListEl = document.getElementById('course-list');
  const searchInput = document.getElementById('search-input');
  const trackFilterEl = document.getElementById('track-filter');
  const difficultyFilterEl = document.getElementById('difficulty-filter');

  const DIFFICULTY_CLASS = { 상: 'diff-high', 중: 'diff-mid', 하: 'diff-low', 신규과목: 'diff-new' };
  const GROUP_LABEL = { A: '그룹 A', B: '그룹 B', C: '그룹 C', D: '그룹 D', E: '그룹 E', F: '그룹 F' };

  function courseById(id) {
    return COURSES.find((c) => c.id === id);
  }

  function renderCourseCard(course) {
    const card = document.createElement('article');
    card.className = 'course-card';
    card.dataset.id = course.id;
    const checked = state.selectedIds.has(course.id) ? 'checked' : '';
    card.innerHTML = `
      <label class="course-card-checkbox">
        <input type="checkbox" class="course-checkbox" data-id="${course.id}" ${checked} />
        <span class="visually-hidden">${course.name} 비교 선택</span>
      </label>
      <div class="course-card-body">
        <div class="course-card-badges">
          <span class="badge badge-track">${course.track}</span>
          <span class="badge ${DIFFICULTY_CLASS[course.difficulty]}">${course.difficulty}</span>
        </div>
        <h3 class="course-card-name">${course.name}</h3>
        <p class="course-card-professor">${course.professor} 교수</p>
        <p class="course-card-opinion">${course.studentOpinion}</p>
      </div>
    `;
    return card;
  }

  function renderGroups() {
    const filtered = Logic.filterCourses(COURSES, state);
    const grouped = Logic.groupCourses(filtered);
    courseListEl.innerHTML = '';
    for (const group of Logic.GROUP_ORDER) {
      const courses = grouped[group];
      if (!courses || courses.length === 0) continue;
      const section = document.createElement('section');
      section.className = 'group-section';
      section.dataset.group = group;
      section.innerHTML = `<h2 class="group-heading"><span class="badge group-badge group-${group}">${GROUP_LABEL[group]}</span><span class="group-count">${courses.length}개 과목</span></h2>`;
      const grid = document.createElement('div');
      grid.className = 'course-grid';
      for (const course of courses) grid.appendChild(renderCourseCard(course));
      section.appendChild(grid);
      courseListEl.appendChild(section);
    }
  }

  searchInput.addEventListener('input', (event) => {
    state.query = event.target.value;
    renderGroups();
  });

  function wirePillFilter(container, onChange) {
    container.addEventListener('click', (event) => {
      const pill = event.target.closest('.filter-pill');
      if (!pill) return;
      container.querySelectorAll('.filter-pill').forEach((el) => el.classList.remove('is-active'));
      pill.classList.add('is-active');
      onChange(pill.dataset.value);
    });
  }

  wirePillFilter(trackFilterEl, (value) => {
    state.track = value;
    renderGroups();
  });
  wirePillFilter(difficultyFilterEl, (value) => {
    state.difficulty = value;
    renderGroups();
  });

  renderGroups();
})();
```

- [ ] **Step 2: Verify with the Playwright browser tool**

1. `browser_navigate` to `file:///c:/Users/yj202/OneDrive/Desktop/바이브코딩/imba subject/index.html`
2. `browser_console_messages` — expect zero errors now that `app.js` exists
3. `browser_evaluate` with `() => document.querySelectorAll('.course-card').length` — expect `30`
4. `browser_evaluate` with `() => document.querySelectorAll('.group-section').length` — expect `6`
5. `browser_take_screenshot` — confirm cards render in a 3-column grid with badges, name, professor, and opinion preview

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: render course groups and cards from data.js"
```

---

## Task 5: Search and filter interaction verification

**Files:**
- Modify: none (Task 4 already wired the listeners) — this task is verification-only plus a fix pass if issues surface.

**Interfaces:**
- Consumes: rendered page from Task 4.
- Produces: confidence that `Logic.filterCourses` is correctly wired to the three toolbar controls before building selection/compare features on top.

- [ ] **Step 1: Verify search filtering**

Using the Playwright browser tool on the already-open page:
1. `browser_type` into `#search-input` the text `재무`
2. `browser_evaluate`: `() => document.querySelectorAll('.course-card').length` — expect the count to shrink to the courses whose name or professor contains "재무" (e.g. 재무의이해, 재무제표분석론, 재무회계론, 기업재무전략론, 핀테크와행동재무 → 5)
3. Clear the input (`browser_type` with empty string or select-all+delete) and confirm the count returns to `30`

- [ ] **Step 2: Verify track filter**

1. Click the "전공기반" pill inside `#track-filter`
2. `browser_evaluate`: confirm all visible `.course-card` elements' badge text includes "전공기반" and the total count is `6` (one 전공기반 course per group A–F)
3. Click "전체" to reset

- [ ] **Step 3: Verify difficulty filter**

1. Click the "상" pill inside `#difficulty-filter`
2. `browser_evaluate`: confirm the visible course count matches the courses with `difficulty === '상'` in `data.js` (경영자를위한데이터분석및통계적 사고, AI와경영정보, 소비자행동론, 기업재무전략론, 글로벌금융시장, 재무제표분석론 → 6)
3. Click "난이도 전체" to reset

- [ ] **Step 4: Verify filters combine (AND)**

1. Type `론` in the search box, click "전공심화", click "중"
2. `browser_evaluate` the resulting `.course-card` count and cross-check it against `data.js` by hand (courses whose name contains "론", track is 전공심화, difficulty is 중)

If any check fails, fix `Logic.filterCourses` (Task 2) or the pill-wiring in `app.js` (Task 4) before proceeding — do not carry a broken filter into Task 6.

- [ ] **Step 5: Commit (only if a fix was needed)**

```bash
git add -A
git commit -m "fix: correct search/filter interaction"
```

---

## Task 6: Checkbox selection, compare bar, and group-conflict warning (`app.js` part 2)

**Files:**
- Modify: `app.js`

**Interfaces:**
- Consumes: `Logic.findGroupConflicts` (Task 2), `state.selectedIds` (Task 4), DOM IDs from Task 3 (`#compare-bar`, `.compare-count`, `.compare-chips`, `.compare-warning`, `#compare-btn`, `#reset-btn`).
- Produces: `toggleSelection(id)` function and a live-updating compare bar — Task 7 (modal) and Task 8 (compare table) both call `toggleSelection` and read `state.selectedIds`.

- [ ] **Step 1: Add selection state, compare bar rendering, and event wiring**

First, insert a temporary stub right after the `courseById` function definition (this step references `openModal`, which is not implemented until Task 7 — the stub keeps the file runnable until then):

```js
  function openModal(course) {
    // implemented in Task 7
  }
```

Then, replace the final `renderGroups();` call at the bottom of the IIFE with the block below (so `renderGroups()` still runs once at startup, now followed by an initial `renderCompareBar()`):

```js
  const compareBar = document.getElementById('compare-bar');
  const compareCountEl = compareBar.querySelector('.compare-count');
  const compareChipsEl = compareBar.querySelector('.compare-chips');
  const compareWarningEl = compareBar.querySelector('.compare-warning');
  const resetBtn = document.getElementById('reset-btn');

  function renderCompareBar() {
    const selected = [...state.selectedIds].map(courseById).filter(Boolean);
    if (selected.length === 0) {
      compareBar.classList.add('hidden');
      compareCountEl.textContent = '0개 과목 선택됨';
      compareChipsEl.innerHTML = '';
      compareWarningEl.textContent = '';
      return;
    }
    compareBar.classList.remove('hidden');
    compareCountEl.textContent = `${selected.length}개 과목 선택됨`;
    compareChipsEl.innerHTML = selected
      .map((c) => `<button type="button" class="chip" data-id="${c.id}">${c.name} ×</button>`)
      .join('');
    const conflicts = Logic.findGroupConflicts(selected);
    compareWarningEl.textContent = conflicts
      .map((c) => `⚠ 그룹 ${c.group} 과목 ${c.names.length}개 동시 선택됨`)
      .join(' · ');
  }

  function toggleSelection(id) {
    if (state.selectedIds.has(id)) state.selectedIds.delete(id);
    else state.selectedIds.add(id);
    renderGroups();
    renderCompareBar();
  }

  courseListEl.addEventListener('change', (event) => {
    const checkbox = event.target.closest('.course-checkbox');
    if (checkbox) toggleSelection(checkbox.dataset.id);
  });

  courseListEl.addEventListener('click', (event) => {
    if (event.target.closest('.course-card-checkbox')) return;
    const card = event.target.closest('.course-card');
    if (card) openModal(courseById(card.dataset.id));
  });

  compareChipsEl.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (chip) toggleSelection(chip.dataset.id);
  });

  resetBtn.addEventListener('click', () => {
    state.selectedIds.clear();
    renderGroups();
    renderCompareBar();
  });

  renderGroups();
  renderCompareBar();
})();
```

- [ ] **Step 2: Verify with the Playwright browser tool**

1. Reload the page (`browser_navigate` to the same `file://` URL)
2. Check the checkbox on two different course cards that belong to different groups (e.g. any group A card and any group B card)
3. `browser_evaluate`: `() => document.getElementById('compare-bar').classList.contains('hidden')` — expect `false`
4. `browser_evaluate`: `() => document.querySelector('.compare-count').textContent` — expect `"2개 과목 선택됨"`
5. `browser_evaluate`: `() => document.querySelector('.compare-warning').textContent` — expect `""` (no conflict, different groups)
6. Check a second checkbox in the *same* group as one already checked (3 selected total, 2 sharing a group)
7. `browser_evaluate`: confirm `.compare-warning` textContent now contains `⚠ 그룹` and the correct group letter
8. Click a `.chip` in the compare bar and confirm both the chip count decreases and the corresponding card's checkbox becomes unchecked
9. Click `#reset-btn` and confirm `#compare-bar` regains the `hidden` class

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add checkbox selection with compare bar and group-conflict warning"
```

---

## Task 7: Course detail modal (`app.js` part 3)

**Files:**
- Modify: `app.js`

**Interfaces:**
- Consumes: DOM IDs from Task 3 (`#modal-overlay`, `#modal-close`, `#modal-body`), `state.selectedIds`/`toggleSelection` from Task 6.
- Produces: fully working `openModal(course)` (replacing the Task 6 stub) and `closeModal()`.

- [ ] **Step 1: Replace the stub `openModal` and wire close behavior**

Replace the stub from Task 6:

```js
  function openModal(course) {
    // implemented in Task 7
  }
```

with:

```js
  const modalOverlay = document.getElementById('modal-overlay');
  const modalBody = document.getElementById('modal-body');
  const modalClose = document.getElementById('modal-close');
  let openCourseId = null;

  function openModal(course) {
    openCourseId = course.id;
    const s = course.syllabus;
    const syllabusHtml = s
      ? `
        <dl class="modal-syllabus">
          <dt>강의방식</dt><dd>${s.method || '정보 없음'}</dd>
          <dt>수업목표/개요</dt><dd>${s.objective || '정보 없음'}</dd>
          <dt>평가방법</dt><dd>${s.evaluation || '정보 없음'}</dd>
          <dt>주차별 커리큘럼</dt><dd>${s.curriculum || '정보 없음'}</dd>
          <dt>교재/참고자료</dt><dd>${s.textbook || '정보 없음'}</dd>
          ${s.note ? `<dt>비고</dt><dd>${s.note}</dd>` : ''}
        </dl>`
      : `<p class="modal-no-syllabus">수업계획서 미제출 (교수님 미등록)</p>`;

    modalBody.innerHTML = `
      <div class="course-card-badges">
        <span class="badge group-badge group-${course.group}">그룹 ${course.group}</span>
        <span class="badge badge-track">${course.track}</span>
        <span class="badge ${DIFFICULTY_CLASS[course.difficulty]}">${course.difficulty}</span>
      </div>
      <h2>${course.name}</h2>
      <p class="modal-professor">${course.professor} 교수</p>
      <h3>학생 의견</h3>
      <p>${course.studentOpinion}</p>
      <h3>강의계획서 요약</h3>
      ${syllabusHtml}
      <label class="modal-compare-toggle">
        <input type="checkbox" class="course-checkbox" data-id="${course.id}" ${state.selectedIds.has(course.id) ? 'checked' : ''} />
        비교 목록에 추가
      </label>
    `;
    modalOverlay.classList.remove('hidden');
  }

  function closeModal() {
    openCourseId = null;
    modalOverlay.classList.add('hidden');
    modalBody.innerHTML = '';
  }

  modalBody.addEventListener('change', (event) => {
    const checkbox = event.target.closest('.course-checkbox');
    if (checkbox) toggleSelection(checkbox.dataset.id);
  });

  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (event) => {
    if (event.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modalOverlay.classList.contains('hidden')) closeModal();
  });
```

Also update `toggleSelection` (from Task 6) to refresh an open modal after a selection change — replace:

```js
  function toggleSelection(id) {
    if (state.selectedIds.has(id)) state.selectedIds.delete(id);
    else state.selectedIds.add(id);
    renderGroups();
    renderCompareBar();
  }
```

with:

```js
  function toggleSelection(id) {
    if (state.selectedIds.has(id)) state.selectedIds.delete(id);
    else state.selectedIds.add(id);
    renderGroups();
    renderCompareBar();
    if (openCourseId) openModal(courseById(openCourseId));
  }
```

- [ ] **Step 2: Verify with the Playwright browser tool**

1. Reload the page
2. Click a course card (not its checkbox) for a course that HAS a syllabus, e.g. 회계와기업경영 (group A)
3. `browser_snapshot` or `browser_evaluate` — confirm `#modal-overlay` no longer has class `hidden`, and the modal shows the course name, "강의방식", "수업목표/개요", "평가방법", "주차별 커리큘럼", "교재/참고자료" with real text
4. Press Escape (`browser_press_key` with `Escape`) — confirm the modal gets the `hidden` class again
5. Click a course card for a course WITHOUT a syllabus, e.g. 유통관리론 (group A) — confirm the modal shows "수업계획서 미제출 (교수님 미등록)" instead of empty fields
6. Inside the open modal, check the "비교 목록에 추가" checkbox — confirm `.compare-count` in the bottom bar increments and the modal checkbox stays checked after the re-render
7. Click the modal overlay background (outside the modal box) — confirm it closes

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add course detail modal with syllabus summary"
```

---

## Task 8: Compare table section (`app.js` part 4)

**Files:**
- Modify: `app.js`

**Interfaces:**
- Consumes: `Logic.buildCompareRows`, `Logic.findGroupConflicts` (Task 2), `#compare-section` (Task 3), `#compare-btn` (Task 3), `state.selectedIds` (Task 6).
- Produces: `renderCompareSection()` — final piece of the feature; no later task depends on this.

- [ ] **Step 1: Add compare table rendering and wire the "비교하기" button**

Add to `app.js` (after the `resetBtn` listener, before the closing `renderGroups(); renderCompareBar(); })();`):

```js
  const compareSection = document.getElementById('compare-section');
  const compareBtn = document.getElementById('compare-btn');

  function renderCompareSection() {
    const selected = [...state.selectedIds].map(courseById).filter(Boolean);
    if (selected.length === 0) {
      compareSection.classList.add('hidden');
      compareSection.innerHTML = '';
      return;
    }
    const conflicts = Logic.findGroupConflicts(selected);
    const conflictGroups = new Set(conflicts.map((c) => c.group));
    const rows = Logic.buildCompareRows(selected);

    const banner = conflicts.length
      ? `<div class="compare-conflict-banner">${conflicts
          .map((c) => `⚠ 그룹 ${c.group}: ${c.names.join(', ')} 은(는) 동시 수강이 불가합니다.`)
          .join('<br />')}</div>`
      : '';

    const headerCells = selected
      .map((c) => `<th class="${conflictGroups.has(c.group) ? 'compare-col-conflict' : ''}">${c.name}</th>`)
      .join('');

    const bodyRows = rows
      .map((row) => `<tr><th>${row.label}</th>${row.values.map((v) => `<td>${v}</td>`).join('')}</tr>`)
      .join('');

    compareSection.innerHTML = `
      <h2 class="compare-heading">과목 비교 (${selected.length}개)</h2>
      ${banner}
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead><tr><th>항목</th>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    `;
    compareSection.classList.remove('hidden');
  }

  compareBtn.addEventListener('click', () => {
    renderCompareSection();
    compareSection.scrollIntoView({ behavior: 'smooth' });
  });
```

Also update `toggleSelection` and `resetBtn`'s handler to keep an already-visible compare table in sync — replace `toggleSelection` once more:

```js
  function toggleSelection(id) {
    if (state.selectedIds.has(id)) state.selectedIds.delete(id);
    else state.selectedIds.add(id);
    renderGroups();
    renderCompareBar();
    if (openCourseId) openModal(courseById(openCourseId));
    if (!compareSection.classList.contains('hidden')) renderCompareSection();
  }
```

and the `resetBtn` listener:

```js
  resetBtn.addEventListener('click', () => {
    state.selectedIds.clear();
    renderGroups();
    renderCompareBar();
    compareSection.classList.add('hidden');
    compareSection.innerHTML = '';
  });
```

- [ ] **Step 2: Verify with the Playwright browser tool**

1. Reload the page
2. Select 3 courses: two from the same group (e.g. two group A courses) and one from a different group
3. Click `#compare-btn`
4. `browser_evaluate`: confirm `#compare-section` no longer has class `hidden` and its `<table>` has exactly 3 `<th>` header cells besides the "항목" column, and 11 body rows (그룹/구분/교수/난이도/학생 의견/강의방식/수업목표/평가방법/주차별커리큘럼/교재/비고)
5. `browser_evaluate`: confirm `.compare-conflict-banner` text mentions the correct group letter and both course names sharing it
6. Pick one selected course that has `syllabus: null` in `data.js` (e.g. 유통관리론) — confirm its column shows "수업계획서 미제출" in the 강의방식/수업목표/평가방법/주차별커리큘럼/교재/비고 rows
7. Click a `.chip` to deselect one course while the compare table is open — confirm the table re-renders with one fewer column
8. Click `#reset-btn` — confirm `#compare-section` regains the `hidden` class

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add side-by-side compare table with group-conflict banner"
```

---

## Task 9: Responsive check and final full smoke test

**Files:**
- Modify: `style.css` only if a responsive issue is found during verification.

**Interfaces:**
- Consumes: the complete app from Tasks 1–8.
- Produces: nothing new — this is the final release gate.

- [ ] **Step 1: Verify responsive layout at three widths**

Using the Playwright browser tool:
1. `browser_resize` to `1280x900` (desktop) → `browser_take_screenshot` → confirm `.course-grid` shows 3 columns
2. `browser_resize` to `820x1000` (tablet) → `browser_take_screenshot` → confirm `.course-grid` shows 2 columns (per the `900px` breakpoint in `style.css`)
3. `browser_resize` to `390x844` (mobile) → `browser_take_screenshot` → confirm `.course-grid` shows 1 column, and the compare bar stacks vertically (per the `600px` breakpoint)
4. At the mobile width, select 2+ courses and open the compare table — confirm `.compare-table-wrap` scrolls horizontally without breaking the page's own vertical scroll (`browser_evaluate`: `() => { const el = document.querySelector('.compare-table-wrap'); return el.scrollWidth > el.clientWidth; }` should be `true` once several columns are present)

If any breakpoint looks broken, fix the relevant rule in `style.css` and re-screenshot before moving on.

- [ ] **Step 2: Run the full automated suite one last time**

Run: `node --test`
Expected: every test in `tests/data.test.js` and `tests/logic.test.js` passes (14 tests total: 6 data + 8 logic).

- [ ] **Step 3: Full end-to-end smoke test**

Using the Playwright browser tool at desktop width:
1. Navigate fresh to `index.html`
2. Search "AI", confirm the card for AI와경영정보 (group C) is the only result, clear search
3. Filter difficulty "상", confirm 6 cards show, reset to "전체"
4. Select one course from each of groups A, B, and C (3 total, no conflicts) → open compare table → confirm no conflict banner and 3 columns of correct data
5. Additionally check a second group-A course (2 group-A courses now selected, 4 total) → confirm the conflict banner appears and names both group-A courses correctly
6. Open the modal for a no-syllabus course and confirm the "수업계획서 미제출 (교수님 미등록)" message
7. Reset selection, confirm both the bottom bar and compare section disappear

- [ ] **Step 4: Commit (only if Step 1 required a CSS fix)**

```bash
git add style.css
git commit -m "fix: responsive layout adjustments"
```
