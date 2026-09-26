// notifications.js (page) — the logged-in user's own notifications only.

let reader;
let showUnreadOnly = false;

const NOTIFICATION_ICONS = {
  expense_submitted: 'inbox',
  expense_resubmitted: 'refresh',
  expense_approved: 'check',
  expense_rejected: 'x',
  expense_reimbursed: 'banknote',
  expense_created_for_you: 'receipt',
  pending_digest: 'clock',
  limit_warning: 'alert',
  limit_exceeded: 'alert',
  limit_set: 'settings',
  signup_pending_assignment: 'users',
  manager_assigned: 'users',
  team_joined: 'users',
  team_left: 'users',
  welcome: 'info',
};

const NOTIFICATION_TYPE_LABELS = {
  expense_submitted: 'Approval request',
  expense_resubmitted: 'Approval request',
  expense_approved: 'Approved',
  expense_rejected: 'Rejected',
  expense_reimbursed: 'Reimbursed',
  expense_created_for_you: 'Expense added',
  pending_digest: 'Pending approvals',
  limit_warning: 'Spending limit',
  limit_exceeded: 'Spending limit',
  limit_set: 'Spending limit',
  signup_pending_assignment: 'Account',
  manager_assigned: 'Team',
  team_joined: 'Team',
  team_left: 'Team',
  welcome: 'Account',
};

// Where a notification leads. Expense links appear only if the reader may view that expense;
// other links point to the reader's own role area (the page guard protects them anyway).
function notificationLink(n, user, db) {
  if (n.expenseId) {
    return canViewExpense(user, findExpense(db, n.expenseId), db) ? { href: expenseUrl(n.expenseId), label: 'View expense' } : null;
  }
  const byRole = {
    manager: {
      pending_digest: { href: appUrl('manager/approvals.html'), label: 'Open approvals' },
      limit_warning: { href: appUrl('manager/team.html'), label: 'View team' },
      limit_exceeded: { href: appUrl('manager/team.html'), label: 'View team' },
      team_joined: { href: appUrl('manager/team.html'), label: 'View team' },
    },
    admin: {
      signup_pending_assignment: { href: appUrl('admin/users.html?manager=unassigned'), label: 'Assign manager' },
    },
    user: {
      limit_warning: { href: appUrl('employee/dashboard.html'), label: 'View limit' },
      limit_exceeded: { href: appUrl('employee/dashboard.html'), label: 'View limit' },
      limit_set: { href: appUrl('employee/dashboard.html'), label: 'View limit' },
    },
  };
  return byRole[user.role]?.[n.type] ?? null;
}

function renderNotifications(user, db) {
  reader = user;
  const all = notificationsFor(user, db);
  const unread = all.filter((n) => !n.read).length;
  const shown = showUnreadOnly ? all.filter((n) => !n.read) : all;
  qs('#summary').textContent = `${all.length} notification${all.length === 1 ? '' : 's'} · ${unread} unread`;
  qs('#mark-all').disabled = unread === 0;

  qs('#list').innerHTML = shown.length
    ? shown.map((n) => {
      const link = notificationLink(n, user, db);
      return `<li class="notification ${n.read ? '' : 'unread'}">
          <span class="row-icon" aria-hidden="true">${icon(NOTIFICATION_ICONS[n.type] ?? 'bell', 18)}</span>
          <div class="list-row-main">
            <span class="notification-title">${escapeHtml(n.title)}${n.read ? '' : '<span class="sr-only"> (unread)</span>'}</span>
            <span class="notification-message">${escapeHtml(n.message)}</span>
            <span class="muted xsmall">${escapeHtml(NOTIFICATION_TYPE_LABELS[n.type] ?? 'General')} ·
              <time datetime="${escapeHtml(n.createdAt)}" title="${escapeHtml(formatDateTime(n.createdAt))}">${escapeHtml(formatRelative(n.createdAt))}</time>
              ${n.read ? '' : ' · <strong class="text-accent">Unread</strong>'}</span>
          </div>
          <div class="row-actions">
            ${link ? `<a class="btn btn-ghost btn-sm" href="${link.href}" data-read="${n.id}">${escapeHtml(link.label)}</a>` : ''}
            ${n.read ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-read="${n.id}" aria-label="Mark “${escapeHtml(n.title)}” as read">${icon('check', 16)}</button>`}
          </div>
        </li>`;
    }).join('')
    : `<li>${emptyState(showUnreadOnly ? 'You’re all caught up.' : 'No notifications yet.', 'bell')}</li>`;
}

startPage({ roles: [ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.ADMIN], nav: 'notifications', title: 'Notifications' }, renderNotifications);

qs('#mark-all').innerHTML = `${icon('check', 18)} Mark all as read`;

qs('#mark-all').addEventListener('click', () => {
  const result = runAction(() => markAllNotificationsRead(reader));
  if (result.ok) {
    toast(`${result.changed} notification${result.changed === 1 ? '' : 's'} marked as read.`);
    const db = loadDb();
    refreshBadges(reader, db);
    renderNotifications(reader, db);
  }
});

qs('#list').addEventListener('click', (event) => {
  const target = event.target.closest('[data-read]');
  if (!target) return;
  runAction(() => markNotificationRead(reader, target.dataset.read));
  if (target.tagName === 'A') return; // follow the link
  const db = loadDb();
  refreshBadges(reader, db);
  renderNotifications(reader, db);
});

qsa('[data-filter]').forEach((tab) => tab.addEventListener('click', () => {
  showUnreadOnly = tab.dataset.filter === 'unread';
  qsa('[data-filter]').forEach((other) => other.setAttribute('aria-pressed', String(other === tab)));
  renderNotifications(reader, loadDb());
}));
