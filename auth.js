(function () {
  // Replace with your own OAuth Client ID from https://console.cloud.google.com/apis/credentials
  // (Google Cloud Console > APIs & Services > Credentials > Create OAuth client ID > Web application,
  // with this site's URL added under "Authorized JavaScript origins").
  const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

  const AUTH_STORAGE_KEY = 'skku-imba-google-user';
  const authArea = document.getElementById('auth-area');

  function loadUser() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function saveUser(user) {
    if (user) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  function decodeJwtPayload(token) {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  }

  function renderSignedIn(user) {
    authArea.innerHTML = `
      <div class="auth-profile">
        <img class="auth-avatar" src="${user.picture}" alt="${user.name}" referrerpolicy="no-referrer" />
        <span class="auth-name">${user.name}</span>
        <button type="button" id="auth-logout-btn" class="auth-logout-btn">로그아웃</button>
      </div>
    `;
    document.getElementById('auth-logout-btn').addEventListener('click', signOut);
  }

  function renderSignedOut() {
    authArea.innerHTML = '<div id="google-signin-button"></div>';
    if (window.google?.accounts?.id) {
      window.google.accounts.id.renderButton(document.getElementById('google-signin-button'), {
        theme: 'outline',
        size: 'medium',
        text: 'signin',
        shape: 'pill',
      });
    }
  }

  function handleCredentialResponse(response) {
    const payload = decodeJwtPayload(response.credential);
    const user = { name: payload.name, email: payload.email, picture: payload.picture };
    saveUser(user);
    renderSignedIn(user);
  }

  function signOut() {
    saveUser(null);
    window.google?.accounts?.id?.disableAutoSelect();
    renderSignedOut();
  }

  function init() {
    const existingUser = loadUser();
    if (existingUser) {
      renderSignedIn(existingUser);
      return;
    }
    if (!window.google?.accounts?.id) {
      setTimeout(init, 200);
      return;
    }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
    });
    renderSignedOut();
  }

  init();
})();
