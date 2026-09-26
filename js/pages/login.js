// login.js — login form, demo account shortcuts, and "Load Demo Company" (only while no data exists).

(function initLoginPage() {
  try {
    if (redirectIfLoggedIn()) return;
  } catch (error) {
    showFatalError(error);
    return;
  }
  showFlash();

  const form = qs('#login-form');

  function renderPanels() {
    const db = loadDb();
    const empty = db.users.length === 0;
    qs('#auth-layout').classList.toggle('has-aside', empty || db.settings.demoLoaded);
    qs('#empty-panel').hidden = !empty;
    qs('#demo-panel').hidden = empty || !db.settings.demoLoaded;
    qs('#signup-link').hidden = empty || !db.settings.allowSignup;
    if (!empty) qs('#company-name').textContent = db.settings.companyName;

    // List only demo accounts that really exist in this browser. Data from an older demo version can have
    // different emails; it is never migrated silently — the admin reloads the demo from Settings (REPLACE).
    const activeEmails = new Set(db.users.filter((u) => u.status === 'active').map((u) => u.email));
    const available = DEMO_LOGINS.filter((account) => activeEmails.has(account.email));
    const admin = db.users.find((u) => u.role === ROLES.ADMIN);
    qs('#demo-password').textContent = DEMO_PASSWORD;
    qs('#demo-stale').hidden = available.length === DEMO_LOGINS.length;
    qs('#demo-stale').innerHTML = `${icon('alert')}<div><strong>This browser holds demo data from an older version.</strong>
      Some demo accounts are not in it. Log in as this browser's admin (<code>${escapeHtml(admin?.email ?? '')}</code>,
      password <code>${escapeHtml(DEMO_PASSWORD)}</code> unless it was changed), open Settings → Load Demo Company and
      type REPLACE to recreate the demo.</div>`;

    qs('#demo-accounts').innerHTML = available.map((account) => `
      <li class="demo-account">
        ${avatar(account.name, 'sm')}
        <div class="grow">
          <div class="small"><strong>${escapeHtml(account.name)}</strong> · ${escapeHtml(account.role)}</div>
          <div class="muted xsmall">${escapeHtml(account.note)}</div>
          <code>${escapeHtml(account.email)}</code>
        </div>
        <button class="btn btn-secondary btn-sm" type="button" data-email="${escapeHtml(account.email)}"
          aria-label="Use ${escapeHtml(account.name)} (${escapeHtml(account.role)})">Use</button>
      </li>`).join('');
  }

  qs('#demo-accounts').addEventListener('click', (event) => {
    const button = event.target.closest('[data-email]');
    if (!button) return;
    form.elements.email.value = button.dataset.email;
    form.elements.password.value = DEMO_PASSWORD;
    clearFieldErrors(form);
    qs('button[type="submit"]', form).focus();
  });

  qs('#load-demo').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, 'Loading demo company…');
    const result = await loadDemoCompany();
    setBusy(button, false);
    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }
    toast('Demo company loaded. Pick an account to log in.');
    renderPanels();
    qs('#demo-accounts button')?.focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    const values = formValues(form);
    const errors = collectErrors({
      email: values.email.trim() ? '' : 'Enter your email.',
      password: values.password ? '' : 'Enter your password.',
    });
    if (hasErrors(errors)) {
      showFieldErrors(form, errors);
      return;
    }
    const button = qs('button[type="submit"]', form);
    setBusy(button, true, 'Logging in…');
    try {
      const result = await login(values);
      if (!result.ok) {
        showFieldErrors(form, {}, result.error);
        form.elements.password.value = '';
        return;
      }
      location.href = homeFor(result.user.role);
    } catch (error) {
      showFieldErrors(form, {}, error.message);
    } finally {
      setBusy(button, false);
    }
  });

  try {
    renderPanels();
  } catch (error) {
    showFatalError(error);
  }
})();
