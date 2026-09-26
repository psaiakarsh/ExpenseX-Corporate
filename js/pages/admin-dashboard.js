// admin-dashboard.js — company statistics from companyAggregates(), which returns NUMBERS only
// (counts and totals). This page never receives expense records, so no individual claim, employee
// spending or reimbursement detail can be shown here. Team totals are privacy-safe (see analytics.js).

const PROTECTED_REASONS = {
  small: `fewer than ${MIN_TEAM_SIZE_FOR_BREAKDOWN} employees`,
  complement: 'hidden so a smaller team’s total can’t be worked out by subtraction',
};

function teamsHtml(stats) {
  const shown = stats.teams.length
    ? barList(stats.teams.map((t) => ({ ...t, label: `${t.label} (${t.employees} employees)` })), { showCount: true, showShare: false })
    : emptyState('No team is large enough to show separately yet.', 'shield');
  const hidden = stats.protectedTeams.length
    ? `<ul class="stack" style="margin-top:16px">${stats.protectedTeams.map((team) => `<li class="row">
        <span class="badge badge-muted">${icon('shield', 14)}Privacy-protected</span>
        <span class="small">${escapeHtml(team.label)}</span>
        <span class="muted xsmall">${escapeHtml(PROTECTED_REASONS[team.reason])}</span>
      </li>`).join('')}</ul>
      <p class="muted xsmall" style="margin-top:12px">Protected teams are still included in the company totals above.</p>`
    : '';
  return shown + hidden;
}

function recentActivityHtml(db) {
  const entries = db.activity.slice(0, 6);
  if (entries.length === 0) return emptyState('No activity recorded yet.', 'activity');
  return `<ul class="list">${entries.map((entry) => `<li class="list-row compact">
      <span class="row-icon" aria-hidden="true">${icon('activity', 16)}</span>
      <div class="list-row-main">
        <span class="small"><strong>${escapeHtml(ACTIVITY_LABELS[entry.action] ?? entry.action)}</strong></span>
        <span class="muted xsmall">${escapeHtml(entry.summary)} · ${escapeHtml(formatRelative(entry.createdAt))}</span>
      </div>
    </li>`).join('')}</ul>`;
}

startPage({ roles: [ROLES.ADMIN], nav: 'dashboard', title: 'Dashboard' }, (user, db) => {
  const stats = companyAggregates(user, db); // numbers only
  const s = stats.summary;
  qs('#company').textContent = db.settings.companyName;

  qs('#attention').innerHTML = stats.users.unassigned
    ? `<div class="callout callout-warning">${icon('users')}<div><strong>${stats.users.unassigned} employee${stats.users.unassigned === 1 ? '' : 's'} waiting for a manager</strong>
        They can only save drafts until assigned. <a href="users.html?manager=unassigned">Assign now</a></div></div>`
    : '';

  qs('#people-stats').innerHTML = [
    statCard({ label: 'Employees', value: String(stats.users.employees), sub: `${stats.users.unassigned} unassigned`, iconName: 'users', accent: true }),
    statCard({ label: 'Managers', value: String(stats.users.managers), sub: `${stats.projects} active projects`, iconName: 'shield' }),
    statCard({ label: 'Active users', value: String(stats.users.active), sub: 'all roles', iconName: 'user' }),
    statCard({ label: 'Inactive accounts', value: String(stats.users.inactive), sub: 'records kept', iconName: 'x' }),
  ].join('');

  qs('#money-stats').innerHTML = [
    statCard({ label: 'Total expenses', value: String(stats.submittedCount), sub: 'submitted claims', iconName: 'receipt', accent: true }),
    statCard({ label: 'Company spending', value: formatMoney(s.claimed.amount), sub: 'pending + approved + reimbursed', iconName: 'chart' }),
    statCard({ label: 'Pending', value: formatMoney(s.pending.amount), sub: countText(s.pending.count), iconName: 'clock' }),
    statCard({ label: 'Reimbursement pending', value: formatMoney(s.reimbursementPending.amount), sub: countText(s.reimbursementPending.count), iconName: 'banknote' }),
    statCard({ label: 'Reimbursed', value: formatMoney(s.reimbursed.amount), sub: countText(s.reimbursed.count), iconName: 'check' }),
  ].join('');

  qs('#monthly-chart').innerHTML = columnChart(stats.byMonth, 'Company spending per month');
  qs('#status-chart').innerHTML = statusChart(stats.byStatus, { empty: 'No submitted expenses yet.' });
  qs('#approval-line').innerHTML = `Approval rate: <strong>${stats.approvalRate === null ? '—' : `${stats.approvalRate}%`}</strong>
    · ${s.approved.count} approved (now reimbursement pending or reimbursed) · ${s.rejected.count} rejected`;
  qs('#category-chart').innerHTML = barList(stats.byCategory, { limit: 10 });
  qs('#teams-chart').innerHTML = teamsHtml(stats);
  qs('#activity').innerHTML = recentActivityHtml(db);

  qs('#privacy-rules').innerHTML = [
    'Company-wide counts and totals, by month, category and status.',
    `Team totals only for teams with at least ${MIN_TEAM_SIZE_FOR_BREAKDOWN} employees, and never when a hidden team could be worked out by subtraction.`,
    'No individual expense, receipt, reimbursement or employee spending — those stay with the employee and their manager.',
    'Admins manage people, teams and settings; they cannot approve or reimburse expenses.',
  ].map((rule) => `<li class="row" style="flex-wrap:nowrap;align-items:flex-start">${icon('shield', 16)}<span>${escapeHtml(rule)}</span></li>`).join('');
});
