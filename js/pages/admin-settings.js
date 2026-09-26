// admin-settings.js — company settings (updateSettings) and demo data (loadDemoCompany).
// Both domain functions check can(admin, …) themselves. Demo actions need a typed confirmation
// (REPLACE / RESET), touch only "exc:" keys (storage.js), and log everyone out afterwards.

const APPROX_STORAGE_LIMIT = 5 * 1024 * 1024; // most browsers allow about 5 MB per site
let settingsAdmin;

function renderSettings(user, db) {
  settingsAdmin = user;
  const form = qs('#settings-form');
  // Don't overwrite what the admin is typing if another tab triggers a redraw.
  if (!form.contains(document.activeElement)) {
    form.elements.companyName.value = db.settings.companyName;
    form.elements.limitWarningPercent.value = db.settings.limitWarningPercent;
    form.elements.allowSignup.checked = db.settings.allowSignup;
  }

  const used = storageUsageBytes();
  const percent = Math.min(100, Math.round((used * 100) / APPROX_STORAGE_LIMIT));
  qs('#storage').innerHTML = `<div class="meter ${percent >= 90 ? 'meter-exceeded' : percent >= 70 ? 'meter-warning' : ''}">
      <div class="meter-values"><span>ExpenseX Corporate data</span><span class="num"><strong>${formatBytes(used)}</strong> of ~${formatBytes(APPROX_STORAGE_LIMIT)}</span></div>
      <div class="meter-track" role="progressbar" aria-label="Browser storage used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><div class="meter-fill" style="width:${percent}%"></div></div>
    </div>
    <p class="muted xsmall" style="margin-top:12px">Receipt images use most of the space. If storage fills up, saving shows an error and nothing is half-saved.</p>`;

  qs('#demo-status').innerHTML = db.settings.demoLoaded
    ? '<span class="badge badge-approved">Demo loaded</span>'
    : '<span class="badge badge-muted">Custom company</span>';
  qs('#reset-demo').disabled = !db.settings.demoLoaded;
  qs('#demo-note').textContent = db.settings.demoLoaded
    ? 'Reset Demo Data recreates the demo company from scratch, undoing every change made during a demonstration.'
    : 'Reset is available once the demo company is loaded. Load Demo Company replaces this company with the demo.';
}

const redrawSettings = startPage({ roles: [ROLES.ADMIN], nav: 'settings', title: 'Settings' }, renderSettings);
qsa('[data-icon]').forEach((slot) => (slot.innerHTML = icon(slot.dataset.icon)));

qs('#settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  clearFieldErrors(form);
  const values = { ...formValues(form), allowSignup: form.elements.allowSignup.checked };
  let result;
  try {
    result = updateSettings(settingsAdmin, values);
  } catch (error) {
    result = { ok: false, error: error.message };
  }
  if (!result.ok) {
    showFieldErrors(form, result.errors ?? {}, result.error ?? '');
    return;
  }
  toast('Settings saved.');
  document.activeElement?.blur();
  redrawSettings?.();
});

async function runDemo(mode) {
  const word = mode === 'reset' ? 'RESET' : 'REPLACE';
  const confirmed = await confirmTyped({
    title: mode === 'reset' ? 'Reset demo data?' : 'Load the demo company?',
    message: mode === 'reset'
      ? 'Every ExpenseX Corporate record in this browser is deleted and the demo company is recreated from scratch. Everyone is logged out.'
      : 'Every ExpenseX Corporate record in this browser — including accounts you created — is replaced by the demo company. Everyone is logged out.',
    word,
    confirmLabel: mode === 'reset' ? 'Reset demo data' : 'Replace with demo',
  });
  if (!confirmed) return;

  const buttons = [qs('#load-demo'), qs('#reset-demo')];
  buttons.forEach((button) => (button.disabled = true));
  const busyButton = qs(mode === 'reset' ? '#reset-demo' : '#load-demo');
  setBusy(busyButton, true, mode === 'reset' ? 'Resetting…' : 'Loading…');
  const result = await loadDemoCompany(settingsAdmin, mode);
  if (!result.ok) {
    setBusy(busyButton, false);
    redrawSettings?.();
    toast(result.error ?? 'The demo could not be loaded. Your data was restored.', 'error');
    return;
  }
  setFlash(mode === 'reset' ? 'Demo data reset. Log in with a demo account.' : 'Demo company loaded. Log in with a demo account.', 'success');
  location.href = appUrl('login.html');
}

qs('#load-demo').addEventListener('click', () => runDemo('load'));
qs('#reset-demo').addEventListener('click', () => runDemo('reset'));
