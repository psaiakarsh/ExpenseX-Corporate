// admin-users.js — account directory and team administration for the Admin.
// Shows names, emails, roles, teams, status and dates only — never expense amounts or records.
// Every action calls a users.js domain function that checks can() and the business rules itself
// (e.g. a manager with assigned employees cannot be deactivated).

let admin;
let userFilters = {};

const ROLE_ORDER = { admin: 0, manager: 1, user: 2 };

function managerOptions(db, { excludeId = null } = {}) {
  return db.users
    .filter((u) => u.role === ROLES.MANAGER && isActiveUser(u) && u.id !== excludeId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => ({ value: m.id, label: `${m.name}${m.department ? ` · ${m.department}` : ''}` }));
}

function teamCell(db, u) {
  if (u.role === ROLES.MANAGER) {
    const all = teamMembers(u, db, { includeInactive: true }).length;
    const active = teamMembers(u, db).length;
    return `${escapeHtml(u.department || '—')} · ${active} active${all > active ? ` + ${all - active} inactive` : ''}`;
  }
  if (u.role === ROLES.EMPLOYEE) {
    const manager = findUser(db, u.managerId);
    return manager ? escapeHtml(manager.name) : '<span class="badge badge-warning">Unassigned</span>';
  }
  return '<span class="muted">Administration</span>';
}

function userRow(u, db) {
  const active = isActiveUser(u);
  const actions = [];
  if (u.role === ROLES.EMPLOYEE) {
    actions.push(`<button class="btn btn-secondary btn-sm" type="button" data-assign="${u.id}">${u.managerId ? 'Reassign' : 'Assign'}<span class="sr-only"> ${escapeHtml(u.name)}</span></button>`);
  }
  if (u.id !== admin.id && u.role !== ROLES.ADMIN) {
    actions.push(active
      ? `<button class="btn btn-danger-ghost btn-sm" type="button" data-active="false" data-id="${u.id}">Deactivate<span class="sr-only"> ${escapeHtml(u.name)}</span></button>`
      : `<button class="btn btn-ghost btn-sm" type="button" data-active="true" data-id="${u.id}">Reactivate<span class="sr-only"> ${escapeHtml(u.name)}</span></button>`);
  }
  return `<tr>
      <th scope="row" style="text-align:left">
        <div class="row" style="flex-wrap:nowrap">${avatar(u.name, 'sm')}
          <div><div>${escapeHtml(u.name)}${u.id === admin.id ? ' <span class="muted xsmall">(you)</span>' : ''}</div><div class="muted xsmall">${escapeHtml(u.email)}</div></div>
        </div>
      </th>
      <td data-label="Role">${roleBadge(u.role)}</td>
      <td data-label="Manager / team">${teamCell(db, u)}</td>
      <td data-label="Status">${active ? '<span class="badge badge-approved">Active</span>' : '<span class="badge badge-muted">Inactive</span>'}</td>
      <td data-label="Created">${escapeHtml(formatDate(toLocalDate(new Date(u.createdAt))))}</td>
      <td class="actions-cell"><div class="row-actions" style="justify-content:flex-end">${actions.join('') || '<span class="muted xsmall">—</span>'}</div></td>
    </tr>`;
}

function matches(u, filters) {
  if (filters.role && u.role !== filters.role) return false;
  if (filters.status === 'active' && !isActiveUser(u)) return false;
  if (filters.status === 'inactive' && isActiveUser(u)) return false;
  if (filters.manager === 'unassigned' && !(u.role === ROLES.EMPLOYEE && !u.managerId)) return false;
  if (filters.manager && filters.manager !== 'unassigned' && !(u.managerId === filters.manager || u.id === filters.manager)) return false;
  const search = String(filters.search ?? '').trim().toLowerCase();
  return !search || `${u.name} ${u.email} ${u.department}`.toLowerCase().includes(search);
}

const USER_SORTS = {
  role: (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
};

function renderUsers(user, db) {
  admin = user;
  const toolbar = qs('#toolbar');
  const firstRender = !toolbar.dataset.ready;
  if (firstRender) {
    toolbar.dataset.ready = 'true';
    const read = bindToolbar(toolbar, (values) => {
      userFilters = values;
      redrawUsers?.();
    });
    userFilters = read();
  }
  const wantedManager = firstRender ? queryParam('manager') ?? '' : qs('#manager').value;
  qs('#manager').innerHTML = optionsHtml([
    { value: '', label: 'Any manager' },
    { value: 'unassigned', label: 'Unassigned employees' },
    ...db.users.filter((u) => u.role === ROLES.MANAGER).map((m) => ({ value: m.id, label: `${m.name}${isActiveUser(m) ? '' : ' (inactive)'}` })),
  ], wantedManager);
  const filters = { ...userFilters, manager: qs('#manager').value };

  const list = db.users.filter((u) => matches(u, filters)).sort(USER_SORTS[filters.sort] ?? USER_SORTS.role);
  qs('#count').textContent = `${list.length} of ${db.users.length} account${db.users.length === 1 ? '' : 's'}`;
  qs('#table').innerHTML = list.length
    ? `<div class="table-wrap"><table class="table table-stack">
        <caption class="sr-only">Accounts</caption>
        <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Manager / team</th><th scope="col">Status</th>
          <th scope="col">Created</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${list.map((u) => userRow(u, db)).join('')}</tbody>
      </table></div>`
    : emptyState('No accounts match these filters.', 'users');
}

const redrawUsers = startPage({ roles: [ROLES.ADMIN], nav: 'users', title: 'Users' }, renderUsers);

qs('#new-manager').addEventListener('click', async () => {
  await openFormDialog({
    title: 'New manager',
    description: '<p>Managers review and reimburse their team’s expenses. Share the temporary password with them; they can change it in Profile.</p>',
    fields: [
      { name: 'name', label: 'Full name', required: true, maxLength: 50, autocomplete: 'off' },
      { name: 'email', label: 'Work email', type: 'email', required: true, maxLength: 100, autocomplete: 'off' },
      { name: 'department', label: 'Department / team name', required: true, maxLength: 50, placeholder: 'e.g. Engineering' },
      { name: 'password', label: 'Temporary password', required: true, maxLength: 72, autocomplete: 'new-password', hint: 'At least 6 characters. Stored only as a salted hash.' },
    ],
    submitLabel: 'Create manager',
    onSubmit: async (values) => {
      const result = await createManagedAccount(admin, 'manager', values);
      if (result.ok) toast(`Manager ${result.user.name} created.`);
      return result;
    },
  });
  redrawUsers?.();
});

qs('#new-employee').addEventListener('click', async () => {
  await openFormDialog({
    title: 'New employee',
    fields: [
      { name: 'name', label: 'Full name', required: true, maxLength: 50, autocomplete: 'off' },
      { name: 'email', label: 'Work email', type: 'email', required: true, maxLength: 100, autocomplete: 'off' },
      { name: 'managerId', label: 'Manager', type: 'select', options: [{ value: '', label: 'No manager yet (drafts only)' }, ...managerOptions(loadDb())] },
      { name: 'password', label: 'Temporary password', required: true, maxLength: 72, autocomplete: 'new-password', hint: 'At least 6 characters. Stored only as a salted hash.' },
    ],
    submitLabel: 'Create employee',
    onSubmit: async (values) => {
      const result = await createManagedAccount(admin, 'employee', values);
      if (result.ok) toast(`Employee ${result.user.name} created.`);
      return result;
    },
  });
  redrawUsers?.();
});

qs('#table').addEventListener('click', async (event) => {
  const assign = event.target.closest('[data-assign]');
  const toggle = event.target.closest('[data-active]');
  const db = loadDb();

  if (assign) {
    const employee = findUser(db, assign.dataset.assign);
    const choices = managerOptions(db, { excludeId: employee.managerId });
    if (choices.length === 0) {
      toast('There is no other active manager. Create a manager first.', 'error');
      return;
    }
    // No per-employee expense details here (admin privacy): the dialog explains the rule, not the numbers.
    await openFormDialog({
      title: `${employee.managerId ? 'Reassign' : 'Assign'} ${employee.name}`,
      description: `<p>Any expenses still awaiting approval move to the new manager for review.</p>
        <p>Approval history is never rewritten. From now on the new manager reviews and reimburses this employee’s claims.</p>`,
      fields: [{ name: 'managerId', label: 'New manager', type: 'select', required: true, options: choices }],
      submitLabel: employee.managerId ? 'Reassign' : 'Assign',
      onSubmit: ({ managerId }) => {
        const result = assignEmployee(admin, employee.id, managerId);
        if (result.ok) toast(`${employee.name} assigned. The new manager has been notified.`);
        return result;
      },
    });
    redrawUsers?.();
  }

  if (toggle) {
    const target = findUser(db, toggle.dataset.id);
    const activate = toggle.dataset.active === 'true';
    const confirmed = await confirmAction({
      title: `${activate ? 'Reactivate' : 'Deactivate'} ${target.name}?`,
      message: activate
        ? 'They will be able to log in again.'
        : 'They will be signed out and unable to log in or act. Their records and history are kept.',
      confirmLabel: activate ? 'Reactivate' : 'Deactivate',
      danger: !activate,
    });
    if (confirmed) runAction(() => setUserActive(admin, target.id, activate), `${target.name} ${activate ? 'reactivated' : 'deactivated'}.`);
    redrawUsers?.();
  }
});
