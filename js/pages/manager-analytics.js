// manager-analytics.js — team analytics. Every figure starts from visibleExpenses(manager) and
// visibleReimbursements(manager), so another manager's team and company-wide data never appear.
// Calculations live in analytics.js; this page only filters by period/employee/project and renders.

let analyticsFilters = { months: '6', employeeId: '', projectId: '' };
let analyticsManager;

function employeeTableHtml(expenses, db) {
  const ids = [...new Set(expenses.map((e) => e.employeeId))];
  if (ids.length === 0) return emptyState('No expenses in this period.', 'users');
  const rows = ids
    .map((id) => {
      const own = expenses.filter((e) => e.employeeId === id);
      const s = summarizeExpenses(own);
      return { id, name: findUser(db, id)?.name ?? 'Unknown', s };
    })
    .sort((a, b) => b.s.claimed.amount - a.s.claimed.amount);
  return `<div class="table-wrap"><table class="table table-stack">
      <caption class="sr-only">Spending per person in the selected period</caption>
      <thead><tr><th scope="col">Person</th><th scope="col" class="amount">Spending</th><th scope="col" class="amount">Claims</th>
        <th scope="col" class="amount">Average</th><th scope="col" class="amount">Pending</th><th scope="col" class="amount">Reimbursed</th>
        <th scope="col" class="amount">Rejected</th></tr></thead>
      <tbody>${rows.map(({ id, name, s }) => `<tr>
          <th scope="row" style="text-align:left">${escapeHtml(name)}${id === analyticsManager.id ? ' <span class="muted xsmall">(me)</span>' : ''}</th>
          <td data-label="Spending" class="amount">${formatMoney(s.claimed.amount)}</td>
          <td data-label="Claims" class="amount">${s.claimed.count}</td>
          <td data-label="Average" class="amount">${formatMoney(s.claimed.count ? Math.round(s.claimed.amount / s.claimed.count) : 0)}</td>
          <td data-label="Pending" class="amount">${formatMoney(s.pending.amount)}</td>
          <td data-label="Reimbursed" class="amount">${formatMoney(s.reimbursed.amount)}</td>
          <td data-label="Rejected" class="amount">${s.rejected.count}</td>
        </tr>`).join('')}</tbody>
    </table></div>`;
}

function renderAnalytics(user, db) {
  analyticsManager = user;
  const scoped = visibleExpenses(user, db);
  const toolbar = qs('#toolbar');

  if (!toolbar.dataset.ready) {
    toolbar.dataset.ready = 'true';
    const read = bindToolbar(toolbar, (values) => {
      analyticsFilters = values;
      redrawAnalytics?.();
    });
    analyticsFilters = read();
  }
  const people = [user, ...teamMembers(user, db, { includeInactive: true })];
  qs('#employeeId').innerHTML = optionsHtml([{ value: '', label: 'Everyone' }, ...people.map((p) => ({ value: p.id, label: p.id === user.id ? `${p.name} (me)` : p.name }))], qs('#employeeId').value);
  const projectIds = [...new Set([...visibleProjects(user, db).map((p) => p.id), ...scoped.map((e) => e.projectId ?? 'none')])];
  qs('#projectId').innerHTML = optionsHtml([{ value: '', label: 'All projects' }, ...projectIds.map((id) => ({ value: id, label: id === 'none' ? 'No project' : projectName(db, id) }))], qs('#projectId').value);
  const filters = { ...analyticsFilters, employeeId: qs('#employeeId').value, projectId: qs('#projectId').value };

  const months = lastMonthKeys(Number(filters.months) || 6);
  const expenses = filterByMonths(filterExpenses(scoped, db, filters), months);
  const summary = summarizeExpenses(expenses);
  const rate = approvalRate(expenses);
  const ids = new Set(expenses.map((e) => e.id));
  const reimbursements = reimbursementStats(visibleReimbursements(user, db).filter((r) => ids.has(r.expenseId)));

  qs('#period-label').textContent = `${formatMonth(months[0])} – ${formatMonth(months.at(-1))}`;
  qs('#stats').innerHTML = [
    statCard({ label: 'Spending', value: formatMoney(summary.claimed.amount), sub: countText(summary.claimed.count), iconName: 'receipt', accent: true }),
    statCard({ label: 'Average claim', value: formatMoney(summary.claimed.count ? Math.round(summary.claimed.amount / summary.claimed.count) : 0), iconName: 'chart' }),
    statCard({ label: 'Approval rate', value: rate === null ? '—' : `${rate}%`, sub: `${summary.approved.count} approved · ${summary.rejected.count} rejected`, iconName: 'check' }),
    statCard({ label: 'Pending review', value: formatMoney(summary.pending.amount), sub: countText(summary.pending.count), iconName: 'clock' }),
  ].join('');

  qs('#monthly-chart').innerHTML = columnChart(spendingByMonth(expenses, months), 'Team spending per month');
  qs('#category-chart').innerHTML = barList(spendingByCategory(expenses), { limit: 10 });
  qs('#project-chart').innerHTML = barList(spendingByProject(expenses, db), { limit: 10 });

  // Managers never see others' drafts, and their own expenses are never drafts, so drafts are not shown.
  qs('#status-chart').innerHTML = statusChart(breakdownByStatus(expenses).filter((row) => row.status !== STATUS.DRAFT), { empty: 'No expenses in this period.' });
  qs('#approved-line').innerHTML = `<strong>${summary.approved.count}</strong> claim${summary.approved.count === 1 ? '' : 's'} approved
    (${formatMoney(summary.approved.amount)}) — now Reimbursement Pending or Reimbursed.`;

  qs('#reimbursement-chart').innerHTML = splitChart([
    { status: STATUS.REIMBURSEMENT_PENDING, label: 'Reimbursement pending', ...reimbursements.pending },
    { status: STATUS.REIMBURSED, label: 'Reimbursed', ...reimbursements.reimbursed },
  ]);
  qs('#reimbursement-line').textContent = reimbursements.averageDays === null
    ? 'Nothing reimbursed in this period yet.'
    : `Average time from approval to payout: ${reimbursements.averageDays} day${reimbursements.averageDays === 1 ? '' : 's'}.`;

  qs('#employee-table').innerHTML = employeeTableHtml(expenses, db);
}

const redrawAnalytics = startPage({ roles: [ROLES.MANAGER], nav: 'analytics', title: 'Analytics' }, renderAnalytics);
