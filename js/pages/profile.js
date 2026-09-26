// profile.js — view account details, change display name and password.
// The account ID, email and role are shown read-only: they never change here.

let profileUser;

function renderProfile(user, db) {
  profileUser = user;
  qs('#role-badge').innerHTML = roleBadge(user.role);
  qs('#account-details').innerHTML = `
    <div><dt>Name</dt><dd>${escapeHtml(user.name)}</dd></div>
    <div><dt>Email</dt><dd>${escapeHtml(user.email)}</dd></div>
    <div><dt>Role</dt><dd>${escapeHtml(ROLE_LABELS[user.role])}</dd></div>
    <div><dt>Account status</dt><dd>${isActiveUser(user) ? '<span class="badge badge-approved">Active</span>' : '<span class="badge badge-muted">Inactive</span>'}</dd></div>
    <div><dt>Company</dt><dd>${escapeHtml(db.settings.companyName)}</dd></div>
    <div><dt>Member since</dt><dd>${escapeHtml(formatDateTime(user.createdAt))}</dd></div>
    <div style="grid-column:1/-1"><dt>Account ID (never changes)</dt><dd><code class="xsmall">${escapeHtml(user.id)}</code></dd></div>`;

  const nameInput = qs('#name');
  if (document.activeElement !== nameInput) nameInput.value = user.name;

  const work = qs('#work-details');
  if (user.role === ROLES.EMPLOYEE) {
    const manager = findUser(db, user.managerId);
    work.innerHTML = `<div class="stack">
        <p>${manager ? `Manager: <strong>${escapeHtml(manager.name)}</strong>${manager.department ? ` · ${escapeHtml(manager.department)}` : ''}` : '<span class="text-warning">No manager assigned yet.</span>'}</p>
        ${limitMeter(limitStatus(user, db.expenses, db.settings), 'This month')}
      </div>`;
  } else if (user.role === ROLES.MANAGER) {
    const team = teamMembers(user, db);
    work.innerHTML = `<p>${escapeHtml(user.department || 'Manager')} · <strong>${team.length}</strong> active employee${team.length === 1 ? '' : 's'} ·
      <strong>${visibleProjects(user, db).filter((p) => p.status === 'active').length}</strong> active projects</p>`;
  } else {
    work.innerHTML = '<p class="muted small">Administrators manage accounts, teams and system settings. For privacy, individual expense records are not visible to this role.</p>';
  }
}

startPage({ roles: [ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ADMIN], nav: 'profile', title: 'Profile' }, renderProfile);

qs('#logout-button').innerHTML = `${icon('logout', 18)} Log out`;
qs('#logout-button').addEventListener('click', doLogout);

qs('#name-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  clearFieldErrors(form);
  const result = updateProfileName(profileUser, form.elements.name.value);
  if (!result.ok) {
    showFieldErrors(form, result.errors ?? {}, result.error ?? '');
    return;
  }
  setFlash('Name updated.', 'success');
  location.reload(); // refreshes the sidebar name as well
});

qs('#password-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  clearFieldErrors(form);
  const button = qs('button[type="submit"]', form);
  setBusy(button, true, 'Saving…');
  try {
    const result = await changePassword(profileUser, formValues(form));
    if (!result.ok) {
      showFieldErrors(form, result.errors ?? {}, result.error ?? '');
      return;
    }
    form.reset();
    toast('Password changed.');
  } catch (error) {
    showFieldErrors(form, {}, error.message);
  } finally {
    setBusy(button, false);
  }
});
