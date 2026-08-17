import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { auth } from './firebase-init.js';

const provider = new GoogleAuthProvider();
const authArea = document.getElementById('auth-area');

function renderSignedIn(user) {
  const name = user.displayName || user.email || '사용자';
  authArea.innerHTML = `
    <div class="auth-profile">
      <img class="auth-avatar" src="${user.photoURL || ''}" alt="${name}" referrerpolicy="no-referrer" />
      <span class="auth-name">${name}</span>
      <button type="button" id="auth-logout-btn" class="auth-logout-btn">로그아웃</button>
    </div>
  `;
  document.getElementById('auth-logout-btn').addEventListener('click', () => {
    signOut(auth).catch((err) => console.error('로그아웃 실패:', err));
  });
}

function renderSignedOut() {
  authArea.innerHTML = '<button type="button" id="auth-google-btn" class="auth-google-btn">Google로 로그인</button>';
  document.getElementById('auth-google-btn').addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((err) => console.error('Google 로그인 실패:', err));
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) renderSignedIn(user);
  else renderSignedOut();
});
