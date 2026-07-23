/* ==========================================================================
   MindMate — auth.js
   Handles: signup validation + storage, login validation + session,
   password visibility toggle, password strength meter, theme toggle
   (shared logic, duplicated lightly here until app.js exists on Day 2).
   Storage keys:
     mindmate_users   -> array of {id, name, age, email, password, createdAt}
     mindmate_session -> {userId, name, email, loginAt}
   ========================================================================== */

const USERS_KEY = 'mindmate_users';
const SESSION_KEY = 'mindmate_session';
const THEME_KEY = 'mindmate_theme';

/* ---------- Storage Helpers ---------- */
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function setSession(user) {
  const session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    loginAt: new Date().toISOString()
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

/* ---------- Validation Helpers ---------- */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidName(name) {
  return name.trim().length >= 2;
}

function isValidAge(age) {
  const n = Number(age);
  return Number.isInteger(n) && n >= 13 && n <= 19;
}

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
  group.classList.remove('success');
  const errorEl = group.querySelector('.form-error span');
  if (errorEl) errorEl.textContent = message;
}

function clearFieldError(fieldId) {
  const group = document.getElementById(fieldId).closest('.form-group');
  if (!group) return;
  group.classList.remove('error');
}

function setFieldSuccess(fieldId) {
  const group = document.getElementById(fieldId).closest('.form-group');
  if (!group) return;
  group.classList.remove('error');
  group.classList.add('success');
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

function hideAlert(alertEl) {
  alertEl.classList.remove('show');
}

/* ---------- Password Toggle (shared by both forms) ---------- */
function initPasswordToggles() {
  document.querySelectorAll('.toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.innerHTML = isPassword
        ? '<i class="fa-solid fa-eye-slash"></i>'
        : '<i class="fa-solid fa-eye"></i>';
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  });
}

/* ---------- Theme Toggle (kept in sync with index.html for now) ---------- */
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;
  const root = document.documentElement;
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  if (savedTheme === 'dark') {
    root.setAttribute('data-theme', 'dark');
    themeToggle.setAttribute('aria-pressed', 'true');
  }
  themeToggle.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    if (isDark) {
      root.removeAttribute('data-theme');
      localStorage.setItem(THEME_KEY, 'light');
      themeToggle.setAttribute('aria-pressed', 'false');
    } else {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem(THEME_KEY, 'dark');
      themeToggle.setAttribute('aria-pressed', 'true');
    }
  });
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

  // Live password strength meter
  if (passwordInput && strengthBar) {
    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      strengthBar.className = 'password-strength';
      if (val.length > 0) {
        strengthBar.classList.add(passwordStrength(val));
      }
    });
  }

  // Clear individual field errors as the user types
  ['signupName', 'signupAge', 'signupEmail', 'signupPassword', 'signupConfirm'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => clearFieldError(id));
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    hideAlert(alertEl);

    const name = document.getElementById('signupName').value;
    const age = document.getElementById('signupAge').value;
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;
    const termsChecked = document.getElementById('signupTerms').checked;

    let valid = true;

    if (!isValidName(name)) {
      setFieldError('signupName', 'Please enter your name (at least 2 characters).');
      valid = false;
    } else {
      setFieldSuccess('signupName');
    }

    if (!isValidAge(age)) {
      setFieldError('signupAge', 'MindMate is for ages 13–19.');
      valid = false;
    } else {
      setFieldSuccess('signupAge');
    }

    if (!isValidEmail(email)) {
      setFieldError('signupEmail', 'Please enter a valid email address.');
      valid = false;
    } else {
      setFieldSuccess('signupEmail');
    }

    if (password.length < 6) {
      setFieldError('signupPassword', 'Password must be at least 6 characters.');
      valid = false;
    } else {
      setFieldSuccess('signupPassword');
    }

    if (confirm !== password || confirm.length === 0) {
      setFieldError('signupConfirm', 'Passwords do not match.');
      valid = false;
    } else {
      setFieldSuccess('signupConfirm');
    }

    if (!termsChecked) {
      showAlert(alertEl, 'Please agree to the Privacy Terms to continue.');
      valid = false;
    }

    if (!valid) return;

    const users = getUsers();
    const existing = users.find((u) => u.email === email);
    if (existing) {
      setFieldError('signupEmail', 'An account with this email already exists.');
      showAlert(alertEl, 'That email is already registered — try logging in instead.');
      return;
    }

    const newUser = {
      id: 'u_' + Date.now(),
      name: name.trim(),
      age: Number(age),
      email,
      password, // Note: stored in plain text for this academic/local-only demo.
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);
    setSession(newUser);

    showAlert(alertEl, 'Account created! Redirecting to your dashboard...', 'success');
    form.querySelector('button[type="submit"]').disabled = true;

    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 900);
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

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    hideAlert(alertEl);

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    let valid = true;

    if (!isValidEmail(email)) {
      setFieldError('loginEmail', 'Please enter a valid email address.');
      valid = false;
    }

    if (password.length === 0) {
      setFieldError('loginPassword', 'Please enter your password.');
      valid = false;
    }

    if (!valid) return;

    const users = getUsers();
    const match = users.find((u) => u.email === email && u.password === password);

    if (!match) {
      showAlert(alertEl, "We couldn't find an account with that email and password.");
      return;
    }

    setSession(match);
    showAlert(alertEl, 'Welcome back! Redirecting...', 'success');
    form.querySelector('button[type="submit"]').disabled = true;

    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 700);
  });
}

/* ---------- Redirect signed-in users away from auth pages ---------- */
function redirectIfLoggedIn() {
  return;
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initPasswordToggles();
  initSignupForm();
  initLoginForm();
  redirectIfLoggedIn();
});