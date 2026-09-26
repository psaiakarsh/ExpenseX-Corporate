// validate.js — small reusable field checks. Each returns an error message, or '' when valid.

const NAME_MIN = 2;
const NAME_MAX = 50;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function checkName(value, label = 'Name') {
  const name = String(value ?? '').trim();
  if (!name) return `${label} is required.`;
  if (name.length < NAME_MIN || name.length > NAME_MAX) return `${label} must be ${NAME_MIN}–${NAME_MAX} characters.`;
  return '';
}

function checkEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return 'Email is required.';
  if (email.length > 100 || !EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';
  return '';
}

function checkPassword(value) {
  const password = String(value ?? '');
  if (!password) return 'Password is required.';
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return `Password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters.`;
  }
  return '';
}

// Optional free text with a maximum length.
function checkText(value, max, label) {
  return String(value ?? '').trim().length > max ? `${label} must be at most ${max} characters.` : '';
}

// Keeps only the entries that have a message: { name: '', email: 'Bad' } → { email: 'Bad' }.
function collectErrors(checks) {
  return Object.fromEntries(Object.entries(checks).filter(([, message]) => message));
}

function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}
