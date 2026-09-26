// manager-expenses.js — every expense this manager may see: their own expenses and the SUBMITTED
// expenses of employees currently in their team (visibleExpenses). Another team's claims and any
// employee's unsent drafts never reach this page. Row actions appear only when can() allows them.

const TEAM_PAGE_SIZE = 20;
let teamManager;
let teamFilters = {};
let teamLimit = TEAM_PAGE_SIZE;

function managerRowActions(expense, db) {
  if (can(teamManager, 'expense.review', expense, db)) return reviewButtons(expense);
  const record = db.reimbursements.find((r) => r.id === expense.reimbursementId);
  if (can(teamManager, 'reimbursement.markPaid', record, db)) {
    return `<button class="btn btn-secondary btn-sm" type="button" data-review="reimburse" data-id="${expense.id}">${icon('banknote', 16)} Mark reimbursed<span class="sr-only"> ${escapeHtml(expense.title)}</span></button>`;
  }
  return '';
}

function renderTeamExpenses(user, db) {
  teamManager = user;
  const all = visibleExpenses(user, db);
  const toolbar = qs('#toolbar');

  const firstRender = !toolbar.dataset.ready;
  if (firstRender) {
    toolbar.dataset.ready = 'true';
    qs('#status').innerHTML = optionsHtml(statusOptions().filter((o) => o.value !== STATUS.DRAFT), queryParam('status') ?? '');
    qs('#category').innerHTML = optionsHtml(categoryOptions());
    qs('#employeeId').innerHTML = optionsHtml([{ value: '', label: 'Everyone' }], '');
    const read = bindToolbar(toolbar, (values) => {
      teamFilters = values;
      teamLimit = TEAM_PAGE_SIZE;
      redrawTeamExpenses?.();
    });
    teamFilters = read();
  }

  // Option lists built only from this manager's scope; the current selection is kept.
  const people = [user, ...teamMembers(user, db, { includeInactive: true })];
  // ?employee= (from the Team page) only pre-selects on the first render.
  const wanted = firstRender ? queryParam('employee') ?? '' : qs('#employeeId').value;
  qs('#employeeId').innerHTML = optionsHtml([
    { value: '', label: 'Everyone' },
    ...people.map((p) => ({ value: p.id, label: p.id === user.id ? `${p.name} (me)` : `${p.name}${isActiveUser(p) ? '' : ' (inactive)'}` })),
  ], people.some((p) => p.id === wanted) ? wanted : '');
  const projectIds = [...new Set([...visibleProjects(user, db).map((p) => p.id), ...all.map((e) => e.projectId ?? 'none')])];
  qs('#projectId').innerHTML = optionsHtml([
    { value: '', label: 'All projects' },
    ...projectIds.map((id) => ({ value: id, label: id === 'none' ? 'No project' : projectName(db, id) })),
  ], qs('#projectId').value);
  qs('#month').innerHTML = optionsHtml(monthOptions(all), qs('#month').value);
  teamFilters = { ...teamFilters, employeeId: qs('#employeeId').value, projectId: qs('#projectId').value, month: qs('#month').value };

  const matching = filterExpenses(all, db, teamFilters);
  const shown = matching.slice(0, teamLimit);
  qs('#count').textContent = `Showing ${shown.length} of ${matching.length} matching (${formatMoney(sumAmounts(matching))}) · ${all.length} in your scope`;
  qs('#more').hidden = matching.length <= teamLimit;
  qs('#list').innerHTML = shown.length
    ? `<ul class="list">${shown.map((e) => expenseRow(e, db, { showEmployee: true, showUpdated: true, actions: managerRowActions(e, db) })).join('')}</ul>`
    : emptyState(all.length ? 'No expenses match these filters.' : 'No team expenses yet.', 'receipt');
}

const redrawTeamExpenses = startPage({ roles: [ROLES.MANAGER], nav: 'expenses', title: 'Team Expenses' }, renderTeamExpenses);

qs('#more').addEventListener('click', () => {
  teamLimit += TEAM_PAGE_SIZE;
  redrawTeamExpenses?.();
});
// Approve / Reject / Mark reimbursed open the shared dialogs, which call the domain functions.
bindReviewButtons(qs('#list'), () => teamManager, () => redrawTeamExpenses?.());
