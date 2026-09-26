// admin-activity.js — the administrative activity log (activity.js). Operational/audit information only:
// entries never contain expense titles, amounts, comments, receipts or credentials. All text is escaped.

const ACTIVITY_PAGE_SIZE = 25;
let activityLimit = ACTIVITY_PAGE_SIZE;
let activityFilters = {};

const TARGET_LABELS = { user: 'User', expense: 'Expense', settings: 'Settings' };

function activityMatches(entry, filters) {
  if (filters.actorId && entry.actorId !== filters.actorId) return false;
  if (filters.action && entry.action !== filters.action) return false;
  const day = toLocalDate(new Date(entry.createdAt));
  if (filters.from && day < filters.from) return false;
  if (filters.to && day > filters.to) return false;
  const search = String(filters.search ?? '').trim().toLowerCase();
  return !search || entry.summary.toLowerCase().includes(search);
}

function renderActivity(user, db) {
  const toolbar = qs('#toolbar');
  if (!toolbar.dataset.ready) {
    toolbar.dataset.ready = 'true';
    qs('#action').innerHTML = optionsHtml([{ value: '', label: 'All actions' }, ...Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value, label }))]);
    const read = bindToolbar(toolbar, (values) => {
      activityFilters = values;
      activityLimit = ACTIVITY_PAGE_SIZE;
      redrawActivity?.();
    });
    activityFilters = read();
  }
  const actorIds = [...new Set(db.activity.map((entry) => entry.actorId))];
  qs('#actorId').innerHTML = optionsHtml([
    { value: '', label: 'Anyone' },
    ...actorIds.map((id) => ({ value: id, label: findUser(db, id)?.name ?? 'Unknown' })).sort((a, b) => a.label.localeCompare(b.label)),
  ], qs('#actorId').value);
  const filters = { ...activityFilters, actorId: qs('#actorId').value };

  const matching = db.activity.filter((entry) => activityMatches(entry, filters)); // newest first (stored order)
  const shown = matching.slice(0, activityLimit);
  qs('#count').textContent = `Showing ${shown.length} of ${matching.length} matching · ${db.activity.length} entries kept (newest 500)`;
  qs('#more').hidden = matching.length <= activityLimit;

  qs('#table').innerHTML = shown.length
    ? `<div class="table-wrap"><table class="table table-stack">
        <caption class="sr-only">Activity log entries, newest first</caption>
        <thead><tr><th scope="col">When</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">Details</th></tr></thead>
        <tbody>${shown.map((entry) => `<tr>
            <th scope="row" style="text-align:left;font-weight:500"><time datetime="${escapeHtml(entry.createdAt)}">${escapeHtml(formatDateTime(entry.createdAt))}</time></th>
            <td data-label="Actor">${escapeHtml(findUser(db, entry.actorId)?.name ?? 'Unknown')}</td>
            <td data-label="Action"><span class="badge badge-muted">${escapeHtml(ACTIVITY_LABELS[entry.action] ?? entry.action)}</span></td>
            <td data-label="Target">${escapeHtml(TARGET_LABELS[entry.targetType] ?? '—')}</td>
            <td data-label="Details" style="text-align:left">${escapeHtml(entry.summary)}</td>
          </tr>`).join('')}</tbody>
      </table></div>`
    : emptyState(db.activity.length ? 'No activity matches these filters.' : 'No activity recorded yet.', 'activity');
}

const redrawActivity = startPage({ roles: [ROLES.ADMIN], nav: 'activity', title: 'Activity' }, renderActivity);

qs('#more').addEventListener('click', () => {
  activityLimit += ACTIVITY_PAGE_SIZE;
  redrawActivity?.();
});
