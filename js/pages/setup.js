// setup.js — first-run setup: creates the company and its first Admin.
// The form is hidden in the HTML and shown ONLY while no users exist. setupCompany() (auth.js)
// checks again before saving, so this page can never create a second admin later.

(function initSetupPage() {
  const form = qs('#setup-form');
  qsa('[data-icon]').forEach((slot) => (slot.innerHTML = icon(slot.dataset.icon)));

  try {
    if (hasAnyUsers()) {
      qs('#setup-title').textContent = 'Setup complete';
      qs('#setup-done').hidden = false;
      return;
    }
  } catch (error) {
    showFatalError(error);
    return;
  }

  qs('#setup-intro').hidden = false;
  form.hidden = false;
  form.elements.companyName.focus();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    const button = qs('button[type="submit"]', form);
    setBusy(button, true, 'Setting up…');
    try {
      const result = await setupCompany(formValues(form));
      if (!result.ok) {
        showFieldErrors(form, result.errors ?? {}, result.error ?? '');
        return;
      }
      setFlash('Company created. Next: add managers from the Users page.', 'success');
      location.href = homeFor(result.user.role);
    } catch (error) {
      showFieldErrors(form, {}, error.message);
    } finally {
      setBusy(button, false);
    }
  });
})();
