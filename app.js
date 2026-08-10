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
