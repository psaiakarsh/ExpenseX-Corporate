// limits.js — monthly spending limits (set by the manager, per employee).
// "Used" is always calculated from stored expenses: the employee's claims dated in that month
// with status Pending, Approved, Reimbursement Pending or Reimbursed. Drafts and rejected claims don't count.
// Limits WARN only; they never block a submission.

function monthlySpend(expenses, employeeId, month) {
  return expenses
    .filter((e) => e.employeeId === employeeId && SPENDING_STATUSES.includes(e.status) && monthKey(e.date) === month)
    .reduce((sum, e) => sum + e.amount, 0);
}

// level: 'none' (no limit) | 'ok' | 'warning' (≥ warning %) | 'exceeded' (≥ 100 %)
function limitLevel(used, limit, warningPercent) {
  if (!limit) return 'none';
  if (used >= limit) return 'exceeded';
  if (used * 100 >= limit * warningPercent) return 'warning';
  return 'ok';
}

// extraAmount: an expense not yet counted (the one being filed), to preview its effect.
function limitStatus(employee, expenses, settings, month = currentMonthKey(), extraAmount = 0) {
  const limit = employee?.monthlyLimit ?? null;
  const used = monthlySpend(expenses, employee?.id, month) + extraAmount;
  return {
    month,
    limit,
    used,
    remaining: limit === null ? null : limit - used,
    percent: limit ? Math.round((used * 100) / limit) : 0,
    level: limitLevel(used, limit, settings.limitWarningPercent),
  };
}

// Called inside submit/create actions: sends one warning and one exceeded alert per employee per month
// to the employee and their manager.
function checkLimitAlerts(db, employee, month) {
  if (!employee || employee.role !== ROLES.EMPLOYEE) return;
  const status = limitStatus(employee, db.expenses, db.settings, month);
  if (status.level !== 'warning' && status.level !== 'exceeded') return;

  const exceeded = status.level === 'exceeded';
  const summary = `${formatMoney(status.used)} of ${formatMoney(status.limit)} used in ${formatMonth(month)}`;
  const type = exceeded ? 'limit_exceeded' : 'limit_warning';
  notify(db, employee.id, {
    type,
    title: exceeded ? 'Monthly limit exceeded' : 'Approaching monthly limit',
    message: `${summary}. You can still submit expenses; your manager will see the flag.`,
    key: `${type}:${month}`,
  });
  notify(db, employee.managerId, {
    type,
    title: exceeded ? 'Team member over limit' : 'Team member near limit',
    message: `${employee.name}: ${summary}.`,
    key: `${type}:${employee.id}:${month}`,
  });
}

function limitBadge(level) {
  if (level === 'exceeded') return `<span class="badge badge-danger">${icon('alert', 14)}Over limit</span>`;
  if (level === 'warning') return `<span class="badge badge-warning">${icon('alert', 14)}Near limit</span>`;
  return '';
}

// HTML meter: "₹14,500.00 / ₹20,000.00".
function limitMeter(status, label = 'This month') {
  if (status.limit === null) {
    return `<div class="meter"><div class="meter-values"><span>${escapeHtml(label)}</span><span class="num">${formatMoney(status.used)} · no limit set</span></div></div>`;
  }
  const width = Math.min(100, status.percent);
  const levelClass = status.level === 'exceeded' ? 'meter-exceeded' : status.level === 'warning' ? 'meter-warning' : '';
  const note = status.level === 'exceeded'
    ? `<span class="text-danger small">${icon('alert', 14)} Exceeded by ${formatMoney(-status.remaining)}</span>`
    : status.level === 'warning'
      ? `<span class="text-warning small">${icon('alert', 14)} ${status.percent}% used</span>`
      : `<span class="muted small">${formatMoney(status.remaining)} remaining</span>`;
  return `<div class="meter ${levelClass}">
      <div class="meter-values"><span>${escapeHtml(label)}</span><span class="num"><strong>${formatMoney(status.used)}</strong> / ${formatMoney(status.limit)}</span></div>
      <div class="meter-track" role="progressbar" aria-label="${escapeHtml(label)} spending against limit" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${width}" aria-valuetext="${status.percent}% of monthly limit used"><div class="meter-fill" style="width:${width}%"></div></div>
      ${note}
    </div>`;
}
