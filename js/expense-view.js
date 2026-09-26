// expense-view.js — shared pieces for showing expenses: list rows, filters, sorting, timeline.

function expenseUrl(expenseId) {
  return appUrl(`shared/expense.html?id=${encodeURIComponent(expenseId)}`);
}

function expenseFormUrl(expenseId) {
  return appUrl(`shared/expense-form.html?id=${encodeURIComponent(expenseId)}`);
}

// One expense as a list row. `actions` is extra HTML (buttons) shown on the right.
function expenseRow(expense, db, { showEmployee = false, showUpdated = false, showSubmitted = false, actions = '', flag = '' } = {}) {
  const employee = findUser(db, expense.employeeId);
  const submitted = showSubmitted ? lastSubmittedAt(expense) : null;
  const meta = [
    formatDate(expense.date),
    expense.category,
    projectName(db, expense.projectId),
    showEmployee ? employee?.name ?? 'Unknown' : '',
    expense.receipt ? 'Receipt attached' : 'No receipt',
    submitted ? `Submitted ${formatRelative(submitted)}` : '',
    showUpdated ? `Updated ${formatRelative(expense.updatedAt)}` : '',
  ].filter(Boolean);
  const rejectedNote = expense.status === STATUS.REJECTED && expense.review?.comment
    ? `<p class="row-note"><strong>Manager comment:</strong> ${escapeHtml(expense.review.comment)}</p>`
    : '';

  return `<li class="list-row">
      <span class="row-icon" aria-hidden="true">${icon(expense.receipt ? 'image' : 'receipt')}</span>
      <div class="list-row-main">
        <a class="list-row-title" href="${expenseUrl(expense.id)}" title="${escapeHtml(expense.title)}">${escapeHtml(expense.title)}</a>
        <div class="list-row-meta">${meta.map((part) => `<span title="${escapeHtml(part)}">${escapeHtml(part)}</span>`).join('')}</div>
      </div>
      <div class="list-row-side">
        <span class="list-row-amount">${formatMoney(expense.amount)}</span>
        ${statusBadge(expense.status)}${expense.selfApproved ? selfApprovedBadge() : ''}${flag}
        ${actions}
      </div>
      ${rejectedNote}
    </li>`;
}

// When the claim was last sent for approval (submitted or resubmitted), from its history.
function lastSubmittedAt(expense) {
  const entry = [...expense.history].reverse().find((h) => h.action === 'submitted' || h.action === 'resubmitted');
  return entry?.at ?? null;
}

function expenseList(expenses, db, options = {}, emptyMessage = 'No expenses yet.') {
  if (expenses.length === 0) return emptyState(emptyMessage, 'receipt');
  return `<ul class="list">${expenses.map((expense) => expenseRow(expense, db, options)).join('')}</ul>`;
}

const SORTS = {
  newest: (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  highest: (a, b) => b.amount - a.amount,
  lowest: (a, b) => a.amount - b.amount,
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
};

// filters: { search, status, category, projectId, employeeId, month, sort } — empty values mean "all".
function filterExpenses(expenses, db, filters = {}) {
  const search = String(filters.search ?? '').trim().toLowerCase();
  return expenses
    .filter((e) => !filters.status || e.status === filters.status)
    .filter((e) => !filters.category || e.category === filters.category)
    .filter((e) => !filters.projectId || (e.projectId ?? 'none') === filters.projectId)
    .filter((e) => !filters.employeeId || e.employeeId === filters.employeeId)
    .filter((e) => !filters.month || monthKey(e.date) === filters.month)
    .filter((e) => {
      if (!search) return true;
      const haystack = [e.title, e.notes, e.category, projectName(db, e.projectId), findUser(db, e.employeeId)?.name]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    })
    .sort(SORTS[filters.sort] ?? SORTS.newest);
}

function optionsHtml(options, selected = '') {
  return options
    .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === selected ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
    .join('');
}

function statusOptions() {
  return [{ value: '', label: 'All statuses' }, ...STATUS_ORDER.map((status) => ({ value: status, label: STATUS_LABELS[status] }))];
}

function categoryOptions(allLabel = 'All categories') {
  return [{ value: '', label: allLabel }, ...CATEGORIES.map((category) => ({ value: category, label: category }))];
}

function monthOptions(expenses) {
  const keys = [...new Set(expenses.map((e) => monthKey(e.date)))].sort().reverse();
  return [{ value: '', label: 'All months' }, ...keys.map((key) => ({ value: key, label: formatMonth(key) }))];
}

// Wires every [name] control inside `toolbar` to call onChange(filters) (search is debounced).
function bindToolbar(toolbar, onChange) {
  const read = () => Object.fromEntries(qsa('[name]', toolbar).map((control) => [control.name, control.value]));
  const debounced = debounce(() => onChange(read()), 200);
  toolbar.addEventListener('input', (event) => (event.target.type === 'search' ? debounced() : onChange(read())));
  toolbar.addEventListener('change', () => onChange(read()));
  return read;
}

// ---------- Timeline ----------

const HISTORY_TEXT = {
  created: { label: 'Draft created', icon: 'edit' },
  submitted: { label: 'Submitted for approval', icon: 'send' },
  resubmitted: { label: 'Edited and resubmitted', icon: 'refresh' },
  approved: { label: 'Approved', icon: 'check' },
  created_approved: { label: 'Created by manager — approved', icon: 'check' },
  rejected: { label: 'Rejected', icon: 'x' },
  reimbursement_queued: { label: 'Reimbursement pending', icon: 'banknote' },
  reimbursed: { label: 'Reimbursed', icon: 'check' },
  reassigned: { label: 'Review moved to a new manager', icon: 'users' },
};

const FIELD_LABELS = { title: 'Title', amount: 'Amount', category: 'Category', date: 'Date', projectId: 'Project', notes: 'Notes', receipt: 'Receipt' };

function formatFieldValue(db, field, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'amount') return formatMoney(value);
  if (field === 'date') return formatDate(value);
  if (field === 'projectId') return projectName(db, value);
  return String(value);
}

function timelineHtml(expense, db) {
  const items = [...expense.history].reverse().map((entry) => {
    const text = HISTORY_TEXT[entry.action] ?? { label: STATUS_LABELS[entry.toStatus] ?? entry.action, icon: 'info' };
    const by = findUser(db, entry.byId)?.name ?? 'System';
    const changes = (entry.changes ?? []).map((change) =>
      `<li>${escapeHtml(FIELD_LABELS[change.field] ?? change.field)}: ${escapeHtml(formatFieldValue(db, change.field, change.from))} → ${escapeHtml(formatFieldValue(db, change.field, change.to))}</li>`);
    return `<li>
        <span class="timeline-dot tone-${escapeHtml(entry.toStatus ?? '')}" aria-hidden="true">${icon(text.icon, 14)}</span>
        <div class="timeline-body">
          <strong>${escapeHtml(text.label)}${entry.action === 'created_approved' && expense.selfApproved ? ' (self-approved)' : ''}</strong>
          <span class="muted xsmall">${escapeHtml(by)} · <time datetime="${escapeHtml(entry.at)}">${escapeHtml(formatDateTime(entry.at))}</time></span>
          ${entry.comment ? `<p class="timeline-comment">${escapeHtml(entry.comment)}</p>` : ''}
          ${changes.length ? `<ul class="change-list" aria-label="Changes">${changes.join('')}</ul>` : ''}
        </div>
      </li>`;
  });
  return `<ol class="timeline">${items.join('')}</ol>`;
}

// Recent workflow events across many expenses (a derived activity feed for managers).
function recentEvents(expenses, db, count = 8) {
  const events = expenses.flatMap((expense) => expense.history.map((entry) => ({ entry, expense })));
  events.sort((a, b) => b.entry.at.localeCompare(a.entry.at));
  const top = events.slice(0, count);
  if (top.length === 0) return emptyState('No activity yet.', 'activity');
  return `<ul class="list">${top.map(({ entry, expense }) => {
    const text = HISTORY_TEXT[entry.action] ?? { label: entry.action, icon: 'info' };
    const by = findUser(db, entry.byId)?.name ?? 'System';
    return `<li class="list-row compact">
        <span class="timeline-dot tone-${escapeHtml(entry.toStatus ?? '')}" aria-hidden="true">${icon(text.icon, 14)}</span>
        <div class="list-row-main">
          <a class="list-row-title small truncate" href="${expenseUrl(expense.id)}">${escapeHtml(expense.title)}</a>
          <span class="muted xsmall">${escapeHtml(text.label)} · ${escapeHtml(by)} · ${escapeHtml(formatRelative(entry.at))}</span>
        </div>
      </li>`;
  }).join('')}</ul>`;
}

// ---------- Review dialogs (used by the detail, approvals, dashboard and reimbursements pages) ----------

function approveDialog(manager, expense) {
  return openFormDialog({
    title: 'Approve expense',
    description: `<p><strong>${escapeHtml(expense.title)}</strong> · ${formatMoney(expense.amount)}</p>
      <p>Approving creates a reimbursement record and moves the claim to Reimbursement Pending.</p>`,
    fields: [{ name: 'comment', label: 'Comment for the employee', type: 'textarea', maxLength: COMMENT_MAX }],
    submitLabel: 'Approve',
    onSubmit: ({ comment }) => {
      const result = approveExpense(manager, expense.id, comment);
      if (result.ok) toast('Expense approved. Reimbursement is now pending.');
      return result;
    },
  });
}

function rejectDialog(manager, expense) {
  return openFormDialog({
    title: 'Reject expense',
    description: `<p><strong>${escapeHtml(expense.title)}</strong> · ${formatMoney(expense.amount)}</p><p>The employee can edit and resubmit it.</p>`,
    fields: [{ name: 'comment', label: 'Reason', type: 'textarea', required: true, maxLength: COMMENT_MAX, hint: 'Tell the employee what to fix (at least 5 characters).' }],
    submitLabel: 'Reject',
    danger: true,
    onSubmit: ({ comment }) => {
      const result = rejectExpense(manager, expense.id, comment);
      if (result.ok) toast('Expense rejected. The employee has been notified.');
      return result;
    },
  });
}

function reimburseDialog(manager, expense) {
  return openFormDialog({
    title: 'Mark as reimbursed',
    description: `<p><strong>${escapeHtml(expense.title)}</strong> · ${formatMoney(expense.amount)}</p>
      <p>Confirm the amount has been paid out. The expense record itself is not changed.</p>`,
    fields: [{ name: 'reference', label: 'Payment reference', maxLength: REFERENCE_MAX, placeholder: 'e.g. NEFT-123456' }],
    submitLabel: 'Mark reimbursed',
    onSubmit: ({ reference }) => {
      const result = markReimbursed(manager, expense.reimbursementId, reference);
      if (result.ok) toast('Marked as reimbursed.');
      return result;
    },
  });
}

// Handles clicks on [data-review="approve|reject|reimburse"][data-id] buttons, then calls `after`.
function bindReviewButtons(container, getManager, after) {
  container.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-review]');
    if (!button) return;
    const expense = findExpense(loadDb(), button.dataset.id);
    if (!expense) return;
    const dialogs = { approve: approveDialog, reject: rejectDialog, reimburse: reimburseDialog };
    await dialogs[button.dataset.review](getManager(), expense);
    after();
    // The redraw replaced the button; put keyboard focus back on its replacement, or on the page
    // content if that claim has left the list (e.g. it was just approved).
    const again = qs(`[data-review="${button.dataset.review}"][data-id="${button.dataset.id}"]`, container);
    (again ?? qs('#main'))?.focus();
  });
}

function reviewButtons(expense) {
  return `<button class="btn btn-primary btn-sm" type="button" data-review="approve" data-id="${expense.id}" aria-label="Approve ${escapeHtml(expense.title)}">${icon('check', 16)} Approve</button>
    <button class="btn btn-danger-ghost btn-sm" type="button" data-review="reject" data-id="${expense.id}" aria-label="Reject ${escapeHtml(expense.title)}">${icon('x', 16)} Reject</button>`;
}

// Flags shown to a reviewer: limit level for the claim's month, and "Resubmitted".
function reviewFlags(expense, db) {
  const employee = findUser(db, expense.employeeId);
  const flags = [];
  if (employee?.role === ROLES.EMPLOYEE) flags.push(limitBadge(limitStatus(employee, db.expenses, db.settings, monthKey(expense.date)).level));
  if (expense.history.some((entry) => entry.action === 'resubmitted')) flags.push(`<span class="badge badge-muted">${icon('refresh', 14)}Resubmitted</span>`);
  return flags.join('');
}

function notificationPreview(user, db, count = 5) {
  const items = notificationsFor(user, db).slice(0, count);
  if (items.length === 0) return emptyState('No notifications yet.', 'bell');
  return `<ul class="list">${items.map((n) => `<li class="list-row compact">
      <span class="${n.read ? '' : 'unread-dot'}" aria-hidden="true"></span>
      <div class="list-row-main">
        <span class="small"><strong>${escapeHtml(n.title)}</strong>${n.read ? '' : ' <span class="sr-only">(unread)</span>'}</span>
        <span class="muted xsmall">${escapeHtml(n.message)}</span>
        <span class="muted xsmall">${escapeHtml(formatRelative(n.createdAt))}</span>
      </div>
    </li>`).join('')}</ul>`;
}
