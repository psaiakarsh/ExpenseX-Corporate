// expense-form.js — one form for:
//   Employee: new expense (save draft / submit), edit draft, edit + resubmit a rejected claim.
//   Manager:  new expense for themselves (self-approved) or a team member (auto-approved).
// Editing is refused for anything other than the owner's draft or rejected claim.

const editId = queryParam('id');
let formUser;
let editing = null; // the expense being edited, if any
let newReceipt = null; // prepared image waiting to be saved
let dropReceipt = false;

function targetEmployee(db) {
  if (formUser.role === ROLES.EMPLOYEE) return formUser;
  return findUser(db, qs('#employeeId').value);
}

function renderLimitPreview() {
  const db = loadDb();
  const form = qs('#expense-form');
  const owner = targetEmployee(db);
  const box = qs('#limit-preview');
  if (!owner || owner.role !== ROLES.EMPLOYEE) {
    box.innerHTML = '<p class="muted small">Managers have no monthly limit. Your own expenses are self-approved and shown with a “Self-approved” badge.</p>';
    return;
  }
  const date = isValidDate(form.elements.date.value) ? form.elements.date.value : toLocalDate();
  const amount = parseMoney(form.elements.amount.value);
  // A draft or rejected claim isn't counted yet, so adding its amount previews the effect of submitting it.
  const extra = amount !== null && isValidAmount(amount) ? amount : 0;
  const before = limitStatus(owner, db.expenses, db.settings, monthKey(date));
  const after = limitStatus(owner, db.expenses, db.settings, monthKey(date), extra);
  box.innerHTML = `
    ${limitMeter(before, `${formatMonth(before.month)} so far`)}
    <div style="margin-top:16px">${limitMeter(after, 'After this expense')}</div>
    <p class="muted xsmall" style="margin-top:12px">${owner.id === formUser.id ? 'Your' : `${escapeHtml(owner.name)}’s`} limit warns at
      ${db.settings.limitWarningPercent}% and flags at 100%. It never blocks a submission.</p>
    ${after.level === 'exceeded' || after.level === 'warning'
      ? `<div class="callout callout-${after.level === 'exceeded' ? 'danger' : 'warning'}" style="margin-top:12px">${icon('alert')}
          <p>${after.level === 'exceeded' ? 'This expense takes the month over the limit.' : 'This expense brings the month close to the limit.'}
          You can still submit; the manager will see the flag.</p></div>`
      : ''}`;
}

function renderReceiptPreview(dataUrl, name, bytes) {
  const preview = qs('#receipt-preview');
  qs('#remove-receipt').hidden = !dataUrl;
  preview.innerHTML = dataUrl
    ? `<img class="receipt-thumb" src="${escapeHtml(dataUrl)}" alt="Preview of receipt ${escapeHtml(name)}">
       <div class="small"><div>${escapeHtml(name)}</div><div class="muted xsmall">${bytes ? formatBytes(bytes) : ''}</div></div>`
    : `<p class="muted small">${icon('image', 18)} No receipt attached.</p>`;
}

function projectOptionsFor(db, managerId, selected) {
  const projects = managerId ? selectableProjects(db, managerId) : [];
  if (projects.length === 0) {
    return `<option value="">${managerId ? 'No project (your team has no active projects)' : 'No project (no manager assigned yet)'}</option>`;
  }
  return `<option value="">Choose a project</option>${optionsHtml(projects.map((p) => ({ value: p.id, label: p.name })), selected ?? '')}`;
}

function showBlocked(message) {
  qs('#form-area').hidden = true;
  const box = qs('#blocked');
  box.hidden = false;
  box.innerHTML = `<div class="card">${emptyState(message, 'alert')}
    <div class="row" style="justify-content:center">${editId ? `<a class="btn btn-secondary" href="${expenseUrl(editId)}">View expense</a>` : ''}
    <a class="btn btn-ghost" href="${appUrl(homeFor(formUser.role))}">Back to dashboard</a></div></div>`;
}

startPage({ roles: [ROLES.EMPLOYEE, ROLES.MANAGER], nav: editId ? '' : 'new', title: editId ? 'Edit expense' : 'New expense', live: false }, (user, db) => {
  formUser = user;
  const form = qs('#expense-form');
  const isManager = user.role === ROLES.MANAGER;
  const back = qs('#back-link');
  back.innerHTML = `${icon('arrowLeft', 16)} Back`;
  back.href = editId ? expenseUrl(editId) : appUrl(isManager ? 'manager/expenses.html' : 'employee/expenses.html');

  if (editId) {
    editing = findExpense(db, editId);
    if (!can(user, 'expense.edit', editing, db)) {
      showBlocked(canViewExpense(user, editing, db)
        ? 'This expense can’t be edited. Only your own drafts and rejected expenses can be changed; approved expenses are locked to preserve history.'
        : 'Expense not found, or you don’t have access to it.');
      return;
    }
  }

  const rejected = editing?.status === STATUS.REJECTED;
  // Same rule as saveEmployeeExpense(), which also refuses the submission on its own.
  const canSubmit = !isManager && isActiveUser(findUser(db, user.managerId));
  qs('#form-title').textContent = rejected ? 'Edit and resubmit' : editing ? 'Edit draft' : 'New expense';
  qs('#form-subtitle').textContent = isManager
    ? 'Created by a manager, so it is approved straight away and moves to Reimbursement Pending.'
    : rejected ? 'Fix what your manager asked for, then resubmit. Your original values stay in the history.'
      : 'Save a draft, or submit it to your manager for approval.';
  qs('#form-status').innerHTML = editing ? statusBadge(editing.status) : '';

  // Callouts: rejection comment, unassigned employee.
  const callouts = [];
  if (rejected && editing.review) {
    const reviewer = findUser(db, editing.review.byId)?.name ?? 'Your manager';
    callouts.push(`<div class="callout callout-danger">${icon('x')}<div><strong>Rejected by ${escapeHtml(reviewer)}</strong>${escapeHtml(editing.review.comment)}</div></div>`);
  }
  if (!isManager && !canSubmit) {
    callouts.push(`<div class="callout callout-warning" role="status">${icon('alert')}<div><strong>No manager assigned yet</strong>
      An Admin must assign you to a Manager before you can submit expenses. You can still save this expense as a draft.</div></div>`);
  }
  qs('#form-callouts').innerHTML = callouts.join('');

  // Controls
  qs('#category').innerHTML = optionsHtml(categoryOptions('Choose a category'), editing?.category ?? '');
  form.elements.date.max = toLocalDate();
  form.elements.date.value = editing?.date ?? toLocalDate();
  form.elements.title.value = editing?.title ?? '';
  form.elements.amount.value = editing ? toAmountInput(editing.amount) : '';
  form.elements.notes.value = editing?.notes ?? '';

  if (isManager) {
    qs('#owner-field').hidden = false;
    const team = teamMembers(user, db);
    qs('#employeeId').innerHTML = optionsHtml([
      { value: user.id, label: `Myself (${user.name}) — self-approved` },
      ...team.map((member) => ({ value: member.id, label: member.name })),
    ], queryParam('for') ?? user.id);
    qs('#projectId').innerHTML = projectOptionsFor(db, user.id, null);
  } else {
    qs('#projectId').innerHTML = projectOptionsFor(db, user.managerId, editing?.projectId);
  }

  if (editing?.receipt) renderReceiptPreview(receiptImage(editing.receipt), editing.receipt.fileName, editing.receipt.sizeBytes);
  else renderReceiptPreview(null);

  // Buttons
  const actions = [];
  if (isManager) {
    actions.push(`<button class="btn btn-primary" type="submit" value="manager">${icon('check', 18)} Create &amp; approve</button>`);
  } else {
    if (!rejected) actions.push(`<button class="btn btn-ghost" type="submit" value="draft">Save draft</button>`);
    if (!canSubmit) actions.push('<span class="muted small" id="submit-note">Submitting needs an assigned manager.</span>');
    actions.push(`<button class="btn btn-primary" type="submit" value="submit" ${canSubmit ? '' : 'disabled aria-describedby="submit-note"'}>${icon('send', 18)} ${rejected ? 'Resubmit for approval' : 'Submit for approval'}</button>`);
  }
  qs('#form-actions').innerHTML = actions.join('');

  // Live limit preview
  ['amount', 'date', 'employeeId'].forEach((name) => form.elements[name]?.addEventListener('input', renderLimitPreview));
  form.elements.employeeId.addEventListener('change', renderLimitPreview);
  renderLimitPreview();

  // Receipt selection
  const fileInput = qs('#receipt');
  fileInput.addEventListener('change', async () => {
    const slot = qs('[data-error-for="receipt"]');
    slot.hidden = true;
    const file = fileInput.files[0];
    if (!file) return;
    const result = await prepareReceipt(file);
    if (!result.ok) {
      slot.textContent = result.error;
      slot.hidden = false;
      fileInput.value = '';
      return;
    }
    newReceipt = result.receipt;
    dropReceipt = false;
    renderReceiptPreview(newReceipt.dataUrl, newReceipt.fileName, newReceipt.sizeBytes);
  });
  qs('#remove-receipt').addEventListener('click', () => {
    newReceipt = null;
    dropReceipt = Boolean(editing?.receipt);
    fileInput.value = '';
    renderReceiptPreview(null);
    fileInput.focus();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    const intent = event.submitter?.value ?? (isManager ? 'manager' : 'draft');
    const values = formValues(form);
    // Prevent a double click from saving twice while the page navigates away.
    const buttons = qsa('button[type="submit"]', form);
    const wasDisabled = buttons.map((button) => button.disabled);
    buttons.forEach((button) => (button.disabled = true));
    let result;
    try {
      result = intent === 'manager'
        ? createManagerExpense(user, values, { employeeId: values.employeeId, receipt: newReceipt })
        : saveEmployeeExpense(user, values, { expenseId: editing?.id ?? null, submit: intent === 'submit', receipt: newReceipt, removeReceipt: dropReceipt });
    } catch (error) {
      result = { ok: false, error: error.message };
    }
    if (!result.ok) {
      buttons.forEach((button, index) => (button.disabled = wasDisabled[index]));
      showFieldErrors(form, result.errors ?? {}, result.error ?? 'Please fix the highlighted fields.');
      return;
    }
    const messages = {
      manager: result.expense.selfApproved ? 'Expense created and self-approved. Reimbursement is pending.' : 'Expense created and approved. The employee has been notified.',
      submit: rejected ? 'Expense resubmitted for approval.' : 'Expense submitted for approval.',
      draft: 'Draft saved.',
    };
    setFlash(messages[intent], 'success');
    location.href = expenseUrl(result.expense.id);
  });
});
