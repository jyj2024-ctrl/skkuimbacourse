import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAX3oKHGLURHJdgK5LDyl6y-2oJqTNn5U8',
  authDomain: 'test-3aa91.firebaseapp.com',
  projectId: 'test-3aa91',
  storageBucket: 'test-3aa91.firebasestorage.app',
  messagingSenderId: '308762818540',
  appId: '1:308762818540:web:a40fb6f5909ddd71c7b2c9',
  measurementId: 'G-YWVWHCLXL6',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
