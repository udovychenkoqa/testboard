# Test Management (stage 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qase-style test management in Testboard — projects, nested suites, cases with steps, manual runs with assignees.

**Architecture:** SQLite (`better-sqlite3` + Drizzle) in the data dir; pure repository functions in `app/lib/tm/*` taking a DB handle (unit-tested on `:memory:`); thin `/api/tm/*` route handlers with zod validation; client pages under `/cases` and `/runs` using the existing `useQuery`/`useMutation` hooks and next-intl.

**Tech Stack:** Next 14 App Router, better-sqlite3, drizzle-orm (+ drizzle-kit dev), zod, HeroUI, next-intl, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-test-management-design.md`

## Global Constraints

- DB file: `path.join(DATA_FOLDER, 'testboard.db')`; WAL + `foreign_keys = ON`; migrations auto-applied on first access.
- Table names prefixed `tm_`. Case label = `${project.code}-${case.number}`; numbers never reused.
- Enums: priority `high|medium|low` (default `medium`); status `draft|actual|deprecated` (default `actual`); automation `manual|automated|to_automate` (default `manual`); run status `in_progress|completed`; result `untested|passed|failed|blocked|skipped`.
- Project `key`: `/^[a-z0-9][a-z0-9._-]{0,63}$/`; `code`: `/^[A-Z][A-Z0-9]{1,9}$/`.
- `manage:cases` = admin + tester only; all mutating `/api/tm/*` (POST/PATCH/DELETE) need it; GET needs `view`.
- Every UI string via next-intl (`tm.*` namespaces), en + uk.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Case numbering under deletes — deleting `HW-3` and creating a new case gives `HW-4`, never `HW-3` again (Task 4 test).
2. Moving a suite under its own descendant must be rejected, not create a cycle (Task 3 test).
3. Creating a run whose source matches no cases (empty suite, unknown tag) returns a clear 400, not an empty run (Task 5 test).
4. Bad project key/code (spaces, uppercase key, lowercase code, duplicates) rejected with 400/409 (Task 3 + Task 6 tests).
5. A viewer's mutating TM request gets 403 at the middleware (Task 2 test).

---

### Task 1: Database foundation

**Files:**
- Create: `app/lib/tm/schema.ts`, `app/lib/tm/db.ts`, `app/lib/tm/errors.ts`, `drizzle.config.ts`, `app/lib/tm/migrations/*` (generated)
- Modify: `package.json`, `next.config.js` (`experimental.serverComponentsExternalPackages: ['better-sqlite3']`), `Dockerfile` (deps stage: `apk add --no-cache libc6-compat python3 make g++`)
- Test: `tests/unit/tm/db.test.ts`

**Interfaces:**
- Produces: `type TmDb = BetterSQLite3Database<typeof schema>`; `openDb(file: string): TmDb` (opens, sets pragmas, runs migrations); `getDb(): TmDb` (process singleton on `DATA_FOLDER/testboard.db`); `class TmError extends Error { code: 'not_found'|'conflict'|'not_empty'|'invalid' }`; drizzle tables `tmProjects, tmSuites, tmCases, tmCaseSteps, tmCaseTags, tmRuns, tmRunCases` per spec columns.

- [ ] Install: `npm i better-sqlite3 drizzle-orm zod` and `npm i -D drizzle-kit @types/better-sqlite3`.
- [ ] Failing test: `openDb(':memory:')` → `sqlite_master` lists all 7 `tm_*` tables; `PRAGMA foreign_keys` = 1; calling `openDb` twice on the same file path does not fail (migrations idempotent).
- [ ] Write schema + `drizzle.config.ts` (out `app/lib/tm/migrations`), run `npx drizzle-kit generate`, implement `openDb` with `migrate(db, { migrationsFolder })` resolved from `process.cwd()`.
- [ ] Tests pass; `npx tsc --noEmit`; commit.

### Task 2: Tester role and `manage:cases`

**Files:** Modify `app/lib/access.ts`; Test `tests/unit/tm/access.test.ts`

**Interfaces:** Produces `ROLES.tester`, `CAPABILITIES.manageCases = 'manage:cases'`; `ASSIGNABLE_ROLES = ['admin','tester','viewer']`.

- [ ] Failing tests: `can('admin'|'tester', manageCases)` true, `can('viewer', manageCases)` false; `requiredCapability('/api/tm/projects','POST')` = manageCases, `'PATCH' /api/tm/cases/5` = manageCases, `'DELETE' /api/tm/suites/3` = manageCases, `'GET' /api/tm/projects` = view; existing: `can('viewer', manageReports)` still true.
- [ ] Implement: `requiredCapability` checks `pathname.includes('/api/tm/') && method !== 'GET'` first; `can` returns `role === admin || role === tester` for manageCases.
- [ ] Green; commit.

### Task 3: Projects and suites repository

**Files:** Create `app/lib/tm/projects.ts`, `app/lib/tm/suites.ts`; Test `tests/unit/tm/projects-suites.test.ts`

**Interfaces:**
- `createProject(db, { key, name, code }): Project` — validates key/code regexes (`TmError('invalid')`), duplicates → `TmError('conflict')`.
- `listProjects(db): ProjectSummary[]` — `{ id, key, name, code, caseCount, automatedCount }` (non-deleted cases).
- `getProject(db, key): Project` (`not_found`); `updateProject(db, key, { name }): Project`; `deleteProject(db, key): void` (`not_empty` when any case or run exists).
- `listSuites(db, projectId): SuiteNode[]` — flat `{ id, parentId, name, position, caseCount }`, non-deleted, ordered by position.
- `createSuite(db, { projectId, parentId?, name }): SuiteNode`; `updateSuite(db, id, { name?, parentId? }): SuiteNode` (`invalid` if parentId is itself or a descendant); `deleteSuite(db, id): void` — soft-deletes the suite, its descendants and their cases.

- [ ] Failing tests for each line above, including Review Focus 2 and 4.
- [ ] Implement; green; commit.

### Task 4: Cases repository

**Files:** Create `app/lib/tm/cases.ts`; Test `tests/unit/tm/cases.test.ts`

**Interfaces:**
- `type CaseInput = { suiteId: number; title: string; description?: string; preconditions?: string; priority?; status?; automation?; steps?: { action: string; expected: string }[]; tags?: string[] }`
- `createCase(db, projectId, input, by: string): CaseDetail` — number from `next_case_number` in one transaction.
- `CaseDetail = { id, label, number, suiteId, title, description, preconditions, priority, status, automation, steps, tags, createdBy, createdAt, updatedBy, updatedAt }`
- `getCase(db, id): CaseDetail`; `updateCase(db, id, Partial<CaseInput>, by): CaseDetail` (steps/tags replaced when given).
- `listCases(db, projectId, f: { suiteId?; q?; priority?; status?; automation?; tag? }): CaseListItem[]` — `q` matches title or label, case-insensitive; `suiteId` includes descendant suites.
- `deleteCases(db, ids: number[]): void` (soft); `moveCases(db, ids, suiteId): void`.

- [ ] Failing tests: labels `HW-1..HW-3`; delete `HW-3` then create → `HW-4` (Review Focus 1); steps order kept; tags deduped/trimmed; each filter; deleted cases hidden; move.
- [ ] Implement; green; commit.

### Task 5: Runs repository

**Files:** Create `app/lib/tm/runs.ts`; Test `tests/unit/tm/runs.test.ts`

**Interfaces:**
- `type RunSource = { type: 'all' } | { type: 'suites'; suiteIds: number[] } | { type: 'tags'; tags: string[] } | { type: 'cases'; caseIds: number[] }`
- `createRun(db, { projectId, name, source, assignee?, by }): RunSummary` — non-deleted, non-deprecated matching cases (suites include descendants); snapshot `{ label, title, preconditions, steps, suitePath }`; zero matches → `TmError('invalid')` (Review Focus 3).
- `RunSummary = { id, name, status, createdBy, createdAt, completedAt, total, counts: Record<Result, number> }`; `listRuns(db, projectId): RunSummary[]` newest first.
- `getRun(db, id): { run: RunSummary; cases: RunCaseView[] }`, `RunCaseView = { id, caseId, snapshot, result, comment, assignee, resultBy, resultAt }` ordered by suite path then label.
- `updateRunCase(db, runCaseId, { result?, comment?, assignee? }, by): RunCaseView` — sets `resultBy/resultAt` when result changes; `invalid` if run completed.
- `completeRun(db, id): RunSummary`.

- [ ] Failing tests: counts; snapshot unchanged after `updateCase`; deprecated excluded; result metadata; completed run rejects updates.
- [ ] Implement; green; commit.

### Task 6: API routes

**Files:** Create `app/api/tm/**/route.ts` per spec list, `app/lib/tm/http.ts` (`handle(fn)` maps `TmError` → 404/409/409/400, zod errors → 400, returns JSON), `app/lib/tm/assignees.ts` (`listAssignees(): Promise<string[]>` = env admin emails ∪ `config.access.users` keys, sorted); Test `tests/unit/tm/http.test.ts`.

- [ ] Failing tests for `handle`: TmError codes → statuses; ZodError → 400 with field message.
- [ ] Routes: read `session.user.email ?? 'api-key'` as `by`; zod schemas mirror Task 3–5 inputs with Global Constraints regexes.
- [ ] `tsc`; green; commit.

### Task 7: Navigation, Test Runs tabs, project selection

**Files:** Modify `app/components/aside.tsx`, `messages/{en,uk}.json`; Create `app/runs/automated/page.tsx` (renders existing `RunTests`), `app/runs/layout.tsx` (Manual/Automated tabs), `app/run-tests/page.tsx` → `redirect('/runs/automated')`, `app/hooks/useTmProject.ts` (`useTmProject(): [key: string | null, setKey]`, localStorage `tm.project`).

- [ ] Sidebar: Test Cases (`/cases`), Test Runs (`/runs/manual`) replacing Run Tests; active on `/runs/*`.
- [ ] Unit: i18n scanner and message checks green; commit.

### Task 8: Test Cases UI

**Files:** Create `app/cases/page.tsx`, `app/cases/[key]/page.tsx`, `app/components/tm/{project-cards,new-project-modal,suite-tree,case-list,case-panel,steps-editor}.tsx`.

- [ ] Behaviour per spec UI section; edit controls hidden unless role is admin/tester (`session.user.role`; API-key/no-auth sessions count as admin).
- [ ] Unit (scanner/messages) green; manual check in browser; commit.

### Task 9: Manual runs UI

**Files:** Create `app/runs/manual/page.tsx`, `app/runs/manual/[id]/page.tsx`, `app/components/tm/{new-run-modal,run-list,run-case-panel}.tsx`.

- [ ] New run (name, source, default assignee); run page with progress, My cases, result filter, panel with result buttons + comment + reassign, auto-advance; Complete run.
- [ ] Unit green; commit.

### Task 10: E2E and wrap-up

**Files:** Create `tests/e2e/test-management.spec.ts`; extend `tests/e2e/i18n.spec.ts`.

- [ ] E2E: create project → suite → case with 2 steps → run (all) → mark Passed/Failed → progress "1 passed · 1 failed"; `/run-tests` → `/runs/automated`; `/cases` heading in Ukrainian.
- [ ] Full: `npm run test:unit`, `npm run test:e2e`, `tsc`, `npm run lint` green; commit.
