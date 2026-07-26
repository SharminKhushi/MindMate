/* ==========================================================================
   MindMate — auth.js
   Signup + Login via api/auth.php, password toggle, strength meter, theme.
   ========================================================================== */

const SESSION_KEY = 'mindmate_session';
const THEME_KEY = 'mindmate_theme';
const API_BASE = '../api/';

/* ---------- Validation Helpers ---------- */
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function isValidName(name) { return name.trim().length >= 2; }
function isValidAge(age) { const n = Number(age); return Number.isInteger(n) && n >= 13 && n <= 19; }
function passwordStrength(password) {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return 'weak';
  if (score <= 2) return 'medium';
  return 'strong';
}

/* ---------- Field Error UI Helpers ---------- */
function setFieldError(fieldId, message) {
  const group = document.getElementById(fieldId).closest('.form-group');
  if (!group) return;
  group.classList.add('error');
  const errorEl = group.querySelector('.form-error span');
  if (errorEl) errorEl.textContent = message;
}
function clearFieldError(fieldId) {
  const group = document.getElementById(fieldId).closest('.form-group');
  if (group) group.classList.remove('error');
}
function showAlert(alertEl, message, type = 'error') {
  alertEl.textContent = '';
  const icon = document.createElement('i');
  icon.className = type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation';
  const span = document.createElement('span');
  span.textContent = message;
  alertEl.appendChild(icon);
  alertEl.appendChild(span);
  alertEl.classList.remove('success');
  if (type === 'success') alertEl.classList.add('success');
  alertEl.classList.add('show');
}
function hideAlert(alertEl) { alertEl.classList.remove('show'); }

/* ---------- Password Toggle ---------- */
function initPasswordToggles() {
  document.querySelectorAll('.toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.getAttribute('data-target'));
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    });
  });
}

/* ---------- Theme Toggle ---------- */
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;
  const root = document.documentElement;
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  if (savedTheme === 'dark') { root.setAttribute('data-theme', 'dark'); themeToggle.setAttribute('aria-pressed', 'true'); }
  themeToggle.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    if (isDark) { root.removeAttribute('data-theme'); localStorage.setItem(THEME_KEY, 'light'); themeToggle.setAttribute('aria-pressed', 'false'); }
    else { root.setAttribute('data-theme', 'dark'); localStorage.setItem(THEME_KEY, 'dark'); themeToggle.setAttribute('aria-pressed', 'true'); }
  });
}

function saveSessionFromAuthResponse(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    token: data.token,
    userId: data.user.id,
    name: data.user.name,
    email: data.user.email,
    loginAt: new Date().toISOString()
  }));
}

/* ==========================================================================
   SIGN UP FORM
   ========================================================================== */
function initSignupForm() {
  const form = document.getElementById('signupForm');
  if (!form) return;

  const alertEl = document.getElementById('signupAlert');
  const passwordInput = document.getElementById('signupPassword');
  const strengthBar = document.getElementById('passwordStrength');

  if (passwordInput && strengthBar) {
    passwordInput.addEventListener('input', () => {
      strengthBar.className = 'password-strength';
      if (passwordInput.value.length > 0) strengthBar.classList.add(passwordStrength(passwordInput.value));
    });
  }

  ['signupName', 'signupAge', 'signupEmail', 'signupPassword', 'signupConfirm'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => clearFieldError(id));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alertEl);

    const name = document.getElementById('signupName').value;
    const age = document.getElementById('signupAge').value;
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    const termsChecked = document.getElementById('signupTerms').checked;

    let valid = true;
    if (!isValidName(name)) { setFieldError('signupName', 'Please enter your name (at least 2 characters).'); valid = false; }
    if (!isValidAge(age)) { setFieldError('signupAge', 'MindMate is for ages 13–19.'); valid = false; }
    if (!isValidEmail(email)) { setFieldError('signupEmail', 'Please enter a valid email address.'); valid = false; }
    if (password.length < 6) { setFieldError('signupPassword', 'Password must be at least 6 characters.'); valid = false; }
    if (confirm !== password || confirm.length === 0) { setFieldError('signupConfirm', 'Passwords do not match.'); valid = false; }
    if (!termsChecked) { showAlert(alertEl, 'Please agree to the Privacy Terms to continue.'); valid = false; }
    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';

    try {
      const res = await fetch(API_BASE + 'auth.php?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), age: Number(age), email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        if ((data.error || '').toLowerCase().includes('email')) setFieldError('signupEmail', data.error);
        showAlert(alertEl, data.error || 'Something went wrong. Please try again.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Create Account';
        return;
      }

      saveSessionFromAuthResponse(data);
      showAlert(alertEl, 'Account created! Redirecting to your dashboard...', 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);
    } catch (err) {
      showAlert(alertEl, 'Could not connect to the server. Please make sure XAMPP is running.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Create Account';
    }
  });
}

/* ==========================================================================
   LOGIN FORM
   ========================================================================== */
function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const alertEl = document.getElementById('loginAlert');

  ['loginEmail', 'loginPassword'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => clearFieldError(id));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alertEl);

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    let valid = true;
    if (!isValidEmail(email)) { setFieldError('loginEmail', 'Please enter a valid email address.'); valid = false; }
    if (password.length === 0) { setFieldError('loginPassword', 'Please enter your password.'); valid = false; }
    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';

    try {
      const res = await fetch(API_BASE + 'auth.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        showAlert(alertEl, data.error || "We couldn't find an account with that email and password.");
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Log In';
        return;
      }

      saveSessionFromAuthResponse(data);
      showAlert(alertEl, 'Welcome back! Redirecting...', 'success');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
    } catch (err) {
      showAlert(alertEl, 'Could not connect to the server. Please make sure XAMPP is running.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Log In';
    }
  });
}

/* ---------- Redirect signed-in users away from auth pages ---------- */
function redirectIfLoggedIn() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (session && session.userId) window.location.href = 'dashboard.html';
  } catch {}
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initPasswordToggles();
  initSignupForm();
  initLoginForm();
  redirectIfLoggedIn();
});