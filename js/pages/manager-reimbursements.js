// manager-reimbursements.js — reimbursement records in this manager's scope (visibleReimbursements:
// same visibility as the expense). "Mark reimbursed" appears only when can('reimbursement.markPaid')
// allows it — the employee's CURRENT manager, or the manager for their own self-approved expense —
// and markReimbursed() checks the same rule again.

let payer;
let reimbursementTab = 'pending';
let reimbursementFilters = {};

function nameOf(db, userId) {
  return findUser(db, userId)?.name ?? '—';
}

function dateOf(isoTimestamp) {
  return isoTimestamp ? formatDate(toLocalDate(new Date(isoTimestamp))) : '—';
}

function reimbursementRow(record, db) {
  const expense = findExpense(db, record.expenseId);
  const pending = record.status === 'pending';
  const canPay = can(payer, 'reimbursement.markPaid', record, db);
  return `<tr>
      <th scope="row" style="text-align:left">
        <a href="${expenseUrl(record.expenseId)}">${escapeHtml(expense?.title ?? 'Expense')}</a>
        ${expense?.selfApproved ? `<div>${selfApprovedBadge()}</div>` : ''}
      </th>
      <td data-label="Employee">${escapeHtml(nameOf(db, record.employeeId))}</td>
      <td data-label="Project">${escapeHtml(projectName(db, expense?.projectId))}</td>
      <td data-label="Amount" class="amount">${formatMoney(record.amount)}</td>
      <td data-label="Approved">${escapeHtml(dateOf(record.createdAt))}<div class="muted xsmall">by ${escapeHtml(nameOf(db, record.managerId))}</div></td>
      <td data-label="Status">${statusBadge(pending ? STATUS.REIMBURSEMENT_PENDING : STATUS.REIMBURSED)}</td>
      ${pending
        ? `<td class="actions-cell">${canPay
          ? `<button class="btn btn-primary btn-sm" type="button" data-review="reimburse" data-id="${record.expenseId}">Mark reimbursed<span class="sr-only"> ${escapeHtml(expense?.title ?? '')}</span></button>`
          : '<span class="muted xsmall">Not yours to pay</span>'}</td>`
        : `<td data-label="Reimbursed">${escapeHtml(dateOf(record.reimbursedAt))}</td>
           <td data-label="Reimbursed by">${escapeHtml(nameOf(db, record.reimbursedById))}</td>
           <td data-label="Reference">${escapeHtml(record.reference || '—')}</td>`}
    </tr>`;
}

function renderReimbursements(user, db) {
  payer = user;
  const records = visibleReimbursements(user, db);
  const pending = records.filter((r) => r.status === 'pending');
  const paid = records.filter((r) => r.status === 'reimbursed');
  const payable = pending.filter((r) => can(user, 'reimbursement.markPaid', r, db));
  const paidThisMonth = paid.filter((r) => monthKey(toLocalDate(new Date(r.reimbursedAt))) === currentMonthKey());

  qs('#stats').innerHTML = [
    statCard({ label: 'Awaiting payout', value: formatMoney(sumAmounts(payable)), sub: countText(payable.length, 'record'), iconName: 'banknote', accent: true }),
    statCard({ label: 'Your own (self-approved)', value: formatMoney(sumAmounts(payable.filter((r) => r.employeeId === user.id))), sub: 'awaiting payout', iconName: 'shield' }),
    statCard({ label: 'Reimbursed this month', value: formatMoney(sumAmounts(paidThisMonth)), sub: countText(paidThisMonth.length, 'record'), iconName: 'clock' }),
    statCard({ label: 'Reimbursed (all time)', value: formatMoney(sumAmounts(paid)), sub: countText(paid.length, 'record'), iconName: 'check' }),
  ].join('');

  const tabRecords = reimbursementTab === 'pending' ? pending : paid;
  const people = [...new Set(records.map((r) => r.employeeId))].map((id) => findUser(db, id)).filter(Boolean);
  qs('#employeeId').innerHTML = optionsHtml([{ value: '', label: 'Everyone' }, ...people.map((p) => ({ value: p.id, label: p.name }))], qs('#employeeId').value);

  const search = String(reimbursementFilters.search ?? '').trim().toLowerCase();
  const employeeId = qs('#employeeId').value;
  const list = tabRecords
    .filter((r) => !employeeId || r.employeeId === employeeId)
    .filter((r) => {
      if (!search) return true;
      const expense = findExpense(db, r.expenseId);
      return [expense?.title, nameOf(db, r.employeeId), projectName(db, expense?.projectId), r.reference].join(' ').toLowerCase().includes(search);
    })
    .sort((a, b) => (reimbursementTab === 'pending' ? a.createdAt.localeCompare(b.createdAt) : b.reimbursedAt.localeCompare(a.reimbursedAt)));

  qs('#count').textContent = `${list.length} record${list.length === 1 ? '' : 's'} · ${formatMoney(sumAmounts(list))}${reimbursementTab === 'pending' ? ' · oldest approval first' : ''}`;
  if (list.length === 0) {
    qs('#table').innerHTML = emptyState(reimbursementTab === 'pending' ? 'Nothing is waiting for reimbursement.' : 'Nothing reimbursed yet.', 'banknote');
    return;
  }
  qs('#table').innerHTML = `<div class="table-wrap"><table class="table table-stack">
      <caption class="sr-only">${reimbursementTab === 'pending' ? 'Reimbursements awaiting payout' : 'Reimbursed expenses'}</caption>
      <thead><tr>
        <th scope="col">Expense</th><th scope="col">Employee</th><th scope="col">Project</th><th scope="col" class="amount">Amount</th>
        <th scope="col">Approved</th><th scope="col">Status</th>
        ${reimbursementTab === 'pending'
          ? '<th scope="col"><span class="sr-only">Action</span></th>'
          : '<th scope="col">Reimbursed</th><th scope="col">Reimbursed by</th><th scope="col">Reference</th>'}
      </tr></thead>
      <tbody>${list.map((r) => reimbursementRow(r, db)).join('')}</tbody>
    </table></div>`;
}

const redrawReimbursements = startPage({ roles: [ROLES.MANAGER], nav: 'reimbursements', title: 'Reimbursements' }, renderReimbursements);

qsa('[data-tab]').forEach((tab) => tab.addEventListener('click', () => {
  reimbursementTab = tab.dataset.tab;
  qsa('[data-tab]').forEach((other) => other.setAttribute('aria-pressed', String(other === tab)));
  redrawReimbursements?.();
}));
bindToolbar(qs('#toolbar'), (values) => {
  reimbursementFilters = values;
  redrawReimbursements?.();
});
// Opens the shared dialog, which calls markReimbursed().
bindReviewButtons(qs('#table'), () => payer, () => redrawReimbursements?.());
