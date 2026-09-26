// manager-dashboard.js — the manager's own team only.
// Data scope: visibleExpenses(manager) = the manager's own expenses + SUBMITTED expenses of employees
// currently in their team; teamMembers(manager) = their current employees. Every number below is
// calculated from those stored records (analytics.js / limits.js) — nothing company-wide.

let dashboardManager;

function limitWarningsHtml(team, db) {
  if (team.length === 0) return emptyState('No employees in your team yet.', 'users');
  const rows = team.map((member) => ({ member, status: limitStatus(member, db.expenses, db.settings) }));
  const flagged = rows
    .filter(({ status }) => status.level === 'warning' || status.level === 'exceeded')
    .sort((a, b) => b.status.percent - a.status.percent);
  const noLimit = rows.filter(({ status }) => status.level === 'none').length;
  const footer = `<p class="muted xsmall" style="margin-top:12px">Warning at ${db.settings.limitWarningPercent}% · exceeded at 100%.
    Limits only warn; employees can still submit.${noLimit ? ` ${noLimit} employee${noLimit === 1 ? ' has' : 's have'} no limit set.` : ''}</p>`;
  if (flagged.length === 0) {
    return `${emptyState('Everyone is within their monthly limit.', 'check')}${footer}`;
  }
  return `<div class="stack">${flagged.map(({ member, status }) => `<div>
      <div class="row" style="margin-bottom:6px">${limitBadge(status.level)}</div>
      ${limitMeter(status, member.name)}
    </div>`).join('')}</div>${footer}`;
}

function employeeSummaryHtml(team, expenses, db) {
  if (team.length === 0) return emptyState('No employees in your team yet.', 'users');
  const rows = team.map((member) => {
    const own = expenses.filter((e) => e.employeeId === member.id);
    const claimed = onlySpending(own);
    const status = limitStatus(member, db.expenses, db.settings);
    const pending = own.filter((e) => e.status === STATUS.PENDING).length;
    return `<tr>
        <th scope="row" style="text-align:left"><a href="expenses.html?employee=${encodeURIComponent(member.id)}">${escapeHtml(member.name)}</a></th>
        <td data-label="Total claimed" class="amount">${formatMoney(sumAmounts(claimed))}</td>
        <td data-label="This month" class="amount">${formatMoney(status.used)}${status.limit ? `<div class="muted xsmall">of ${formatMoney(status.limit)}</div>` : '<div class="muted xsmall">no limit</div>'}</td>
        <td data-label="Limit">${limitBadge(status.level) || '<span class="muted xsmall">—</span>'}</td>
        <td data-label="Pending" class="amount">${pending}</td>
      </tr>`;
  });
  return `<div class="table-wrap"><table class="table table-stack">
      <caption class="sr-only">Spending per employee in your team</caption>
      <thead><tr><th scope="col">Employee</th><th scope="col" class="amount">Total claimed</th><th scope="col" class="amount">This month</th><th scope="col">Limit</th><th scope="col" class="amount">Pending</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
}

function renderManagerDashboard(user, db) {
  dashboardManager = user;
  const expenses = visibleExpenses(user, db); // own + current team's submitted expenses
  const team = teamMembers(user, db); // active employees currently assigned
  const summary = summarizeExpenses(expenses);
  const month = currentMonthKey();
  const thisMonth = onlySpending(expenses).filter((e) => monthKey(e.date) === month);
  const queue = expenses.filter((e) => can(user, 'expense.review', e, db));
  const limitAlerts = team.filter((m) => ['warning', 'exceeded'].includes(limitStatus(m, db.expenses, db.settings).level)).length;

  qs('#greeting').textContent = `Welcome, ${user.name.split(' ')[0]}`;
  qs('#team-line').textContent = `${user.department || 'Your team'} · ${db.settings.companyName}`;

  qs('#team-stats').innerHTML = [
    statCard({ label: 'Team size', value: String(team.length), sub: 'active employees', iconName: 'users', accent: true }),
    statCard({ label: 'Team spending', value: formatMoney(summary.claimed.amount), sub: `${countText(summary.claimed.count)} · all time`, iconName: 'receipt' }),
    statCard({ label: 'This month', value: formatMoney(sumAmounts(thisMonth)), sub: `${countText(thisMonth.length)} · ${formatMonth(month)}`, iconName: 'clock' }),
    statCard({ label: 'Pending approvals', value: String(queue.length), sub: formatMoney(sumAmounts(queue)), iconName: 'inbox' }),
  ].join('');
  qs('#money-stats').innerHTML = [
    statCard({ label: 'Approved', value: formatMoney(summary.approved.amount), sub: `${countText(summary.approved.count)} (incl. reimbursement stages)`, iconName: 'check' }),
    statCard({ label: 'Reimbursement pending', value: formatMoney(summary.reimbursementPending.amount), sub: countText(summary.reimbursementPending.count), iconName: 'banknote' }),
    statCard({ label: 'Reimbursed', value: formatMoney(summary.reimbursed.amount), sub: countText(summary.reimbursed.count), iconName: 'check' }),
    statCard({ label: 'Limit alerts', value: String(limitAlerts), sub: `employee${limitAlerts === 1 ? '' : 's'} at ≥ ${db.settings.limitWarningPercent}%`, iconName: 'alert' }),
  ].join('');

  // Oldest first: the claims that have waited longest are reviewed first.
  const pending = [...queue].sort(SORTS.oldest).slice(0, 5);
  qs('#pending').innerHTML = pending.length
    ? `<ul class="list">${pending.map((e) => expenseRow(e, db, { showEmployee: true, flag: reviewFlags(e, db), actions: reviewButtons(e) })).join('')}</ul>
       ${queue.length > pending.length ? `<p class="muted xsmall" style="margin-top:12px">+ ${queue.length - pending.length} more in the <a href="approvals.html">approval queue</a></p>` : ''}`
    : emptyState('Nothing waiting for your approval.', 'inbox');

  qs('#limits-month').textContent = formatMonth(month);
  qs('#limits').innerHTML = limitWarningsHtml(team, db);

  const recent = expenses.filter((e) => e.employeeId !== user.id).sort(SORTS.updated).slice(0, 6);
  qs('#recent').innerHTML = expenseList(recent, db, { showEmployee: true, showUpdated: true }, 'No team expenses yet.');

  qs('#status-chart').innerHTML = statusChart(breakdownByStatus(expenses).filter((row) => row.status !== STATUS.DRAFT), { empty: 'No submitted expenses yet.' });
  qs('#monthly-chart').innerHTML = columnChart(spendingByMonth(expenses, lastMonthKeys(6)), 'Team spending per month');
  qs('#category-chart').innerHTML = barList(spendingByCategory(expenses));
  qs('#project-chart').innerHTML = barList(spendingByProject(expenses, db));
  qs('#employee-summary').innerHTML = employeeSummaryHtml(team, expenses, db);

  qs('#activity').innerHTML = recentEvents(expenses, db);
  const unread = unreadCount(user, db);
  qs('#unread-count').textContent = unread ? `${unread} unread` : 'All read';
  qs('#unread-count').className = unread ? 'badge badge-approved' : 'badge badge-muted';
  qs('#notifications').innerHTML = notificationPreview(user, db);
}

const redrawDashboard = startPage({ roles: [ROLES.MANAGER], nav: 'dashboard', title: 'Dashboard' }, renderManagerDashboard);

// Approve / Reject buttons open the shared dialogs, which call approveExpense() / rejectExpense().
bindReviewButtons(qs('#pending'), () => dashboardManager, () => redrawDashboard?.());
