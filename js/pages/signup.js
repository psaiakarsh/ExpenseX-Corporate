// signup.js — public signup. There is deliberately NO role field: signupEmployee() (auth.js) always
// creates role "user" with managerId null. The new employee then logs in normally.

(function initSignupPage() {
  try {
    if (redirectIfLoggedIn()) return;
  } catch (error) {
    showFatalError(error);
    return;
  }

  const form = qs('#signup-form');
  qsa('[data-icon]').forEach((slot) => (slot.innerHTML = icon(slot.dataset.icon)));

  const db = loadDb();
  const closedReason = db.users.length === 0
    ? 'This company has not been set up yet. Go back to the login page to load the demo company or set up your own.'
    : !db.settings.allowSignup ? 'Public signup is currently disabled by the administrator. Ask them to create your account.' : '';
  if (closedReason) {
    qs('#signup-closed-text').textContent = closedReason;
    qs('#signup-closed').hidden = false;
    qs('#signup-info').hidden = true;
    form.hidden = true;
    return;
  }
  qs('#company-name').textContent = db.settings.companyName;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    const button = qs('button[type="submit"]', form);
    setBusy(button, true, 'Creating account…');
    try {
      const result = await signupEmployee(formValues(form), { login: false });
      if (!result.ok) {
        showFieldErrors(form, result.errors ?? {}, result.error ?? '');
        return;
      }
      form.reset();
      form.hidden = true;
      qs('#signup-info').hidden = true;
      qs('#signup-success-title').textContent = `Account created for ${result.user.email}`;
      qs('#signup-success').hidden = false;
      qs('#go-login').focus();
      setFlash('Employee account created. Log in to save drafts; an administrator will assign your manager.', 'success');
      setTimeout(() => location.assign('login.html'), 5000);
    } catch (error) {
      showFieldErrors(form, {}, error.message);
    } finally {
      setBusy(button, false);
    }
  });
})();
