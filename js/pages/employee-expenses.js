// employee-expenses.js — the logged-in employee's OWN expenses (visibleExpenses scopes them).
// Actions follow the workflow: drafts can be edited or deleted, rejected claims edited and
// resubmitted; everything else is view-only. deleteDraft() re-checks permission itself.

const EXPENSES_PAGE_SIZE = 15;
let listOwner;
let listFilters = {};
let listLimit = EXPENSES_PAGE_SIZE;

function employeeRowActions(expense, db) {
  const view = `<a class="btn btn-ghost btn-sm" href="${expenseUrl(expense.id)}">View<span class="sr-only"> ${escapeHtml(expense.title)}</span></a>`;
  if (!can(listOwner, 'expense.edit', expense, db)) return view;
  if (expense.status === STATUS.DRAFT) {
    return `<a class="btn btn-secondary btn-sm" href="${expenseFormUrl(expense.id)}">${icon('edit', 16)} Edit<span class="sr-only"> ${escapeHtml(expense.title)}</span></a>
      <button class="btn btn-danger-ghost btn-sm" type="button" data-delete="${expense.id}">${icon('trash', 16)} Delete<span class="sr-only"> draft ${escapeHtml(expense.title)}</span></button>`;
  }
  return `<a class="btn btn-secondary btn-sm" href="${expenseFormUrl(expense.id)}">${icon('edit', 16)} Edit &amp; resubmit<span class="sr-only"> ${escapeHtml(expense.title)}</span></a>`;
}

// Projects the employee can filter by: their current team's projects plus any project on their own claims
// (e.g. from a previous manager). Names only — no other data.
function projectFilterOptions(expenses, db, user) {
  const ids = new Set([...visibleProjects(user, db).map((p) => p.id), ...expenses.map((e) => e.projectId).filter(Boolean)]);
  const options = [...ids].map((id) => ({ value: id, label: projectName(db, id) })).sort((a, b) => a.label.localeCompare(b.label));
  return [{ value: '', label: 'All projects' }, ...options, { value: 'none', label: 'No project' }];
}

function renderExpenseList(user, db) {
  listOwner = user;
  const all = visibleExpenses(user, db); // own expenses only
  const toolbar = qs('#toolbar');

  if (!toolbar.dataset.ready) {
    toolbar.dataset.ready = 'true';
    qs('#status').innerHTML = optionsHtml(statusOptions(), queryParam('status') ?? '');
    qs('#category').innerHTML = optionsHtml(categoryOptions());
    const read = bindToolbar(toolbar, (values) => {
      listFilters = values;
      listLimit = EXPENSES_PAGE_SIZE;
      redrawExpenseList?.();
    });
    listFilters = read();
  }
  // Refresh option lists that depend on data, keeping the current selection.
  qs('#projectId').innerHTML = optionsHtml(projectFilterOptions(all, db, user), qs('#projectId').value);
  qs('#month').innerHTML = optionsHtml(monthOptions(all), qs('#month').value);
  listFilters = { ...listFilters, projectId: qs('#projectId').value, month: qs('#month').value };

  const banner = qs('#assignment-banner');
  banner.hidden = Boolean(user.managerId);
  banner.innerHTML = `${icon('alert')}<div><strong>No manager assigned yet</strong>
    You can create drafts, but you cannot submit an expense until an Admin assigns you to a Manager.</div>`;

  const matching = filterExpenses(all, db, listFilters);
  const shown = matching.slice(0, listLimit);
  qs('#count').textContent = `Showing ${shown.length} of ${matching.length} matching · ${all.length} expense${all.length === 1 ? '' : 's'} in total`;
  qs('#more').hidden = matching.length <= listLimit;
  qs('#list').innerHTML = shown.length
    ? `<ul class="list">${shown.map((e) => expenseRow(e, db, { showUpdated: true, actions: employeeRowActions(e, db) })).join('')}</ul>`
    : emptyState(all.length ? 'No expenses match these filters.' : 'No expenses yet. Create your first one.', 'receipt');
}

const redrawExpenseList = startPage({ roles: [ROLES.EMPLOYEE], nav: 'expenses', title: 'My Expenses' }, renderExpenseList);

qs('#more').addEventListener('click', () => {
  listLimit += EXPENSES_PAGE_SIZE;
  redrawExpenseList?.();
});

qs('#list').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  const confirmed = await confirmAction({
    title: 'Delete draft?',
    message: 'This draft was never submitted, so deleting it removes it completely. Submitted expenses can never be deleted.',
    confirmLabel: 'Delete draft',
    danger: true,
  });
  if (confirmed) runAction(() => deleteDraft(listOwner, button.dataset.delete), 'Draft deleted.');
  redrawExpenseList?.();
});
