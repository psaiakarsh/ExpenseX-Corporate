// manager-team.js — employees CURRENTLY assigned to this manager (teamMembers), with monthly limits.
// A manager can set limits (setMonthlyLimit) and add employees to their OWN team (createManagedAccount
// forces managerId = this manager). Reassigning, deactivating and role changes are Admin-only and
// are not offered here; the domain functions refuse them for managers anyway.

let teamLead;

function memberRow(member, db, visible) {
  const status = limitStatus(member, db.expenses, db.settings); // current month, from stored expenses
  const claims = visible.filter((e) => e.employeeId === member.id);
  const pending = claims.filter((e) => e.status === STATUS.PENDING).length;
  const active = isActiveUser(member);
  const usage = status.limit === null
    ? '<span class="badge badge-muted">No limit</span>'
    : `${limitBadge(status.level) || `<span class="badge badge-approved">${icon('check', 14)}Within limit</span>`} <span class="num small">${status.percent}%</span>`;
  return `<tr>
      <th scope="row">
        <div class="row" style="flex-wrap:nowrap">${avatar(member.name, 'sm')}
          <div style="text-align:left"><div>${escapeHtml(member.name)}</div><div class="muted xsmall">${escapeHtml(member.email)}</div></div>
        </div>
      </th>
      <td data-label="Status">${active ? '<span class="badge badge-approved">Active</span>' : '<span class="badge badge-muted">Inactive</span>'}</td>
      <td data-label="Monthly limit" class="amount">${status.limit === null ? '—' : formatMoney(status.limit)}</td>
      <td data-label="This month" class="amount">${formatMoney(status.used)}</td>
      <td data-label="Usage">${usage}</td>
      <td data-label="Expenses" class="amount">${claims.length}${pending ? ` <span class="muted xsmall">(${pending} pending)</span>` : ''}</td>
      <td class="actions-cell"><div class="row-actions" style="justify-content:flex-end">
        <button class="btn btn-secondary btn-sm" type="button" data-limit="${member.id}">Set limit<span class="sr-only"> for ${escapeHtml(member.name)}</span></button>
        <a class="btn btn-ghost btn-sm" href="expenses.html?employee=${encodeURIComponent(member.id)}">Expenses<span class="sr-only"> of ${escapeHtml(member.name)}</span></a>
      </div></td>
    </tr>`;
}

function renderTeam(user, db) {
  teamLead = user;
  const members = teamMembers(user, db, { includeInactive: true }).sort((a, b) => a.name.localeCompare(b.name));
  const active = members.filter(isActiveUser);
  const visible = visibleExpenses(user, db); // this manager's scope only
  const statuses = active.map((m) => limitStatus(m, db.expenses, db.settings));
  const flagged = statuses.filter((s) => s.level === 'warning' || s.level === 'exceeded').length;

  qs('#summary').textContent = `${active.length} active employee${active.length === 1 ? '' : 's'} in ${user.department || 'your team'}${members.length > active.length ? ` · ${members.length - active.length} inactive` : ''}.`;
  qs('#stats').innerHTML = [
    statCard({ label: 'Team size', value: String(active.length), sub: 'active employees', iconName: 'users', accent: true }),
    statCard({ label: 'Spent this month', value: formatMoney(statuses.reduce((sum, s) => sum + s.used, 0)), sub: formatMonth(currentMonthKey()), iconName: 'receipt' }),
    statCard({ label: 'Total monthly limits', value: formatMoney(statuses.reduce((sum, s) => sum + (s.limit ?? 0), 0)), sub: `${statuses.filter((s) => s.limit === null).length} without a limit`, iconName: 'banknote' }),
    statCard({ label: 'Limit alerts', value: String(flagged), sub: `at ≥ ${db.settings.limitWarningPercent}% (warn only)`, iconName: 'alert' }),
  ].join('');

  qs('#team').innerHTML = members.length
    ? `<div class="table-wrap"><table class="table table-stack">
        <caption class="sr-only">Employees in your team with monthly limit usage</caption>
        <thead><tr><th scope="col">Employee</th><th scope="col">Status</th><th scope="col" class="amount">Monthly limit</th>
          <th scope="col" class="amount">This month</th><th scope="col">Usage</th><th scope="col" class="amount">Expenses</th>
          <th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${members.map((m) => memberRow(m, db, visible)).join('')}</tbody>
      </table></div>`
    : emptyState('No employees yet. Add one, or ask an Admin to assign employees to you.', 'users');
}

const redrawTeam = startPage({ roles: [ROLES.MANAGER], nav: 'team', title: 'Team' }, renderTeam);
qsa('[data-icon]').forEach((slot) => (slot.innerHTML = icon(slot.dataset.icon)));

qs('#team').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-limit]');
  if (!button) return;
  const member = findUser(loadDb(), button.dataset.limit);
  await openFormDialog({
    title: `Monthly limit · ${member.name}`,
    description: '<p>Leave empty for no limit. Usage counts this month’s pending, approved, reimbursement-pending and reimbursed claims. Limits only warn.</p>',
    fields: [{
      name: 'limit',
      label: 'Monthly limit (₹)',
      value: member.monthlyLimit ? toAmountInput(member.monthlyLimit) : '',
      inputmode: 'decimal',
      placeholder: 'e.g. 20000',
      autocomplete: 'off',
    }],
    submitLabel: 'Save limit',
    onSubmit: ({ limit }) => {
      const result = setMonthlyLimit(teamLead, member.id, limit); // refuses employees outside this team
      if (result.ok) toast(`Limit for ${member.name} saved.`);
      return result;
    },
  });
  redrawTeam?.();
});

qs('#add-employee').addEventListener('click', async () => {
  await openFormDialog({
    title: 'Add employee to your team',
    description: '<p>Creates an <strong>Employee</strong> account in your team. Share the temporary password; they can change it in Profile.</p>',
    fields: [
      { name: 'name', label: 'Full name', required: true, maxLength: 50, autocomplete: 'off' },
      { name: 'email', label: 'Work email', type: 'email', required: true, maxLength: 100, autocomplete: 'off' },
      { name: 'password', label: 'Temporary password', required: true, maxLength: 72, autocomplete: 'new-password', hint: 'At least 6 characters.' },
    ],
    submitLabel: 'Add employee',
    onSubmit: async (values) => {
      const result = await createManagedAccount(teamLead, 'employee', values); // role + team decided by the domain
      if (result.ok) toast(`${result.user.name} added to your team.`);
      return result;
    },
  });
  redrawTeam?.();
});
