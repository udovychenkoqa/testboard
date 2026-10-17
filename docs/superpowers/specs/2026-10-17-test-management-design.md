# Test management (stage 1) — design

Date: 2026-10-17 · Branch: `feat/test-management`

## Goal

Testboard gets a Qase-style test management module: projects → nested suites
→ test cases with steps, and manual test runs that testers work through and
mark case by case. Stage 2 (later, separate spec) links cases to the
Playwright reports Testboard already has.

Success looks like:

- A tester opens Test Cases, picks a project, browses a suite tree, creates and
  edits cases with steps, and finds cases by search/filters.
- A run is created from the whole project, suites, tags or a hand-picked
  selection; cases are assigned to testers; each tester sees "my cases", marks
  Passed/Failed/Blocked/Skipped with a comment, and the run shows live progress.
- Editing a case later never changes what an old run shows.
- A viewer can read everything but change nothing (enforced by the API).
- Both languages from day one; the existing autotest trigger keeps working.

## Decisions (agreed)

| Topic | Decision |
|---|---|
| Scope | Stage 1: manual test management. Stage 2: link cases to automated results. |
| Project | Same concept as the report `project`: a TM project's `key` equals the `project` CI sends. |
| Roles | New `tester` role; new capability `manage:cases` for admin + tester. Viewer stays read-only for TM. |
| Case fields | Title, description, preconditions, steps (action + expected), suite, priority (high/medium/low), status (draft/actual/deprecated), automation (manual/automated/to_automate), tags, short ID `CODE-N`. |
| Runs | Cases assigned to testers; who/when recorded per result; results untested/passed/failed/blocked/skipped + comment. No per-step results. |
| Storage | SQLite file in the data dir via `better-sqlite3` + Drizzle ORM. |
| Navigation | Sidebar: **Test Cases** and **Test Runs**; Test Runs has tabs **Manual** and **Automated** (the current Run Tests page moves there). |

## Storage

- `${DATA_DIR || 'data'}/testboard.db` (e2e gets its own DB through `DATA_DIR`).
- WAL mode; foreign keys on.
- Migrations (Drizzle) live in the repo and run automatically on first DB access.
- Dockerfile deps stage installs `python3 make g++` so `better-sqlite3` builds
  even when no musl prebuild matches.

### Tables

- `tm_projects` — id, key (unique, = report project), name, code (unique, for
  IDs), next_case_number, created_at.
- `tm_suites` — id, project_id, parent_id (nullable), name, position, deleted_at.
- `tm_cases` — id, project_id, suite_id, number (unique per project, never
  reused), title, description, preconditions, priority, status, automation,
  created_by, created_at, updated_by, updated_at, deleted_at.
- `tm_case_steps` — id, case_id, position, action, expected.
- `tm_case_tags` — case_id, tag (unique pair).
- `tm_runs` — id, project_id, name, status (in_progress/completed),
  created_by, created_at, completed_at.
- `tm_run_cases` — id, run_id, case_id, snapshot (JSON: id label, title,
  preconditions, steps, suite path), result, comment, assignee,
  result_by, result_at.

Deletion: suites and cases are soft-deleted (`deleted_at`), so runs keep their
history. A project can only be deleted when it has no cases or runs.

## UI

- `/cases` — project cards (name, key, case count, automated share) +
  **New project** (name, key, code auto-suggested from the name).
- `/cases/[key]` — left: suite tree (counts, add/rename/delete, collapse);
  right: cases of the selected suite (ID, title, priority, automation, tags),
  search + filters (priority, status, automation, tag), **+ Case**, bulk move /
  delete / **Create run**. Clicking a case opens a side panel to view/edit all
  fields and steps (add, remove, reorder).
- `/runs/manual` — runs of the selected project with progress bars;
  **New run** (name, case source: all / suites / tags / selection, default assignee).
- `/runs/manual/[id]` — summary + progress + **Complete run**; cases grouped
  by suite with result and assignee; **My cases** and result filters; side panel
  with steps, result buttons, comment, reassign; auto-advance to the next
  untested case.
- `/runs/automated` — the current Run Tests page, unchanged in behaviour.
  `/run-tests` redirects here.
- Sidebar: Test Cases, Test Runs (replacing Run Tests). Selected project is
  remembered (localStorage) across TM pages.
- App styling (cards, empty states, toasts, skeletons); viewer sees no edit controls.

## Access

- `ROLES.tester`, added to `ASSIGNABLE_ROLES`.
- `CAPABILITIES.manageCases = 'manage:cases'`; `can()` grants it to admin and
  tester only. Other existing rules unchanged.
- Mutating `/api/tm/*` requests (POST/PATCH/DELETE) require `manage:cases`;
  GET requires `view`.
- API-key sessions act as admin but have no email, so they can't be assignees.
  Assignees = env admin emails + emails with a role in `config.access.users`.

## API (`/api/tm`)

- `GET/POST /projects`, `PATCH/DELETE /projects/[key]`
- `GET/POST /projects/[key]/suites`, `PATCH/DELETE /suites/[id]`
- `GET/POST /projects/[key]/cases` (filters: suite, q, priority, status,
  automation, tag), `GET/PATCH/DELETE /cases/[id]`, `POST /projects/[key]/cases/bulk`
  (move, delete)
- `GET/POST /projects/[key]/runs`, `GET/PATCH /runs/[id]` (complete),
  `PATCH /runs/[id]/cases/[runCaseId]` (result, comment, assignee)
- `GET /assignees`

Input validated with `zod`. DB logic lives in `app/lib/tm/` as functions that
take the DB handle, so they are unit-testable with an in-memory database.

## Testing

- Unit (Jest, in-memory SQLite): case numbers never reused; soft delete keeps
  run history; run snapshot unaffected by later case edits; run progress
  counts; filters; `can()` for admin/tester/viewer.
- E2E (Playwright): project → suite → case with steps → run → mark results →
  progress; `/run-tests` redirects to `/runs/automated`; Ukrainian pages.
- Existing i18n scanner covers the new UI.

## Out of scope (later)

Linking to automated results (stage 2), attachments, custom fields, per-step
results, defects/Jira, Qase CSV import, making `viewer` read-only for reports.
