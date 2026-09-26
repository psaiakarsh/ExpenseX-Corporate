// layout.js — builds the app shell for the logged-in role: sidebar (desktop), topbar,
// bottom navigation + "More" sheet (phones/tablets), and keeps badges up to date.

const NAV_ITEMS = {
  user: [
    { key: 'dashboard', label: 'Dashboard', href: 'employee/dashboard.html', icon: 'dashboard' },
    { key: 'expenses', label: 'My Expenses', href: 'employee/expenses.html', icon: 'receipt' },
    { key: 'new', label: 'New Expense', href: 'shared/expense-form.html', icon: 'plus' },
    { key: 'notifications', label: 'Notifications', href: 'shared/notifications.html', icon: 'bell' },
    { key: 'profile', label: 'Profile', href: 'shared/profile.html', icon: 'user' },
  ],
  manager: [
    { key: 'dashboard', label: 'Dashboard', href: 'manager/dashboard.html', icon: 'dashboard' },
    { key: 'approvals', label: 'Approvals', href: 'manager/approvals.html', icon: 'inbox' },
    { key: 'expenses', label: 'Team Expenses', href: 'manager/expenses.html', icon: 'receipt' },
    { key: 'reimbursements', label: 'Reimbursements', href: 'manager/reimbursements.html', icon: 'banknote' },
    { key: 'team', label: 'Team', href: 'manager/team.html', icon: 'users' },
    { key: 'projects', label: 'Projects', href: 'manager/projects.html', icon: 'folder' },
    { key: 'analytics', label: 'Analytics', href: 'manager/analytics.html', icon: 'chart' },
    { key: 'notifications', label: 'Notifications', href: 'shared/notifications.html', icon: 'bell' },
    { key: 'profile', label: 'Profile', href: 'shared/profile.html', icon: 'user' },
  ],
  admin: [
    { key: 'dashboard', label: 'Dashboard', href: 'admin/dashboard.html', icon: 'dashboard' },
    { key: 'users', label: 'Users', href: 'admin/users.html', icon: 'users' },
    { key: 'activity', label: 'Activity', href: 'admin/activity.html', icon: 'activity' },
    { key: 'settings', label: 'Settings', href: 'admin/settings.html', icon: 'settings' },
    { key: 'notifications', label: 'Notifications', href: 'shared/notifications.html', icon: 'bell' },
    { key: 'profile', label: 'Profile', href: 'shared/profile.html', icon: 'user' },
  ],
};

// The first four items of each role go in the bottom bar; the rest live in the "More" sheet.
const MOBILE_PRIMARY = {
  user: ['dashboard', 'expenses', 'new', 'notifications'],
  manager: ['dashboard', 'approvals', 'expenses', 'reimbursements'],
  admin: ['dashboard', 'users', 'activity', 'settings'],
};

function brandHtml(href) {
  return `<a class="brand" href="${href}" aria-label="ExpenseX Corporate — home">
      <img class="brand-mark" src="${appUrl('assets/expensex-mark.png')}" alt="" width="36" height="36">
      <span class="brand-text" aria-hidden="true"><span class="brand-name">Expense<span>X</span></span><span class="brand-label">Corporate</span></span>
    </a>`;
}

function navLinkHtml(item, activeKey, className) {
  const current = item.key === activeKey ? ' aria-current="page"' : '';
  return `<a class="${className}" href="${appUrl(item.href)}" data-nav="${item.key}"${current}>
      ${icon(item.icon)}<span>${escapeHtml(item.label)}</span><span class="nav-badge num" data-badge="${item.key}" hidden></span>
    </a>`;
}

// Wraps the page's <main id="main"> in the shell and shows it.
function buildShell(user, activeKey, title) {
  const items = NAV_ITEMS[user.role];
  const home = appUrl(homeFor(user.role));
  const main = qs('#main');
  document.title = `${title} · ExpenseX Corporate`;

  const skip = document.createElement('a');
  skip.className = 'skip-link';
  skip.href = '#main';
  skip.textContent = 'Skip to content';

  const shell = document.createElement('div');
  shell.className = 'app-shell';
  shell.innerHTML = `
    <aside class="sidebar">
      ${brandHtml(home)}
      <nav aria-label="Main">${items.map((item) => navLinkHtml(item, activeKey, 'nav-link')).join('')}</nav>
      <div class="sidebar-user">
        ${avatar(user.name, 'sm')}
        <div class="grow">
          <div class="sidebar-user-name truncate">${escapeHtml(user.name)}</div>
          <div class="muted xsmall">${escapeHtml(ROLE_LABELS[user.role])}</div>
        </div>
        <button class="icon-btn" type="button" data-logout aria-label="Log out" title="Log out">${icon('logout', 18)}</button>
      </div>
    </aside>
    <div class="main-col">
      <header class="topbar">
        <span class="topbar-brand">${brandHtml(home)}</span>
        <h1 class="topbar-title truncate">${escapeHtml(title)}</h1>
        ${user.role !== ROLES.ADMIN && activeKey !== 'new'
          ? `<a class="btn btn-primary btn-sm topbar-add" href="${appUrl('shared/expense-form.html')}">${icon('plus', 16)} New expense</a>`
          : ''}
        <a class="icon-btn" href="${appUrl('shared/notifications.html')}" data-bell aria-label="Notifications">${icon('bell')}<span class="bell-dot" hidden></span></a>
      </header>
    </div>
    <nav class="bottom-nav" aria-label="Main (mobile)">
      ${items.filter((item) => MOBILE_PRIMARY[user.role].includes(item.key)).map((item) => navLinkHtml(item, activeKey, 'bottom-link')).join('')}
      <button class="bottom-link" type="button" data-more aria-haspopup="dialog" aria-expanded="false">${icon('more')}<span>More</span></button>
    </nav>`;

  document.body.prepend(skip, shell);
  qs('.main-col', shell).append(main);
  main.hidden = false;
  main.classList.add('page-enter');

  qsa('[data-logout]', shell).forEach((button) => button.addEventListener('click', doLogout));
  qs('[data-more]', shell).addEventListener('click', () => openMoreSheet(user, activeKey));
  // Bottom-bar badges show as dots (no room for numbers).
  qsa('.bottom-link .nav-badge', shell).forEach((badge) => badge.classList.replace('nav-badge', 'dot'));
}

function openMoreSheet(user, activeKey) {
  const trigger = qs('[data-more]');
  const extra = NAV_ITEMS[user.role].filter((item) => !MOBILE_PRIMARY[user.role].includes(item.key));
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog more-sheet';
  dialog.setAttribute('aria-label', 'More navigation');
  dialog.innerHTML = `<div class="dialog-form">
      <header class="dialog-header"><h2>${escapeHtml(user.name)} <span class="muted small">· ${escapeHtml(ROLE_LABELS[user.role])}</span></h2>
        <button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
      <nav aria-label="More"><ul class="list">${extra.map((item) => `<li>${navLinkHtml(item, activeKey, 'nav-link')}</li>`).join('')}</ul></nav>
      <button class="btn btn-ghost btn-block" type="button" data-logout>${icon('logout', 18)} Log out</button>
    </div>`;
  document.body.append(dialog);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    dialog.close();
    dialog.remove();
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
  };
  qs('[data-close]', dialog).addEventListener('click', close);
  qs('[data-logout]', dialog).addEventListener('click', doLogout);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });
  trigger.setAttribute('aria-expanded', 'true');
  dialog.showModal();
  refreshBadges(user, loadDb());
}

function doLogout() {
  logout();
  setFlash('You have been logged out.', 'info');
  location.href = appUrl('login.html');
}

function setBadge(key, count) {
  qsa(`[data-badge="${key}"]`).forEach((badge) => {
    badge.hidden = count === 0;
    const words = `<span class="sr-only">, ${count} ${key === 'approvals' ? 'waiting' : 'unread'}</span>`;
    const visible = badge.classList.contains('dot') ? '' : `<span aria-hidden="true">${count > 99 ? '99+' : count}</span>`;
    badge.innerHTML = count === 0 ? '' : visible + words;
  });
}

function refreshBadges(user, db) {
  const unread = unreadCount(user, db);
  setBadge('notifications', unread);
  const bell = qs('[data-bell]');
  if (bell) {
    bell.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
    qs('.bell-dot', bell).hidden = unread === 0;
  }
  if (user.role === ROLES.MANAGER) {
    setBadge('approvals', db.expenses.filter((e) => can(user, 'expense.review', e, db)).length);
  }
}

// Every signed-in page starts here:
//   startPage({ roles: ['manager'], nav: 'approvals', title: 'Approvals' }, (user, db) => { …draw… });
// `render` runs once, and again whenever another tab changes the data (live = true),
// so an employee's submission appears on the manager's open dashboard without a refresh.
// Returns a redraw function (undefined when the guard redirected away).
function startPage({ roles, nav, title, live = true }, render) {
  let user;
  try {
    user = requireUser(roles);
  } catch (error) {
    showFatalError(error);
    return;
  }
  if (!user) return;

  buildShell(user, nav, title);
  showFlash();

  const draw = () => {
    try {
      const db = loadDb();
      const fresh = findUser(db, user.id);
      refreshBadges(fresh, db);
      render(fresh, db);
    } catch (error) {
      showFatalError(error);
    }
  };
  draw();

  window.addEventListener('storage', (event) => {
    if (event.key && !event.key.startsWith(STORAGE_PREFIX)) return;
    let current;
    try {
      current = getSessionUser();
    } catch (error) {
      showFatalError(error);
      return;
    }
    // Logged out, switched account or deactivated in another tab.
    if (!current || current.id !== user.id || current.role !== user.role) {
      location.replace(appUrl(current ? homeFor(current.role) : 'login.html'));
      return;
    }
    if (live) draw();
    else refreshBadges(current, loadDb());
  });
  return draw; // pages call this to redraw after their own actions
}
