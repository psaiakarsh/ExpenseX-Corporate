# ExpenseX Corporate Showcase

A corporate expense management system (**Admin → Managers → Employees**) built with plain **HTML, CSS and vanilla
JavaScript**. Employees submit expense claims with receipts, managers approve or reject them and mark approved claims
as reimbursed, and the admin runs the company without seeing anyone's individual expenses.

> **Prototype.** All data lives in *this browser's* `localStorage`. Sign-in and roles are simulated in JavaScript and
> are **not** real security — anyone with DevTools can read or change the data. Do not enter real personal or
> financial information.

---

## Contents
1. [Technology](#technology)
2. [How to run](#how-to-run)
3. [Demo company and credentials](#demo-company-and-credentials)
4. [Roles](#roles)
5. [Expense workflow](#expense-workflow)
6. [Features](#features)
7. [Admin privacy](#admin-privacy)
8. [Data storage](#data-storage)
9. [Browser support, accessibility, responsive design](#browser-support-accessibility-responsive-design)
10. [Known limitations](#known-limitations)
11. [Project structure](#project-structure)

---

## Technology

| Layer | Used |
|---|---|
| Markup | HTML5 (one static page per screen) |
| Styling | CSS3 — custom properties, grid/flex, container queries, `prefers-reduced-motion` |
| Logic | Vanilla JavaScript (ES2021), classic `<script>` tags, no build step |
| Passwords | Web Crypto API (`crypto.subtle`, salted SHA-256) |
| Receipts | `<canvas>` resize + JPEG compression |
| Data | Browser `localStorage` (keys prefixed `exc:`) |

**Not used:** no React or any framework, no npm packages, no Node.js application code, no Express or any server
code, no REST/GraphQL API, no database (Firebase, Supabase, MongoDB, MySQL, PostgreSQL …), no CDN or external
requests. The project is a folder of static files.

## How to run

The app is static; anything that serves files works. A local web server is recommended.

**Option 1 — Python (verified)**
```bash
cd ExpenseX-Corporate-Showcase
python -m http.server 8765
```
Open <http://localhost:8765/> (or `http://127.0.0.1:8765/`).

**Option 2 — VS Code Live Server:** open the folder, right-click `index.html` → *Open with Live Server*.

**Option 3 — open the file directly:** double-click `index.html`. The app uses classic scripts and relative paths so
it is designed to work from `file://`. Password hashing needs a *secure context* (`crypto.subtle`); if the browser
refuses, the app shows a message — use Option 1 or 2. (Direct `file://` opening was not verified in the test
environment; all browser verification was done over `http://127.0.0.1`.)

> Serve from `localhost`/`127.0.0.1`. A plain `http://` LAN address (e.g. `http://192.168.x.x`) is not a secure
> context and password hashing will not work there.

**First start:** with no data in the browser, the login page offers **Load Demo Company** or **Set up your own
company** (`setup.html` creates the single initial Admin).

**Load / reset later:** log in as the Admin → **Settings** → *Load Demo Company* (type `REPLACE`) or *Reset Demo
Data* (type `RESET`). Both replace all ExpenseX Corporate data, log everyone out, and leave other sites'/apps'
`localStorage` keys untouched.

**"Incorrect email or password" with a listed demo account?** The browser still holds a demo loaded by an older
version (demo emails have changed since). The login page then shows a warning with that data's admin email. Log in
with it (password `Demo@123`), open **Settings → Load Demo Company**, type `REPLACE`, and log in again with the
accounts below.

## Demo company and credentials

**Sync Systems Pvt Ltd** (fictional). Every demo account uses the password **`Demo@123`**.

| Role | Name | Email | Shows |
|---|---|---|---|
| Admin | Sai Akarsh | `sai.akarsh@syncsystems.example` | Company administration |
| Manager | Abhay | `abhay@syncsystems.example` | Engineering · 4 employees |
| Manager | Sadiq | `sadiq@syncsystems.example` | Sales · 3 employees (incl. a reassigned employee) |
| Manager | Charan Sai | `charan.sai@syncsystems.example` | Operations · small team (1 active + 1 inactive) |
| Employee | Sathwik | `sathwik@syncsystems.example` | ₹14,500 of ₹20,000 limit used (warning) |
| Employee | Bharat | `bharat@syncsystems.example` | Over the monthly limit |
| Employee | Ali | `ali@syncsystems.example` | New signup, no manager yet (drafts only) |

Contents: 1 admin, 3 managers, 10 employees (9 assigned incl. 1 deactivated, 1 unassigned), 7 projects (6 active,
1 inactive), 56 expenses over six months in every status, a rejected → resubmitted claim, 9 receipts, 5 self-approved
manager expenses and one employee reassignment (Farhan Ali, Operations → Sales). The demo is generated through the
app's real workflow functions (not pasted JSON), so it obeys every rule the UI does.

## Roles

| | Employee | Manager | Admin |
|---|---|---|---|
| Created by | Public signup, Admin, or their Manager | Admin | First-run setup (one) |
| Own expenses | Create, draft, submit, edit/resubmit rejected | Create (auto-approved, *Self-approved*) | — |
| Team expenses | — | View submitted, approve/reject, reimburse | **No access** |
| Team & limits | — | Set monthly limits, add employees to own team | Assign/reassign managers |
| Projects | Pick own manager's active projects | Create, edit, activate/deactivate own | — |
| Company | — | — | Users, activation, settings, aggregates, activity log, demo data |

Public signup always creates an **Employee** with no manager (there is no role field; a tampered role is ignored).
The Admin can switch signup off.

## Expense workflow

```
draft ──submit──▶ pending ──approve──▶ reimbursement_pending ──mark reimbursed──▶ reimbursed
                     │
                     └──reject (comment required)──▶ rejected ──edit & resubmit──▶ pending
```

- **Draft** — editable and deletable. Employees without a manager can only save drafts.
- **Pending** — waiting for the employee's current manager. Locked for the employee.
- **Approve** — records the review, adds a history entry, creates a reimbursement record, moves straight to
  *Reimbursement Pending* and notifies the employee.
- **Reject** — needs a comment; the employee is notified with the comment. The employee edits the **same** expense
  and resubmits; the change log and the old rejection stay in its history, the current review is cleared.
- **Reimbursed** — the manager marks it paid (optional reference); the employee is notified.
- **Manager's own expenses** — auto-approved, marked *Self-approved*, reimbursed by that manager.
- History is append-only: every step records who, what and when.

**Reassignment.** When the Admin moves an employee to another manager, their *pending* claims move to the new
manager's queue. Past decisions are never rewritten: the approver recorded on an old claim stays the old manager.
**Reimbursement rule:** the manager allowed to pay a *Reimbursement Pending* claim is the employee's **current**
manager (or the manager themselves for their own claim). The record keeps both *Approved by* (history) and
*Reimbursed by* (who actually paid).

**Deactivation.** Deactivated users cannot log in and are logged out of open tabs; their records are kept. A manager
cannot be deactivated while any employee (active or inactive) is still assigned to them.

## Features

- **Spending limits** — optional monthly limit per employee, set by their manager. Counts pending, approved,
  reimbursement-pending and reimbursed claims by expense date. Warning at 80 % (Admin can set 50–99 %), *exceeded*
  at 100 %+. Limits **warn only** — they never block a submission. Employee and manager get one alert per level per
  month.
- **Receipts** — images only, up to 5 MB; resized in the browser to at most 1280 px and saved as JPEG (measured:
  a 683 KB 3000×4000 PNG → 59 KB, a 4.55 MB photo-like PNG → 721 KB). Preview, replace, remove, full-size view.
  Removing or replacing leaves no orphaned image.
- **Notifications** — submitted/resubmitted (to the manager), approved, rejected (with comment), reimbursed,
  created-for-you, limit set/warning/exceeded, manager assignment and team changes, new signups (to the Admin), and
  a pending-approvals digest at manager login. Unread badges, mark read / mark all read.
- **Analytics** — employee: own monthly/category/status charts. Manager: period, employee and project filters;
  monthly, category, project and status charts; approval rate; reimbursement pending vs paid and average days to
  payout; per-employee table. Admin: company aggregates only (below).
- **Projects** — managers create projects; employees tag claims with an active project of their manager.
- **Activity log** — Admin-visible audit trail of account, settings, demo and review actions.
- **Cross-tab sync** — a change in one tab (new expense, approval, logout, deactivation) redraws the other tabs.
- **Money** — every amount is stored as whole **paise** (integers); input is parsed as text, so there is no
  floating-point rounding. Max ₹10,00,000 per expense, ₹1 crore per limit. Indian digit grouping (₹1,25,000.00).

## Admin privacy

The Admin manages the company but **cannot see individual expenses**:
- no expense list, detail page, receipt, comment or reimbursement for the Admin — the permission functions return
  nothing and the expense pages refuse the Admin role;
- the dashboard shows only company totals (counts, sums, monthly/status/category distributions);
- **team totals** are shown only for teams with **≥ 3 employees**, and a team is also hidden when its total could be
  worked out by subtraction (complementary suppression); hidden teams show *Privacy-protected*;
- the activity log records expense actions by **ID only** — no title, amount, comment or reference.

## Data storage

Everything is stored in `localStorage` under keys starting with `exc:`:

| Key | Contents |
|---|---|
| `exc:schema` | Data version |
| `exc:users` | Accounts (no passwords) |
| `exc:credentials` | Salt + SHA-256 hash per user |
| `exc:session` | Signed-in user ID (shared by all tabs) |
| `exc:projects`, `exc:expenses`, `exc:reimbursements` | Business records |
| `exc:receipts` | Compressed receipt images (data URLs) |
| `exc:notifications` | Per-recipient notifications (max 200 each) |
| `exc:activity` | Activity log (latest 500) |
| `exc:settings` | Company name, limit warning %, signup on/off, demo flag |

Saves are all-or-nothing: if the browser's storage is full, the change is rolled back and an error is shown.

**Limitations of localStorage:** data exists only in this browser profile on this device (not shared between
people or devices); clearing site data deletes it; private windows discard it; typical quota is about 5 MB per
origin, which limits how many receipts fit (Admin → Settings shows usage); it is readable and editable by anyone
using the browser; one session is shared by all tabs, so two different users cannot be signed in side by side in
the same browser.

## Browser support, accessibility, responsive design

- **Browsers:** current Chrome, Edge, Firefox and Safari (needs ES2021, `<dialog>`, CSS container queries, Web
  Crypto). Verified in a Chromium-based browser; other browsers were not tested.
- **Responsive:** sidebar navigation from 1024 px; below that a bottom bar plus a *More* sheet. Tables turn into
  labelled cards when their container is narrower than 720 px. Checked at 1440, 1280, 1024, 768, 390 and 360 px with
  no horizontal page scroll.
- **Accessibility:** semantic landmarks and headings, labelled fields with inline errors (focus moves to the first
  error), keyboard-operable dialogs (focus trapped by `<dialog>`, Escape closes, focus returns), visible focus rings,
  table captions and scoped headers, live-region toasts, badge text such as "Notifications, 3 unread", text contrast
  ≥ 6 : 1, reduced-motion support.

## Known limitations

- **Not secure:** authentication, roles and privacy rules run in the browser; a user with DevTools can bypass them.
  Hashing only keeps passwords out of plain text — a single fast salted SHA-256 (no key stretching such as
  PBKDF2/bcrypt/Argon2, no server) is not suitable for real passwords.
- **Single browser:** no sharing between devices or people; no backup; clearing the browser deletes everything.
- **Storage quota** (~5 MB) limits the number of receipts.
- **One session per browser** — all tabs are the same user.
- **Fixed categories and INR only.**
- **No email**, password reset, file export or real payments; "Mark reimbursed" only records that payment happened.
- Company-wide totals of a very small company could still hint at individual spending (team totals are protected).
- Not verified: direct `file://` opening, browsers other than Chromium, reopening after a full browser restart, a
  genuinely full localStorage in a real browser (covered by automated logic checks only), reduced-motion emulation.

## Project structure

```
index.html            Redirects to the right home page (or login)
login.html signup.html setup.html
employee/             dashboard, expenses
manager/              dashboard, approvals, expenses, reimbursements, team, projects, analytics
admin/                dashboard, users, activity, settings
shared/               expense-form, expense (detail), notifications, profile
css/                  base.css (tokens, reset), layout.css (shell, nav), components.css
js/core/              constants, storage (only localStorage access), money, dates, validate
js/                   domain modules: permissions, auth, users, projects, limits, receipts, expenses,
                      reimbursements, notifications, activity, analytics, settings, demo-data;
                      UI helpers: ui, layout, guard, charts, expense-view
js/pages/             one script per page
assets/               logo mark, favicon, touch icon
```

See `VIVA.md` for a presentation/viva guide, `CLAUDE.md` for architecture rules, and `PROJECT_PROGRESS.md` for the
build and verification record.
