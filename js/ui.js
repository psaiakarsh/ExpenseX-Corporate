// ui.js — small DOM helpers shared by every page: escaping, icons, toasts, dialogs, form errors, badges.

// Pages inside employee/, manager/, admin/ and shared/ set <body data-root="../">.
function appUrl(path) {
  return (document.body.dataset.root || '') + path;
}

function homeFor(role) {
  return { admin: 'admin/dashboard.html', manager: 'manager/dashboard.html', user: 'employee/dashboard.html' }[role];
}

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function queryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

// Every piece of user-entered text goes through this before being placed in HTML (prevents XSS:
// an employee's name or note is shown on the manager's screens).
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function debounce(fn, wait = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

// ---------- Icons (inline SVG, 24×24 stroke icons) ----------

const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/>',
  banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  edit3: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
};

// Decorative by default (aria-hidden). Buttons that only contain an icon must have an aria-label.
function icon(name, size = 20) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name] ?? ''}</svg>`;
}

// ---------- Badges and small pieces ----------

const STATUS_ICONS = {
  draft: 'edit',
  pending: 'clock',
  approved: 'check',
  reimbursement_pending: 'banknote',
  reimbursed: 'check',
  rejected: 'x',
};

// Colour is never the only signal: every badge has an icon and a text label.
function statusBadge(status) {
  return `<span class="badge badge-${status}">${icon(STATUS_ICONS[status], 14)}${escapeHtml(STATUS_LABELS[status] ?? status)}</span>`;
}

function selfApprovedBadge() {
  return `<span class="badge badge-self" title="Created and approved by the manager for their own expense">${icon('shield', 14)}Self-approved</span>`;
}

function roleBadge(role) {
  return `<span class="badge badge-role-${role}">${escapeHtml(ROLE_LABELS[role])}</span>`;
}

function initials(name) {
  return String(name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function avatar(name, size = '') {
  return `<span class="avatar ${size}" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}

function emptyState(message, iconName = 'inbox') {
  return `<div class="empty-state">${icon(iconName, 28)}<p>${escapeHtml(message)}</p></div>`;
}

// ---------- Toasts and one-time "flash" messages ----------

function toast(message, type = 'success') {
  let region = qs('.toast-region');
  // Screen readers only announce changes to a live region they already know about, so a region
  // created just now gets its first message a moment later.
  const isNewRegion = !region;
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  const item = document.createElement('div');
  item.className = `toast toast-${type}`;
  item.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check', 18)}<span></span>`;
  item.querySelector('span').textContent = message;
  setTimeout(() => {
    region.append(item);
    setTimeout(() => {
      item.classList.add('toast-leaving');
      setTimeout(() => item.remove(), 250);
    }, type === 'error' ? 6000 : 3500);
  }, isNewRegion ? 150 : 0);
}

// A message shown on the NEXT page (e.g. "Access denied" after a redirect). sessionStorage, not localStorage.
function setFlash(message, type = 'info') {
  sessionStorage.setItem('exc-flash', JSON.stringify({ message, type }));
}

function showFlash() {
  const raw = sessionStorage.getItem('exc-flash');
  if (!raw) return;
  sessionStorage.removeItem('exc-flash');
  try {
    const { message, type } = JSON.parse(raw);
    toast(message, type);
  } catch {
    // An unreadable flash message is simply dropped.
  }
}

// ---------- Forms ----------

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

// errors: { fieldName: message }. Marks fields invalid, links messages with aria-describedby
// (set in the HTML), and focuses the first invalid field.
function showFieldErrors(form, errors, formError = '') {
  clearFieldErrors(form);
  let first = null;
  Object.entries(errors).forEach(([name, message]) => {
    const input = form.elements[name];
    const slot = qs(`[data-error-for="${name}"]`, form);
    if (slot) {
      slot.textContent = message;
      slot.hidden = false;
    }
    if (input && input.setAttribute) {
      input.setAttribute('aria-invalid', 'true');
      first ??= input;
    }
  });
  const formSlot = qs('[data-form-error]', form);
  const summary = formError || (!first && Object.values(errors)[0]) || '';
  if (formSlot && summary) {
    formSlot.textContent = summary;
    formSlot.hidden = false;
  }
  // Focus the first invalid field in PAGE order (not the order the errors were produced).
  (qs('[aria-invalid="true"]', form) ?? first)?.focus();
}

function clearFieldErrors(form) {
  qsa('[data-error-for], [data-form-error]', form).forEach((slot) => {
    slot.textContent = '';
    slot.hidden = true;
  });
  qsa('[aria-invalid]', form).forEach((input) => input.removeAttribute('aria-invalid'));
}

function setBusy(button, busy, busyLabel = 'Working…') {
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.textContent = busyLabel;
  } else if (button.dataset.label) {
    button.innerHTML = button.dataset.label;
  }
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

// ---------- Dialogs (native <dialog>: the browser handles focus trapping, Esc and the backdrop) ----------

// fields: [{ name, label, type: 'text'|'email'|'password'|'textarea'|'select', value, options, required,
//            maxLength, hint, autocomplete, inputmode, placeholder }]
// onSubmit(values) → { ok: true } closes the dialog; { ok: false, errors, error } keeps it open.
// Resolves with the onSubmit result, or null when cancelled.
function openFormDialog({ title, description = '', fields = [], submitLabel = 'Save', danger = false, onSubmit }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    const titleId = createId('dlg');
    dialog.setAttribute('aria-labelledby', titleId);

    const fieldHtml = fields.map((field) => {
      const id = `${titleId}-${field.name}`;
      const common = `id="${id}" name="${field.name}" aria-describedby="${id}-error${field.hint ? ` ${id}-hint` : ''}"
        ${field.required ? 'required' : ''} ${field.maxLength ? `maxlength="${field.maxLength}"` : ''}
        ${field.autocomplete ? `autocomplete="${field.autocomplete}"` : ''} ${field.inputmode ? `inputmode="${field.inputmode}"` : ''}
        ${field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : ''}`;
      let control;
      if (field.type === 'textarea') {
        control = `<textarea ${common} rows="3">${escapeHtml(field.value ?? '')}</textarea>`;
      } else if (field.type === 'select') {
        const options = field.options
          .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === field.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
          .join('');
        control = `<select ${common}>${options}</select>`;
      } else {
        control = `<input type="${field.type ?? 'text'}" ${common} value="${escapeHtml(field.value ?? '')}">`;
      }
      return `<div class="field">
          <label for="${id}">${escapeHtml(field.label)}${field.required ? '' : ' <span class="optional">(optional)</span>'}</label>
          ${control}
          ${field.hint ? `<p class="field-hint" id="${id}-hint">${escapeHtml(field.hint)}</p>` : ''}
          <p class="field-error" id="${id}-error" data-error-for="${field.name}" hidden></p>
        </div>`;
    }).join('');

    dialog.innerHTML = `
      <form method="dialog" class="dialog-form" novalidate>
        <header class="dialog-header">
          <h2 id="${titleId}">${escapeHtml(title)}</h2>
          <button type="button" class="icon-btn" data-cancel aria-label="Close">${icon('x')}</button>
        </header>
        ${description ? `<div class="dialog-description">${description}</div>` : ''}
        ${fieldHtml}
        <p class="form-error" role="alert" data-form-error hidden></p>
        <footer class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-cancel>Cancel</button>
          <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${escapeHtml(submitLabel)}</button>
        </footer>
      </form>`;
    document.body.append(dialog);

    const form = qs('form', dialog);
    const submitButton = qs('button[type="submit"]', dialog);
    let result = null;

    const opener = document.activeElement; // focus goes back here when the dialog closes
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      dialog.close();
      dialog.remove();
      if (opener?.isConnected) opener.focus();
      resolve(result);
    };
    qsa('[data-cancel]', dialog).forEach((button) => button.addEventListener('click', finish));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish();
    });
    // Some browsers don't fire "cancel" for every Escape press, so Escape is also handled directly.
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearFieldErrors(form);
      setBusy(submitButton, true);
      try {
        const outcome = await onSubmit(formValues(form));
        if (outcome?.ok) {
          result = outcome;
          finish();
          return;
        }
        showFieldErrors(form, outcome?.errors ?? {}, outcome?.error ?? '');
      } catch (error) {
        showFieldErrors(form, {}, error.message);
      } finally {
        if (dialog.isConnected) setBusy(submitButton, false);
      }
    });

    dialog.showModal();
    (qs('input, select, textarea', form) ?? submitButton).focus();
  });
}

// Yes/no confirmation. Resolves true or false.
async function confirmAction({ title, message, confirmLabel = 'Confirm', danger = false }) {
  const result = await openFormDialog({
    title,
    description: `<p>${escapeHtml(message)}</p>`,
    submitLabel: confirmLabel,
    danger,
    onSubmit: () => ({ ok: true }),
  });
  return Boolean(result);
}

// Destructive actions ask the user to type a word (e.g. RESET) so they can't happen by accident.
async function confirmTyped({ title, message, word, confirmLabel }) {
  const result = await openFormDialog({
    title,
    description: `<p>${escapeHtml(message)}</p>`,
    fields: [{ name: 'typed', label: `Type ${word} to confirm`, required: true, autocomplete: 'off' }],
    submitLabel: confirmLabel,
    danger: true,
    onSubmit: ({ typed }) => (typed.trim() === word ? { ok: true } : { ok: false, errors: { typed: `Type ${word} exactly.` } }),
  });
  return Boolean(result);
}

// Runs an action and shows its error (if any) as a toast. Returns the action's result.
function runAction(action, successMessage) {
  try {
    const result = action();
    if (result?.ok === false) toast(result.error ?? Object.values(result.errors ?? {})[0] ?? 'Something went wrong.', 'error');
    else if (successMessage) toast(successMessage);
    return result;
  } catch (error) {
    toast(error.message, 'error');
    return { ok: false, error: error.message };
  }
}

// Shown when saved data cannot be read (corrupted JSON). Never overwrites anything silently.
function showFatalError(error) {
  document.body.innerHTML = `
    <main class="auth-page">
      <section class="card fatal-card" role="alert">
        <h1>${icon('alert', 24)} ExpenseX Corporate can't start</h1>
        <p></p>
        <p class="muted">Your data has not been changed. You can reload, or clear this app's saved data
          (only ExpenseX Corporate keys are removed) and start again.</p>
        <div class="row-actions">
          <button class="btn btn-ghost" type="button" data-reload>Reload</button>
          <button class="btn btn-danger" type="button" data-clear>Clear app data</button>
        </div>
      </section>
    </main>`;
  qs('.fatal-card p').textContent = error.message;
  qs('[data-reload]').addEventListener('click', () => location.reload());
  qs('[data-clear]').addEventListener('click', async () => {
    if (await confirmTyped({ title: 'Clear app data', message: 'This deletes every ExpenseX Corporate record in this browser.', word: 'CLEAR', confirmLabel: 'Clear data' })) {
      clearAppData();
      location.href = appUrl('login.html');
    }
  });
}
