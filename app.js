(function () {
  const state = {
    query: '',
    track: 'all',
    field: 'all',
    selectedIds: new Set(),
  };

  const courseListEl = document.getElementById('course-list');
  const searchInput = document.getElementById('search-input');
  const trackFilterEl = document.getElementById('track-filter');
  const fieldFilterEl = document.getElementById('field-filter');
  const compareBar = document.getElementById('compare-bar');
  const compareCountEl = compareBar.querySelector('.compare-count');
  const compareChipsEl = compareBar.querySelector('.compare-chips');
  const compareWarningEl = compareBar.querySelector('.compare-warning');
  const resetBtn = document.getElementById('reset-btn');
  const compareSection = document.getElementById('compare-section');
  const compareBtn = document.getElementById('compare-btn');
  const scheduleBtn = document.getElementById('schedule-btn');
  const scheduleSection = document.getElementById('schedule-section');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalBody = document.getElementById('modal-body');
  const modalClose = document.getElementById('modal-close');

  let openCourseId = null;

  const GROUP_LABEL = { A: '그룹 A', B: '그룹 B', C: '그룹 C', D: '그룹 D', E: '그룹 E', F: '그룹 F' };
  const FIELD_CLASS = {
    'Marketing/Management': 'field-marketing',
    'Accounting/Finance': 'field-accounting',
    'Global/Innovation': 'field-global',
  };

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
          ${course.field ? `<span class="badge ${FIELD_CLASS[course.field]}">${course.field}</span>` : ''}
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
  wirePillFilter(fieldFilterEl, (value) => {
    state.field = value;
    renderGroups();
  });

  // --- Selection + compare bar ---

  function renderCompareBar() {
    const selected = [...state.selectedIds].map(courseById).filter(Boolean);
    scheduleBtn.classList.toggle('hidden', selected.length !== 3);
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
    if (openCourseId) openModal(courseById(openCourseId));
    if (!compareSection.classList.contains('hidden')) renderCompareSection();
    if (!scheduleSection.classList.contains('hidden')) renderScheduleSection();
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
    compareSection.classList.add('hidden');
    compareSection.innerHTML = '';
    scheduleSection.classList.add('hidden');
    scheduleSection.innerHTML = '';
  });

  // --- Detail modal ---

  function renderCurriculumTable(curriculum) {
    const rows = Logic.parseCurriculum(curriculum);
    if (rows.length === 0) return '<p>정보 없음</p>';
    return `
      <table class="curriculum-table">
        <thead><tr><th>주차</th><th>내용</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr><td>${r.week}</td><td>${r.content}</td></tr>`).join('')}
        </tbody>
      </table>`;
  }

  function renderCurriculumCell(course) {
    if (!course.syllabus) return '수업계획서 미제출';
    return renderCurriculumTable(course.syllabus.curriculum);
  }

  function openModal(course) {
    openCourseId = course.id;
    const s = course.syllabus;
    const syllabusHtml = s
      ? `
        <dl class="modal-syllabus">
          <dt>강의방식</dt><dd>${s.method || '정보 없음'}</dd>
          <dt>수업목표/개요</dt><dd>${s.objective || '정보 없음'}</dd>
          <dt>평가방법</dt><dd>${s.evaluation || '정보 없음'}</dd>
          <dt>주차별 커리큘럼</dt><dd>${renderCurriculumTable(s.curriculum)}</dd>
          <dt>교재/참고자료</dt><dd>${s.textbook || '정보 없음'}</dd>
          ${s.note ? `<dt>비고</dt><dd>${s.note}</dd>` : ''}
        </dl>`
      : `<p class="modal-no-syllabus">수업계획서 미제출 (교수님 미등록)</p>`;

    modalBody.innerHTML = `
      <div class="course-card-badges">
        <span class="badge group-badge group-${course.group}">그룹 ${course.group}</span>
        <span class="badge badge-track">${course.track}</span>
        ${course.field ? `<span class="badge ${FIELD_CLASS[course.field]}">${course.field}</span>` : ''}
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

  // --- Compare table ---

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
      .map((row) => {
        const cells =
          row.key === 'curriculum'
            ? selected.map((c) => `<td>${renderCurriculumCell(c)}</td>`).join('')
            : row.values.map((v) => `<td>${v}</td>`).join('');
        return `<tr><th>${row.label}</th>${cells}</tr>`;
      })
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

  // --- Schedule simulation (등교일정표) ---

  function exportScheduleToExcel(rows) {
    const header = ['날짜', '요일', '시간', '과목명'];
    const data = rows.map((r) => [r.date, r.dayOfWeek, `${r.startTime}~${r.endTime}`, r.courseName]);
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...data]);
    worksheet['!cols'] = [{ wch: 12 }, { wch: 6 }, { wch: 14 }, { wch: 28 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '등교일정표');
    XLSX.writeFile(workbook, '등교일정표.xlsx');
  }

  function renderScheduleSection() {
    const selected = [...state.selectedIds].map(courseById).filter(Boolean);
    if (selected.length !== 3) {
      scheduleSection.classList.add('hidden');
      scheduleSection.innerHTML = '';
      return;
    }
    const rows = Logic.buildScheduleRows(selected);

    const body = rows.length
      ? `
        <div class="schedule-table-wrap">
          <table class="schedule-table">
            <thead><tr><th>날짜</th><th>요일</th><th>시간</th><th>과목명</th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (r) =>
                    `<tr><td>${r.date}</td><td>${r.dayOfWeek}</td><td>${r.startTime}~${r.endTime}</td><td>${r.courseName}</td></tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
        <button type="button" class="btn btn-primary schedule-excel-btn">엑셀 다운로드</button>`
      : `<p class="schedule-empty">아직 등교일정 데이터가 준비되지 않았습니다. 데이터가 입력되면 이 화면에 자동으로 표시됩니다.</p>`;

    scheduleSection.innerHTML = `
      <h2 class="schedule-heading">등교일정표 — ${selected.map((c) => c.name).join(', ')}</h2>
      ${body}
    `;
    scheduleSection.classList.remove('hidden');
  }

  scheduleBtn.addEventListener('click', () => {
    renderScheduleSection();
    scheduleSection.scrollIntoView({ behavior: 'smooth' });
  });

  scheduleSection.addEventListener('click', (event) => {
    if (!event.target.closest('.schedule-excel-btn')) return;
    const selected = [...state.selectedIds].map(courseById).filter(Boolean);
    exportScheduleToExcel(Logic.buildScheduleRows(selected));
  });

  renderGroups();
  renderCompareBar();
})();
