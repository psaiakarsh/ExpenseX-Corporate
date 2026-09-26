// expense-detail.js — one expense: details, receipt, review, reimbursement and full history.
// Visible only to the owner and the employee's current manager (canViewExpense). Admin is not allowed here
// (the page guard excludes the Admin role). Every action button is shown only when can() allows it,
// and the domain function called by the button checks permission again.

const expenseId = queryParam('id');
let viewer;

function actionButtons(expense, db) {
  const buttons = [];
  if (can(viewer, 'expense.edit', expense, db)) {
    if (expense.status === STATUS.DRAFT) {
      buttons.push(`<a class="btn btn-primary" href="${expenseFormUrl(expense.id)}">${icon('edit', 18)} Edit draft</a>`);
      buttons.push(`<button class="btn btn-danger-ghost" type="button" data-action="delete">${icon('trash', 18)} Delete draft</button>`);
    } else {
      buttons.push(`<a class="btn btn-primary" href="${expenseFormUrl(expense.id)}">${icon('edit', 18)} Edit &amp; resubmit</a>`);
    }
  }
  if (can(viewer, 'expense.review', expense, db)) {
    buttons.push(`<button class="btn btn-primary" type="button" data-action="approve">${icon('check', 18)} Approve</button>`);
    buttons.push(`<button class="btn btn-danger-ghost" type="button" data-action="reject">${icon('x', 18)} Reject</button>`);
  }
  const record = db.reimbursements.find((r) => r.id === expense.reimbursementId);
  if (can(viewer, 'reimbursement.markPaid', record, db)) {
    buttons.push(`<button class="btn btn-primary" type="button" data-action="reimburse">${icon('banknote', 18)} Mark as reimbursed</button>`);
  }
  if (buttons.length === 0) {
    const reason = [STATUS.DRAFT, STATUS.REJECTED].includes(expense.status)
      ? 'View only.'
      : 'View only — submitted and approved records are locked to preserve financial history.';
    return `<p class="muted small">${icon('shield', 14)} ${reason}</p>`;
  }
  return buttons.join('');
}

function render(user, db) {
  viewer = user;
  const back = qs('#back-link');
  back.innerHTML = `${icon('arrowLeft', 16)} Back to expenses`;
  back.href = appUrl(user.role === ROLES.MANAGER ? 'manager/expenses.html' : 'employee/expenses.html');

  const expense = findExpense(db, expenseId);
  // Same message whether it doesn't exist or isn't yours, so nothing leaks about other people's claims.
  if (!canViewExpense(user, expense, db)) {
    qs('#content').innerHTML = `<div class="card">${emptyState('Expense not found, or you don’t have access to it.', 'alert')}</div>`;
    return;
  }

  document.title = `${expense.title} · ExpenseX Corporate`;
  const employee = findUser(db, expense.employeeId);
  const creator = findUser(db, expense.createdById);
  const manager = findUser(db, expense.managerId);
  const record = db.reimbursements.find((r) => r.id === expense.reimbursementId);
  const reviewer = expense.review ? findUser(db, expense.review.byId) : null;
  const receiptSrc = receiptImage(expense.receipt);
  const isReviewer = user.role === ROLES.MANAGER && expense.employeeId !== user.id;

  // Reviewers see the employee's limit for that month (a flag, never a block).
  let limitHtml = '';
  if (isReviewer && employee?.role === ROLES.EMPLOYEE) {
    const status = limitStatus(employee, db.expenses, db.settings, monthKey(expense.date));
    limitHtml = `<section class="card" aria-labelledby="limit-title">
        <div class="card-header"><h2 id="limit-title">${escapeHtml(employee.name)}’s limit</h2>${limitBadge(status.level)}</div>
        ${limitMeter(status, formatMonth(status.month))}
      </section>`;
  }

  const reviewHtml = expense.review
    ? `<div class="callout ${expense.review.decision === 'rejected' ? 'callout-danger' : 'callout-info'}">
        ${icon(expense.review.decision === 'rejected' ? 'x' : 'check')}
        <div><strong>${expense.review.decision === 'rejected' ? 'Rejected' : 'Approved'} by ${escapeHtml(reviewer?.name ?? 'manager')} · ${escapeHtml(formatDateTime(expense.review.at))}</strong>
        ${expense.review.comment ? escapeHtml(expense.review.comment) : '<span class="muted">No comment.</span>'}</div>
      </div>`
    : '';

  qs('#content').innerHTML = `
    <div class="grid-3">
      <div class="span-2 stack">
        <section class="card stack" aria-labelledby="expense-title">
          <div class="detail-hero">
            <div class="row">${statusBadge(expense.status)}${expense.selfApproved ? selfApprovedBadge() : ''}</div>
            <h2 id="expense-title">${escapeHtml(expense.title)}</h2>
            <p class="detail-amount">${formatMoney(expense.amount)}</p>
          </div>
          <dl class="details">
            <div><dt>Employee</dt><dd>${escapeHtml(employee?.name ?? 'Unknown')}</dd></div>
            <div><dt>Entered by</dt><dd>${escapeHtml(creator?.name ?? 'Unknown')}</dd></div>
            <div><dt>Reviewing manager</dt><dd>${escapeHtml(manager?.name ?? 'Not submitted yet')}</dd></div>
            <div><dt>Project</dt><dd>${escapeHtml(projectName(db, expense.projectId))}</dd></div>
            <div><dt>Category</dt><dd>${escapeHtml(expense.category)}</dd></div>
            <div><dt>Expense date</dt><dd>${escapeHtml(formatDate(expense.date))}</dd></div>
            <div><dt>Created</dt><dd>${escapeHtml(formatDateTime(expense.createdAt))}</dd></div>
            <div><dt>Last updated</dt><dd>${escapeHtml(formatDateTime(expense.updatedAt))}</dd></div>
          </dl>
          <div><h3 class="small muted">Description</h3><p>${expense.notes ? escapeHtml(expense.notes) : '<span class="muted">No description.</span>'}</p></div>
          ${reviewHtml}
          <div class="row-actions" id="actions">${actionButtons(expense, db)}</div>
        </section>

        <section class="card" aria-labelledby="history-title">
          <div class="card-header"><h2 id="history-title">History</h2><span class="muted xsmall">Newest first · never rewritten</span></div>
          ${timelineHtml(expense, db)}
        </section>
      </div>

      <div class="stack">
        <section class="card" aria-labelledby="receipt-title">
          <div class="card-header"><h2 id="receipt-title">Receipt</h2></div>
          ${receiptSrc
            ? `<button class="receipt-button" type="button" data-action="receipt" aria-label="Open receipt ${escapeHtml(expense.receipt.fileName)} full size">
                 <img class="receipt-thumb" style="width:100%;height:auto;max-height:320px;object-fit:contain" src="${escapeHtml(receiptSrc)}" alt="Receipt for ${escapeHtml(expense.title)}">
               </button>
               <p class="muted xsmall" style="margin-top:8px">${escapeHtml(expense.receipt.fileName)} · ${formatBytes(expense.receipt.sizeBytes)}</p>`
            : emptyState('No receipt attached.', 'image')}
        </section>

        <section class="card" aria-labelledby="reimbursement-title">
          <div class="card-header"><h2 id="reimbursement-title">Reimbursement</h2></div>
          ${record
            ? `<dl class="details" style="grid-template-columns:1fr">
                <div><dt>Status</dt><dd>${record.status === 'reimbursed' ? statusBadge(STATUS.REIMBURSED) : statusBadge(STATUS.REIMBURSEMENT_PENDING)}</dd></div>
                <div><dt>Amount</dt><dd class="num">${formatMoney(record.amount)}</dd></div>
                <div><dt>Approved by</dt><dd>${escapeHtml(findUser(db, record.managerId)?.name ?? '—')} · ${escapeHtml(formatDateTime(record.createdAt))}</dd></div>
                ${record.reimbursedAt
                  ? `<div><dt>Reimbursed by</dt><dd>${escapeHtml(findUser(db, record.reimbursedById)?.name ?? '—')} · ${escapeHtml(formatDateTime(record.reimbursedAt))}</dd></div>`
                  : ''}
                ${record.reference ? `<div><dt>Reference</dt><dd>${escapeHtml(record.reference)}</dd></div>` : ''}
              </dl>`
            : `<p class="muted small">A reimbursement record is created when the expense is approved.</p>`}
        </section>
        ${limitHtml}
      </div>
    </div>`;
}

async function handleAction(action) {
  const db = loadDb();
  const expense = findExpense(db, expenseId);
  if (!expense) return;

  if (action === 'receipt') {
    await openFormDialog({
      title: expense.receipt.fileName,
      description: `<img class="receipt-full" src="${escapeHtml(receiptImage(expense.receipt))}" alt="Receipt for ${escapeHtml(expense.title)}">`,
      submitLabel: 'Close',
      onSubmit: () => ({ ok: true }),
    });
  } else if (action === 'delete') {
    const yes = await confirmAction({ title: 'Delete draft?', message: 'This draft was never submitted, so it is removed completely.', confirmLabel: 'Delete draft', danger: true });
    if (yes && runAction(() => deleteDraft(viewer, expense.id), 'Draft deleted.').ok) {
      location.href = appUrl('employee/expenses.html');
      return;
    }
  } else if (action === 'approve') {
    await approveDialog(viewer, expense);
  } else if (action === 'reject') {
    await rejectDialog(viewer, expense);
  } else if (action === 'reimburse') {
    await reimburseDialog(viewer, expense);
  }
  render(viewer, loadDb());
}

startPage({ roles: [ROLES.EMPLOYEE, ROLES.MANAGER], nav: '', title: 'Expense' }, render);

qs('#content').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (button) handleAction(button.dataset.action);
});
