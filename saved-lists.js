import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { auth, db } from './firebase-init.js';

const savedListsArea = document.getElementById('saved-lists-area');
const savedListsToggle = document.getElementById('saved-lists-toggle');
const savedListsPanel = document.getElementById('saved-lists-panel');
const saveListBtn = document.getElementById('save-list-btn');
const saveListModalOverlay = document.getElementById('save-list-modal-overlay');
const saveListModalClose = document.getElementById('save-list-modal-close');
const saveListModalHint = document.getElementById('save-list-modal-hint');
const saveListNameInput = document.getElementById('save-list-name-input');
const saveListUpdateBtn = document.getElementById('save-list-update-btn');
const saveListNewBtn = document.getElementById('save-list-new-btn');

let currentUid = null;
let unsubscribeLists = null;
let savedLists = []; // [{ id, name, courseIds }]
let activeListId = null;

function listsCollection(uid) {
  return collection(db, 'users', uid, 'savedLists');
}

function renderPanel() {
  if (savedLists.length === 0) {
    savedListsPanel.innerHTML = '<p class="saved-lists-empty">저장된 목록이 없습니다.</p>';
    return;
  }
  savedListsPanel.innerHTML = savedLists
    .map(
      (list) => `
        <div class="saved-list-row${list.id === activeListId ? ' is-active' : ''}">
          <div class="saved-list-info">
            <span class="saved-list-name">${list.name}</span>
            <span class="saved-list-count">${list.courseIds.length}개 과목</span>
          </div>
          <div class="saved-list-actions">
            <button type="button" class="saved-list-load-btn" data-id="${list.id}">불러오기</button>
            <button type="button" class="saved-list-delete-btn" data-id="${list.id}">삭제</button>
          </div>
        </div>`
    )
    .join('');
}

function closePanel() {
  savedListsPanel.classList.add('hidden');
}

savedListsToggle.addEventListener('click', () => {
  savedListsPanel.classList.toggle('hidden');
});

document.addEventListener('click', (event) => {
  if (savedListsPanel.classList.contains('hidden')) return;
  if (savedListsArea.contains(event.target)) return;
  closePanel();
});

savedListsPanel.addEventListener('click', async (event) => {
  const loadBtn = event.target.closest('.saved-list-load-btn');
  if (loadBtn) {
    const list = savedLists.find((l) => l.id === loadBtn.dataset.id);
    if (list) {
      window.CourseApp.setSelectedIds(list.courseIds);
      activeListId = list.id;
      renderPanel();
      closePanel();
    }
    return;
  }
  const deleteBtn = event.target.closest('.saved-list-delete-btn');
  if (deleteBtn) {
    const list = savedLists.find((l) => l.id === deleteBtn.dataset.id);
    if (list && confirm(`"${list.name}" 목록을 삭제할까요?`)) {
      await deleteDoc(doc(db, 'users', currentUid, 'savedLists', list.id));
      if (activeListId === list.id) activeListId = null;
    }
  }
});

function openSaveModal() {
  const selectedIds = window.CourseApp.getSelectedIds();
  if (selectedIds.length === 0) {
    alert('저장할 과목을 먼저 선택해주세요.');
    return;
  }
  if (!currentUid) {
    alert('로그인 후 이용할 수 있습니다.');
    return;
  }
  const activeList = savedLists.find((l) => l.id === activeListId);
  saveListNameInput.value = activeList ? activeList.name : '';
  saveListModalHint.textContent = activeList
    ? `현재 "${activeList.name}" 목록을 불러온 상태입니다. 업데이트하거나 새 목록으로 저장하세요.`
    : `현재 선택된 ${selectedIds.length}개 과목을 저장합니다.`;
  saveListUpdateBtn.classList.toggle('hidden', !activeList);
  saveListModalOverlay.classList.remove('hidden');
  saveListNameInput.focus();
}

function closeSaveModal() {
  saveListModalOverlay.classList.add('hidden');
}

saveListBtn.addEventListener('click', openSaveModal);
saveListModalClose.addEventListener('click', closeSaveModal);
saveListModalOverlay.addEventListener('click', (event) => {
  if (event.target === saveListModalOverlay) closeSaveModal();
});

async function createList(name, courseIds) {
  const ref = await addDoc(listsCollection(currentUid), {
    name,
    courseIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  activeListId = ref.id;
}

async function updateList(listId, name, courseIds) {
  await updateDoc(doc(db, 'users', currentUid, 'savedLists', listId), {
    name,
    courseIds,
    updatedAt: serverTimestamp(),
  });
  activeListId = listId;
}

saveListNewBtn.addEventListener('click', async () => {
  const name = saveListNameInput.value.trim();
  if (!name) {
    alert('목록 이름을 입력해주세요.');
    return;
  }
  const courseIds = window.CourseApp.getSelectedIds();
  try {
    await createList(name, courseIds);
    closeSaveModal();
  } catch (err) {
    console.error('목록 저장 실패:', err);
    alert('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }
});

saveListUpdateBtn.addEventListener('click', async () => {
  const name = saveListNameInput.value.trim();
  if (!name) {
    alert('목록 이름을 입력해주세요.');
    return;
  }
  const courseIds = window.CourseApp.getSelectedIds();
  try {
    await updateList(activeListId, name, courseIds);
    closeSaveModal();
  } catch (err) {
    console.error('목록 업데이트 실패:', err);
    alert('업데이트에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }
});

function subscribeToLists(uid) {
  const listsQuery = query(listsCollection(uid), orderBy('updatedAt', 'desc'));
  unsubscribeLists = onSnapshot(listsQuery, (snapshot) => {
    savedLists = snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }));
    renderPanel();
  });
}

onAuthStateChanged(auth, (user) => {
  if (unsubscribeLists) {
    unsubscribeLists();
    unsubscribeLists = null;
  }
  activeListId = null;
  if (user) {
    currentUid = user.uid;
    savedListsArea.classList.remove('hidden');
    subscribeToLists(user.uid);
  } else {
    currentUid = null;
    savedLists = [];
    savedListsArea.classList.add('hidden');
    closePanel();
    closeSaveModal();
  }
});
