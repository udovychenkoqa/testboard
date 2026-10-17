# Testboard architecture

This document explains **how the system is put together and why**. Where each file lives is easy to see in
the code; this covers the boundaries between layers, the data flows, and the decisions the code can't
explain on its own.

## 1. What the product does

An internal QA dashboard for the team. It has five jobs:

1. **Stores Playwright results.** CI uploads blob reports (`.zip`) via `PUT /api/result/upload`.
2. **Generates HTML reports.** Several results are merged into one report (`merge-reports`) and served.
3. **Analyses.** Trends, flaky tests, an AI summary of failures (Anthropic), Slack or webhook
   notifications.
4. **Runs autotests.** Triggers and cancels Drone CI builds (the Automated tab in Test Runs).
5. **Manages test cases (TM).** Projects, suites, cases with steps, manual runs with results — Qase-style.

The project is a fork of `playwright-reports-server`, reworked into Testboard. The storage layer, report
generation and the (simplified) access model come from upstream.

## 2. Layers

```
Browser (React, HeroUI, TanStack Query, next-intl)
   │  fetch /api/*  (NextAuth cookie session or Authorization: <API_TOKEN> header)
   ▼
middleware.ts ── authentication + can(role, requiredCapability(path, method))
   ▼
API routes  app/api/**/route.ts  (+ pages/api/result/upload.ts)
   │  thin: parse the request → call a service → respond
   ▼
Services / domain
   ├─ app/lib/service        reports and results, caches, cron, config
   ├─ app/lib/tm             test management (repositories over SQLite)
   ├─ app/lib/ai, notifications, drone, analytics, parser
   ▼
Storage
   ├─ app/lib/storage        Storage interface: FS | S3 | Azure (env DATA_STORAGE)
   └─ app/lib/tm/db.ts       SQLite (better-sqlite3), file <DATA_DIR>/testboard.db
```

Dependency rule: arrows point **down only**. The UI knows nothing about storage, routes know nothing about
SQL, repositories know nothing about HTTP.

## 3. Key modules

### 3.1 Storage (`app/lib/storage`)

- `Storage` (`types.ts`) is the single contract: read and delete results and reports, save streams,
  generate a report, read and write `config.json`.
- Implementations: `fs.ts` (default), `s3.ts`, `azure.ts`. `index.ts` picks one by `DATA_STORAGE`.
- Data layout: `<DATA_DIR>/results`, `<DATA_DIR>/reports`, `<DATA_DIR>/config.json`. `DATA_DIR` comes
  from env (default `data`) and is resolved with `path.resolve`.
- Write new logic against the interface, not a concrete implementation: all three backends must work.

### 3.2 Service (`app/lib/service`)

- `service` is a singleton facade for routes: pagination, sorting, filters, projects, config.
- Caches (`service/cache`) are enabled by `USE_SERVER_CACHE`; then report and result lists aren't re-read
  from storage on every request.
- `lifecycle.ts` initialises caches and cron once per process; called from `instrumentation.ts`.
- `cron.ts` deletes expired results and reports per settings (`RESULT_EXPIRE_DAYS` etc. or Settings).
- After a report is generated, the AI summary and notifications run **sequentially**, not in parallel.
  The reason is in a comment in `service/index.ts`.

### 3.3 Test management (`app/lib/tm`)

| File                                              | Responsibility                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `db.ts`                                           | Opens SQLite (WAL, `foreign_keys=ON`), runs migrations, `getDb()` singleton |
| `migrations.ts`                                   | Array of SQL migrations; version tracked in `PRAGMA user_version`           |
| `projects.ts`, `suites.ts`, `cases.ts`, `runs.ts` | Repositories: plain functions `(db, …) → data`                              |
| `schemas.ts`                                      | zod schemas for request bodies and params                                   |
| `handler.ts`                                      | `tmRoute()`: route wrapper — DB, acting user, access check, JSON, errors    |
| `http.ts`                                         | Maps `TmError`/`ZodError` to HTTP statuses                                  |
| `constants.ts`                                    | Enums (priorities, statuses, results) — **client-safe**                     |

Key decisions:

- **A TM project = the `project` string CI sends with reports.** The project key matches what CI uploads,
  so stage 2 can link cases to automated tests.
- **`CODE-N` numbering** comes from `tm_projects.next_case_number` inside a transaction. A deleted case's
  number is never reused.
- **Soft delete** (`deleted_at`) for suites and cases, so past runs keep their history.
- **Case snapshot in a run.** `tm_run_cases.snapshot` is JSON with the title, preconditions and steps at
  the time the run was created. Later edits to the case don't change what the tester saw.
- **No ORM.** Drizzle was rejected because its peer dependencies require React 19. SQL is hand-written;
  migrations are an array of strings.

### 3.4 Authentication and access

- **NextAuth** (`app/auth.config.ts` is the edge-compatible part, `app/auth.ts` the Node part). Two ways
  to sign in:
  - API token (`API_TOKEN`) — for CI and as a fallback UI login;
  - Google OAuth (`AUTH_GOOGLE_ID/SECRET`) — for people, filtered by domain.
- With neither configured the app is fully open (`AUTH_ENABLED=false`): "open mode" = implicit admin.
- **Roles** (`app/lib/access.ts`):

  | Role                           | Can                                                     |
  | ------------------------------ | ------------------------------------------------------- |
  | `admin`                        | everything, including Settings and access management    |
  | `tester`                       | everything except Settings, plus test-management writes |
  | `viewer` (and any other label) | everything except Settings and test-management writes   |

- Where a role comes from: `AUTH_ADMIN_EMAILS` (env), an assignment in Settings (`config.access.users`,
  `roleStore.ts`), otherwise `viewer` for an allowed domain.
- **Enforcement** happens in `middleware.ts` for every `/api/*` via `can(role, requiredCapability(...))`.
  `/api/tm/*`: GET needs `view`, everything else `manage:cases`. `tmRoute` repeats the check in the Node
  runtime (session + API token).

### 3.5 Internationalisation (`i18n/`, `messages/`)

- next-intl **without a URL prefix**. The locale comes from the `NEXT_LOCALE` cookie, otherwise
  `Accept-Language`, otherwise `en`.
- Dictionaries: `messages/en.json` and `messages/uk.json` share the same key structure. Ukrainian plurals
  need `one/few/many/other`.
- Dates are formatted through `i18n/dates.ts` and the `FormattedDate` component.

### 3.6 Client

- Pages are client components in `app/<section>/page.tsx`. Shared pieces live in `app/components`, design
  primitives in `app/components/ui`.
- Data: `useQuery` / `useMutation` (`app/hooks`) on top of TanStack Query. They attach the token, redirect
  to login and show a toast on API errors. TM has `useTmMutation`, which invalidates every `/api/tm*`
  query on success.
- API errors become readable toasts (`app/lib/api-error.ts` + `useApiErrorToast`). The user never sees a
  raw response body.

### 3.7 Integrations

| Integration            | Module                  | Enabled when                                                          |
| ---------------------- | ----------------------- | --------------------------------------------------------------------- |
| Anthropic (AI summary) | `app/lib/ai`            | `ANTHROPIC_API_KEY` is set; has a circuit breaker and a prompt budget |
| Slack / webhook        | `app/lib/notifications` | channels are configured in Settings                                   |
| Drone CI               | `app/lib/drone.ts`      | `DRONE_SERVER`, `DRONE_TOKEN`, `DRONE_AUTOTESTS_REPO` are set         |

## 4. Main flows

**Result upload:** CI calls `PUT /api/result/upload` (Pages router, Busboy, streamed without buffering).
Then `service.saveResult` → storage → result metadata.

**Report generation:** `POST /api/report/generate {resultsIds, project}` → `storage.generateReport`
(merge through Playwright) → cache → AI summary → notifications.

**Manual run:**

1. `POST /api/tm/projects/:key/runs {name, source, assignee}` selects cases (all / suites / tags /
   selected), skipping deleted and `deprecated` ones, and stores snapshots.
2. The tester sets results: `PATCH /api/tm/runs/:id/cases/:rcId {result, comment, assignee}`. The server
   records who (`result_by`) and when (`result_at`).
3. `PATCH /api/tm/runs/:id {status:'completed'}` completes the run. Results can't be changed afterwards.

## 5. Deployment

- Docker image (`Dockerfile`): Next standalone. Host details: [deploy/README.md](../deploy/README.md).
- `master` → Drone (`.drone.yml`) updates part of the host's `.env` from secrets and restarts via
  `deploy/redeploy.sh`. The rest of `.env` is maintained by hand on the host.
- Data (`data/`) is a volume on the host. The test-management SQLite file lives there too, so backing up
  `data/` covers reports, settings and test cases.

## 6. Known limitations and debt

- No mobile layout: the sidebar doesn't collapse on narrow screens.
- No per-project permissions in TM: roles are global.
- 17 legacy ESLint warnings (formatting and import order) outside TM.
- TM stage 2 (linking cases to automated tests) is not implemented yet.
