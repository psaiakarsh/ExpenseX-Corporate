// employee-dashboard.js — the logged-in employee's own figures only.
// All data comes from visibleExpenses(user) (own claims) and notificationsFor(user) (own alerts);
// every number is calculated from stored records by analytics.js / limits.js.

function limitCardHtml(user, manager, db) {
  const status = limitStatus(user, db.expenses, db.settings);
  const spentLine = `<p class="muted small">Spent in ${escapeHtml(formatMonth(status.month))}: <strong class="num">${formatMoney(status.used)}</strong></p>`;

  if (!manager) {
    return `<div class="stack">
        <p><span class="badge badge-muted">No limit assigned</span></p>
        <p class="muted small">Monthly limits are set by your manager. You will get one after an Admin assigns you to a manager.</p>
        ${spentLine}
      </div>`;
  }
  if (status.limit === null) {
    return `<div class="stack">
        <p><span class="badge badge-muted">No limit assigned</span></p>
        <p class="muted small">${escapeHtml(manager.name)} has not set a monthly limit for you.</p>
        ${spentLine}
      </div>`;
  }

  const levelText = {
    ok: `${status.percent}% used`,
    warning: `${status.percent}% used — approaching your limit (warning at ${db.settings.limitWarningPercent}%)`,
    exceeded: `${status.percent}% used — limit exceeded`,
  }[status.level];
  return `<div class="stack">
      <p class="row">${limitBadge(status.level) || `<span class="badge badge-approved">${icon('check', 14)}Within limit</span>`}
        <span class="small">${escapeHtml(levelText)}</span></p>
      ${limitMeter(status, formatMonth(status.month))}
      <p class="muted xsmall">Counts this month's pending, approved, reimbursement-pending and reimbursed claims.
        Limits only warn — you can still submit expenses over the limit.</p>
    </div>`;
}

startPage({ roles: [ROLES.EMPLOYEE], nav: 'dashboard', title: 'Dashboard' }, (user, db) => {
  const expenses = visibleExpenses(user, db); // own expenses only
  const manager = findUser(db, user.managerId);
  const summary = summarizeExpenses(expenses);

  qs('#greeting').textContent = `Welcome, ${user.name.split(' ')[0]}`;
  qs('#team-line').textContent = manager
    ? `${db.settings.companyName} · Manager: ${manager.name}${manager.department ? ` (${manager.department})` : ''}`
    : db.settings.companyName;

  const banner = qs('#assignment-banner');
  banner.hidden = Boolean(manager);
  banner.innerHTML = `${icon('alert')}<div><strong>No manager assigned yet</strong>
    You can create drafts, but you cannot submit an expense until an Admin assigns you to a Manager.</div>`;

  qs('#stats').innerHTML = [
    statCard({ label: 'Total expenses', value: formatMoney(summary.claimed.amount), sub: `${countText(summary.claimed.count)} submitted`, iconName: 'receipt', accent: true }),
    statCard({ label: 'Pending', value: formatMoney(summary.pending.amount), sub: countText(summary.pending.count), iconName: 'clock' }),
    statCard({ label: 'Approved', value: formatMoney(summary.approved.amount), sub: `${countText(summary.approved.count)} (incl. reimbursed)`, iconName: 'check' }),
    statCard({ label: 'Reimbursement pending', value: formatMoney(summary.reimbursementPending.amount), sub: countText(summary.reimbursementPending.count), iconName: 'banknote' }),
    statCard({ label: 'Reimbursed', value: formatMoney(summary.reimbursed.amount), sub: countText(summary.reimbursed.count), iconName: 'check' }),
  ].join('');

  qs('#limit').innerHTML = limitCardHtml(user, manager, db);
  qs('#status-chart').innerHTML = statusChart(breakdownByStatus(expenses), { empty: 'You have no expenses yet.' });
  qs('#monthly-chart').innerHTML = columnChart(spendingByMonth(expenses, lastMonthKeys(6)), 'Your spending per month');
  qs('#category-chart').innerHTML = barList(spendingByCategory(expenses));

  const recent = [...expenses].sort(SORTS.updated).slice(0, 5);
  qs('#recent').innerHTML = expenseList(recent, db, {}, 'No expenses yet. Create your first one.');

  const unread = unreadCount(user, db);
  qs('#unread-count').textContent = unread ? `${unread} unread` : 'All read';
  qs('#unread-count').className = unread ? 'badge badge-approved' : 'badge badge-muted';
  qs('#notifications').innerHTML = notificationPreview(user, db);
});
