// manager-approvals.js — the manager's review queue and their recent decisions.
// "Awaiting my review" uses can('expense.review'): PENDING claims of employees currently in this
// manager's team (never the manager's own, never another team's). Manager-created expenses are
// approved on creation, so they never appear here. Approve / Reject call approveExpense() /
// rejectExpense() through the shared dialogs; those functions re-check every rule.

let approver;
let approvalFilters = { view: 'pending', sort: 'waiting' };

// Which of the visible expenses belong to the chosen view.
function approvalScope(user, db, view) {
  const visible = visibleExpenses(user, db).filter((e) => e.employeeId !== user.id);
  if (view === 'rejected') {
    return visible.filter((e) => e.status === STATUS.REJECTED && e.review?.byId === user.id);
  }
  if (view === 'approved') {
    return visible.filter((e) => e.history.some((h) => h.action === 'approved' && h.byId === user.id));
  }
  return visible.filter((e) => can(user, 'expense.review', e, db));
}

function sortForApprovals(expenses, sort) {
  if (sort !== 'waiting') return expenses; // filterExpenses already applied the other sorts
  return [...expenses].sort((a, b) => (lastSubmittedAt(a) ?? a.updatedAt).localeCompare(lastSubmittedAt(b) ?? b.updatedAt));
}

function renderApprovals(user, db) {
  approver = user;
  const toolbar = qs('#toolbar');
  const queue = approvalScope(user, db, 'pending');

  if (!toolbar.dataset.ready) {
    toolbar.dataset.ready = 'true';
    qs('#category').innerHTML = optionsHtml(categoryOptions());
    const read = bindToolbar(toolbar, (values) => {
      approvalFilters = values;
      redrawApprovals?.();
    });
    approvalFilters = read();
  }

  const scoped = approvalScope(user, db, approvalFilters.view);
  // Filter options come only from records in this manager's scope.
  const people = [...new Set(scoped.map((e) => e.employeeId))].map((id) => findUser(db, id)).filter(Boolean);
  qs('#employeeId').innerHTML = optionsHtml([{ value: '', label: 'All employees' }, ...people.map((p) => ({ value: p.id, label: p.name }))], qs('#employeeId').value);
  const projectIds = [...new Set(scoped.map((e) => e.projectId ?? 'none'))];
  qs('#projectId').innerHTML = optionsHtml([{ value: '', label: 'All projects' }, ...projectIds.map((id) => ({ value: id, label: id === 'none' ? 'No project' : projectName(db, id) }))], qs('#projectId').value);
  qs('#month').innerHTML = optionsHtml(monthOptions(scoped), qs('#month').value);
  const filters = { ...approvalFilters, employeeId: qs('#employeeId').value, projectId: qs('#projectId').value, month: qs('#month').value };

  const shown = sortForApprovals(filterExpenses(scoped, db, { ...filters, sort: filters.sort === 'waiting' ? 'newest' : filters.sort }), filters.sort);

  qs('#summary').textContent = queue.length
    ? `${queue.length} expense${queue.length === 1 ? '' : 's'} awaiting your review · ${formatMoney(sumAmounts(queue))}`
    : 'Nothing is awaiting your review.';
  qs('#count').textContent = `${shown.length} shown · ${formatMoney(sumAmounts(shown))}`;

  const emptyText = {
    pending: scoped.length ? 'No pending expenses match these filters.' : 'All caught up — nothing is awaiting your review.',
    rejected: 'No rejected expenses are waiting for resubmission.',
    approved: 'You have not approved any expenses yet.',
  }[filters.view];

  qs('#list').innerHTML = shown.length
    ? `<ul class="list">${shown.map((e) => expenseRow(e, db, {
      showEmployee: true,
      showSubmitted: true,
      flag: reviewFlags(e, db),
      actions: `<a class="btn btn-ghost btn-sm" href="${expenseUrl(e.id)}">Details<span class="sr-only"> for ${escapeHtml(e.title)}</span></a>
        ${can(user, 'expense.review', e, db) ? reviewButtons(e) : ''}`,
    })).join('')}</ul>`
    : emptyState(emptyText, 'inbox');
}

const redrawApprovals = startPage({ roles: [ROLES.MANAGER], nav: 'approvals', title: 'Approvals' }, renderApprovals);
bindReviewButtons(qs('#list'), () => approver, () => redrawApprovals?.());
