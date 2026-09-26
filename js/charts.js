// charts.js — simple charts built from HTML + CSS (no chart library).
// Every chart has a readable text form: bar lists show their values as text, and column charts
// include a screen-reader table.

// rows: [{ label, amount, count }] → horizontal bars, largest first.
// showShare: false hides the "% of the rows shown" figure (misleading when some rows are hidden).
function barList(rows, { empty = 'No spending recorded yet.', limit = 8, showCount = true, showShare = true } = {}) {
  const visible = rows.filter((row) => row.amount > 0).slice(0, limit);
  if (visible.length === 0) return emptyState(empty, 'chart');
  const max = Math.max(...visible.map((row) => row.amount));
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  const items = visible.map((row) => {
    const width = Math.max(1, Math.round((row.amount * 100) / max));
    const share = total ? Math.round((row.amount * 100) / total) : 0;
    return `<li class="bar-item">
        <div class="bar-item-top">
          <span class="truncate" title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span>
          <span class="value">${formatMoney(row.amount)}${showShare ? ` · ${share}%` : ''}${showCount ? ` · ${row.count} claim${row.count === 1 ? '' : 's'}` : ''}</span>
        </div>
        <div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${width}%"></div></div>
      </li>`;
  });
  const more = rows.filter((row) => row.amount > 0).length - visible.length;
  return `<ul class="bar-list">${items.join('')}</ul>${more > 0 ? `<p class="muted xsmall" style="margin-top:12px">+ ${more} more</p>` : ''}`;
}

// rows: [{ key, label, amount }] in time order → vertical columns (current month highlighted).
function columnChart(rows, caption) {
  if (rows.every((row) => row.amount === 0)) return emptyState('No spending in this period.', 'chart');
  const max = Math.max(...rows.map((row) => row.amount));
  const current = currentMonthKey();

  const columns = rows.map((row) => {
    const height = row.amount === 0 ? 0 : Math.max(2, Math.round((row.amount * 100) / max));
    return `<div class="column">
        <span class="column-value">${row.amount ? formatMoneyCompact(row.amount) : ''}</span>
        <div class="column-bar ${row.key === current ? 'is-current' : ''}" style="height:${height}%"></div>
      </div>`;
  });
  const labels = rows.map((row) => `<span>${escapeHtml(row.label.split(' ')[0])}</span>`);
  const tableRows = rows.map((row) => `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${formatMoney(row.amount)}</td></tr>`);

  return `<figure>
      <div class="columns" aria-hidden="true">${columns.join('')}</div>
      <div class="column-labels" aria-hidden="true">${labels.join('')}</div>
      <table class="sr-only"><caption>${escapeHtml(caption)}</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Amount</th></tr></thead>
        <tbody>${tableRows.join('')}</tbody></table>
    </figure>`;
}

// rows from breakdownByStatus() → one stacked bar (by count) + a legend with counts and amounts.
function statusChart(rows, { empty = 'No expenses yet.' } = {}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return emptyState(empty, 'chart');
  const segments = rows
    .filter((row) => row.count > 0)
    .map((row) => `<span class="fill-${row.status}" style="width:${(row.count * 100) / total}%" title="${escapeHtml(row.label)}"></span>`);
  const legend = rows.map((row) => `<li>
      <span class="swatch fill-${row.status}" aria-hidden="true"></span>
      <span>${escapeHtml(row.label)}</span>
      <span class="value">${row.count} · ${formatMoney(row.amount)}</span>
    </li>`);
  return `<div class="stacked" aria-hidden="true">${segments.join('')}</div><ul class="legend">${legend.join('')}</ul>`;
}

// Two-part comparison, e.g. Reimbursement Pending vs Reimbursed.
function splitChart(parts) {
  const total = parts.reduce((sum, part) => sum + part.amount, 0);
  if (total === 0) return emptyState('Nothing approved yet.', 'chart');
  const segments = parts
    .filter((part) => part.amount > 0)
    .map((part) => `<span class="fill-${part.status}" style="width:${(part.amount * 100) / total}%"></span>`);
  const legend = parts.map((part) => `<li>
      <span class="swatch fill-${part.status}" aria-hidden="true"></span>
      <span>${escapeHtml(part.label)}</span>
      <span class="value">${formatMoney(part.amount)} · ${part.count}</span>
    </li>`);
  return `<div class="stacked" aria-hidden="true">${segments.join('')}</div><ul class="legend">${legend.join('')}</ul>`;
}

function statCard({ label, value, sub = '', iconName = 'receipt', accent = false }) {
  return `<div class="stat ${accent ? 'stat-accent' : ''}">
      <span class="stat-label">${icon(iconName, 16)}${escapeHtml(label)}</span>
      <span class="stat-value">${value}</span>
      ${sub ? `<span class="stat-sub">${sub}</span>` : ''}
    </div>`;
}

function countText(count, word = 'claim') {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
