// manager-projects.js — this manager's own projects (visibleProjects). Create / edit / activate /
// deactivate call createProject(), updateProject(), setProjectStatus(), which refuse any project
// owned by another manager. Spending figures use only expenses in this manager's scope.
// Stored status values: 'active' | 'archived' (shown as Active / Inactive).

let projectOwner;
let projectFilter = 'all';

function projectStats(project, spending, scoped) {
  const claims = spending.filter((e) => e.projectId === project.id);
  return {
    claims,
    total: sumAmounts(claims),
    pending: scoped.filter((e) => e.projectId === project.id && e.status === STATUS.PENDING).length,
    people: new Set(claims.map((e) => e.employeeId)).size,
  };
}

function renderProjects(user, db) {
  projectOwner = user;
  const projects = visibleProjects(user, db);
  const scoped = visibleExpenses(user, db);
  const spending = onlySpending(scoped);
  qsa('[data-filter]').forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.filter === projectFilter)));

  const active = projects.filter((p) => p.status === 'active');
  const tagged = spending.filter((e) => projects.some((p) => p.id === e.projectId));
  qs('#stats').innerHTML = [
    statCard({ label: 'Active projects', value: String(active.length), sub: `${projects.length - active.length} inactive`, iconName: 'folder', accent: true }),
    statCard({ label: 'Spending on projects', value: formatMoney(sumAmounts(tagged)), sub: countText(tagged.length), iconName: 'receipt' }),
    statCard({ label: 'Without a project', value: formatMoney(sumAmounts(spending.filter((e) => !e.projectId))), iconName: 'info' }),
    statCard({ label: 'Pending on projects', value: String(scoped.filter((e) => e.projectId && e.status === STATUS.PENDING).length), sub: 'claims awaiting review', iconName: 'clock' }),
  ].join('');

  const shown = projects
    .filter((p) => projectFilter === 'all' || p.status === projectFilter)
    .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'active' ? -1 : 1));

  if (shown.length === 0) {
    qs('#projects').innerHTML = `<li>${emptyState(projects.length ? 'No projects in this view.' : 'No projects yet. Create one so your team can tag expenses.', 'folder')}</li>`;
    return;
  }

  qs('#projects').innerHTML = shown.map((project) => {
    const stats = projectStats(project, spending, scoped);
    const inactive = project.status === 'archived';
    return `<li class="list-row">
        <span class="row-icon" aria-hidden="true">${icon('folder')}</span>
        <div class="list-row-main">
          <span class="list-row-title">${escapeHtml(project.name)}
            ${inactive ? '<span class="badge badge-muted">Inactive</span>' : '<span class="badge badge-approved">Active</span>'}</span>
          <span class="list-row-meta"><span>${escapeHtml(project.description || 'No description')}</span>
            <span>Created ${escapeHtml(formatDate(toLocalDate(new Date(project.createdAt))))}</span>
            <span>${stats.people} ${stats.people === 1 ? 'person' : 'people'}</span>${stats.pending ? `<span>${stats.pending} pending</span>` : ''}</span>
        </div>
        <div class="list-row-side">
          <span class="list-row-amount">${formatMoney(stats.total)}</span>
          <span class="muted xsmall">${countText(stats.claims.length)}</span>
          <button class="btn btn-ghost btn-sm" type="button" data-details="${project.id}">Details<span class="sr-only"> ${escapeHtml(project.name)}</span></button>
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${project.id}">${icon('edit', 16)} Edit<span class="sr-only"> ${escapeHtml(project.name)}</span></button>
          <button class="btn ${inactive ? 'btn-secondary' : 'btn-ghost'} btn-sm" type="button" data-status="${inactive ? 'active' : 'archived'}" data-id="${project.id}">${inactive ? 'Activate' : 'Deactivate'}<span class="sr-only"> ${escapeHtml(project.name)}</span></button>
        </div>
      </li>`;
  }).join('');
}

function projectDialog(project = null) {
  return openFormDialog({
    title: project ? 'Edit project' : 'New project',
    description: project ? '' : '<p>The project belongs to your team. Only you can edit or deactivate it.</p>',
    fields: [
      { name: 'name', label: 'Project name', required: true, maxLength: 50, value: project?.name ?? '' },
      { name: 'description', label: 'Description', type: 'textarea', maxLength: 200, value: project?.description ?? '' },
    ],
    submitLabel: project ? 'Save project' : 'Create project',
    onSubmit: (values) => {
      const result = project ? updateProject(projectOwner, project.id, values) : createProject(projectOwner, values);
      if (result.ok) toast(project ? 'Project updated.' : 'Project created.');
      return result;
    },
  });
}

function projectDetailsDialog(project, db) {
  const scoped = visibleExpenses(projectOwner, db);
  const stats = projectStats(project, onlySpending(scoped), scoped);
  const byPerson = groupSpending(stats.claims, (e) => e.employeeId, (id) => findUser(db, id)?.name ?? 'Unknown');
  const byStatus = breakdownByStatus(scoped.filter((e) => e.projectId === project.id)).filter((r) => r.count > 0 && r.status !== STATUS.DRAFT);
  return openFormDialog({
    title: project.name,
    description: `
      <dl class="details">
        <div><dt>Status</dt><dd>${project.status === 'archived' ? 'Inactive' : 'Active'}</dd></div>
        <div><dt>Created</dt><dd>${escapeHtml(formatDateTime(project.createdAt))}</dd></div>
        <div><dt>Owner</dt><dd>${escapeHtml(projectOwner.name)}${projectOwner.department ? ` · ${escapeHtml(projectOwner.department)}` : ''}</dd></div>
        <div><dt>Total spending</dt><dd class="num">${formatMoney(stats.total)} · ${countText(stats.claims.length)}</dd></div>
        <div style="grid-column:1/-1"><dt>Description</dt><dd>${escapeHtml(project.description || 'No description')}</dd></div>
        <div style="grid-column:1/-1"><dt>Project ID</dt><dd><code class="xsmall">${escapeHtml(project.id)}</code></dd></div>
      </dl>
      <h3 class="small" style="margin-top:8px">Spending by person</h3>
      ${barList(byPerson, { empty: 'No spending on this project yet.' })}
      <h3 class="small" style="margin-top:8px">Claims by status</h3>
      ${byStatus.length ? statusChart(byStatus) : '<p class="muted small">No submitted claims.</p>'}`,
    submitLabel: 'Close',
    onSubmit: () => ({ ok: true }),
  });
}

const redrawProjects = startPage({ roles: [ROLES.MANAGER], nav: 'projects', title: 'Projects' }, renderProjects);

qsa('[data-filter]').forEach((tab) => tab.addEventListener('click', () => {
  projectFilter = tab.dataset.filter;
  redrawProjects?.();
}));

qs('#new-project').addEventListener('click', async () => {
  await projectDialog();
  redrawProjects?.();
});

qs('#projects').addEventListener('click', async (event) => {
  const db = loadDb();
  const findOwn = (id) => visibleProjects(projectOwner, db).find((p) => p.id === id);
  const details = event.target.closest('[data-details]');
  const edit = event.target.closest('[data-edit]');
  const status = event.target.closest('[data-status]');
  const targetId = details?.dataset.details ?? edit?.dataset.edit ?? status?.dataset.id;
  if (targetId && !findOwn(targetId)) {
    toast('That project is not one of yours.', 'error');
    return;
  }
  if (details) {
    await projectDetailsDialog(findOwn(details.dataset.details), db);
    return;
  }
  if (edit) {
    await projectDialog(findOwn(edit.dataset.edit));
  } else if (status) {
    const deactivating = status.dataset.status === 'archived';
    if (deactivating && !(await confirmAction({
      title: 'Deactivate project?',
      message: 'Existing expenses keep this project. Employees won’t be able to choose it for new expenses until you activate it again.',
      confirmLabel: 'Deactivate',
    }))) return;
    runAction(() => setProjectStatus(projectOwner, status.dataset.id, status.dataset.status), deactivating ? 'Project deactivated.' : 'Project activated.');
  }
  redrawProjects?.();
});
