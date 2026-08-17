import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAX3oKHGLURHJdgK5LDyl6y-2oJqTNn5U8',
  authDomain: 'test-3aa91.firebaseapp.com',
  projectId: 'test-3aa91',
  storageBucket: 'test-3aa91.firebasestorage.app',
  messagingSenderId: '308762818540',
  appId: '1:308762818540:web:a40fb6f5909ddd71c7b2c9',
  measurementId: 'G-YWVWHCLXL6',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
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
