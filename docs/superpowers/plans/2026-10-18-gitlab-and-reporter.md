# Testboard reporter and GitLab runs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Cyborg reporter with our own `@testboard/reporter`, move autotest runs from Drone to GitLab pipelines, and move Testboard's deploy from Drone to GitLab CI.

**Architecture:** The reporter is a zero-dependency workspace package in `packages/reporter`, tested from the root Jest suite. A server-only GitLab client (`app/lib/gitlab.ts`) plus a SQLite record of the pipelines Testboard started (new migration in `app/lib/tm/migrations.ts`) back the existing provider-neutral `/api/autotests/*` routes. `run-tests.tsx` keeps its list and replaces the Drone form with the autotests' pipeline inputs. `.gitlab-ci.yml` replaces `.drone.yml`.

**Tech Stack:** Next.js 14, TypeScript, zod 4, better-sqlite3, Jest, Playwright, GitLab REST v4, GitLab CI.

**Spec:** `docs/superpowers/specs/2026-10-18-gitlab-and-reporter-design.md`

## Global Constraints

- The reporter matches Cyborg 2.6.1 (`~/Desktop/autotests/node_modules/@cyborgtests/reporter-playwright-reports-server/dist/index.js`) option for option and request for request. Where they differ, Cyborg wins.
- Reporter failure = throw from `onEnd` with a `[TestboardReporter]` message (same as Cyborg).
- Reporter has zero runtime dependencies; peer `@playwright/test >=1.37`.
- `GITLAB_TOKEN` never reaches the browser, a response body or a log line.
- Routes keep their paths: `/api/autotests/{builds,trigger,cancel}` (+ new `rerun`). Access stays `run:tests` for trigger/cancel/rerun.
- Form inputs = autotests `.gitlab-ci.yml` inputs: shown `env` (`prod|stage|dev`, default `prod`), `mode` (`by tag|smoke|regression`, default `by tag`), `tag` (default `@smoke`); Advanced: `qase_run_id`, `qase_id`, `force_snapshots_recollection` (default false), `skip_visual_checks` (default true).
- All copy in `messages/en.json` + `messages/uk.json`. Docs and code in English.
- Nothing Drone-related remains in code, config, copy or docs (old specs/plans under `docs/superpowers` are history and stay).
- Testboard work on branch `feat/gitlab-reporter`; autotests work on branch `feat/testboard-reporter` in `~/Desktop/autotests`. No pushes, no merges.

## Review Focus

1. GitLab returns non-JSON or HTML (proxy error page) → readable error, no crash, no token in the message (Task 2 test).
2. A pipeline started outside Testboard (no stored record) → list shows GitLab's user, rerun falls back to GitLab retry (Task 3 + 4 tests).
3. `mode` ≠ `by tag` with a tag filled in → the tag is still sent but the summary shows the mode (UI); server accepts any combination the pipeline accepts (Task 4 test: schema accepts).
4. Reporter in a sharded run must NOT call `/api/report/generate` (Task 1 test).
5. Unconfigured GitLab → builds returns `{enabled:false}`, trigger/cancel/rerun 503, tab shows "not configured" (Task 4 test, Task 6 e2e).

---

### Task 0: Housekeeping commit

- [ ] Commit the pending docs on `feat/gitlab-reporter`: `AGENTS.md`, `CLAUDE.md`, `docs/{architecture,coding-guidelines,testing,workflow}.md`, `deploy/README.md`, `app/lib/access.ts` comment, the spec and this plan. Message `docs: agent guide, architecture and coding docs; GitLab/reporter spec and plan`.

### Task 1: `@testboard/reporter` package

**Files:** Create `packages/reporter/{package.json,tsconfig.json,README.md,src/index.ts}`, `tests/unit/reporter/reporter.test.ts`. Modify root `tsconfig.json` (exclude `packages/*/dist`), root `package.json` (drop `@cyborgtests/reporter-playwright-reports-server`).

**Interfaces — Produces:** default export `class TestboardReporter implements Reporter` with options `{ enabled?, url, token?, reportPath, requestTimeout?, blobUploadTimeout?, resultDetails?: Record<string,string|undefined>, triggerReportGeneration?, logProgress? }`.

- [ ] **Write failing tests** (`node:http` stub server on a random port, temp blob file):
  - `uploads the blob with details, auth and size` — PUT `/api/result/upload?fileContentLength=<size>`, `Authorization: tok`, multipart fields = resultDetails + `playwrightVersion` + `triggerReportGeneration`, file field named as Cyborg names it.
  - `adds shardCurrent/shardTotal and does not call generate when sharded`.
  - `calls generate once when not sharded and triggerReportGeneration` — body `{resultsIds:[id], ...details, playwrightVersion}`.
  - `throws [TestboardReporter] when the blob is missing` / `on upload 500` / `on generate 500`.
  - `does nothing when enabled=false`; `constructor throws without url or reportPath when enabled`.
- [ ] Run `npx jest tests/unit/reporter` → FAIL (module missing).
- [ ] Implement `src/index.ts` by porting Cyborg's `dist/index.js` logic (streamed multipart, timeout via AbortController, `duplex:'half'`), logging prefix `[TestboardReporter]`.
- [ ] `package.json`: name `@testboard/reporter`, version `0.1.0`, `main: dist/index.js`, `types: dist/index.d.ts`, `files: [dist, README.md]`, `peerDependencies: {"@playwright/test": ">=1.37"}`, `scripts.build: tsc -p .`, `publishConfig` left for CI. `tsconfig.json`: CommonJS, ES2022, declaration, outDir `dist`, rootDir `src`.
- [ ] README: install (`.npmrc` with `@testboard:registry=<GITLAB_URL>/api/v4/projects/<id>/packages/npm/` + `//…:_authToken=${NPM_TOKEN}`), options table, "switch back to Cyborg" section.
- [ ] Run tests → PASS; `npm run build --prefix packages/reporter` succeeds; root `tsc` clean.
- [ ] Commit `feat(reporter): @testboard/reporter, a drop-in for the Cyborg reporter`.

### Task 2: GitLab client

**Files:** Create `app/lib/gitlab.ts`, `tests/unit/lib/gitlab.test.ts`. Modify `app/config/env.ts` (remove `DRONE_*`, add `GITLAB_URL`, `GITLAB_TOKEN`, `GITLAB_AUTOTESTS_PROJECT`, `GITLAB_REF` default `main`).

**Interfaces — Produces:**
```ts
export type RunStatus = 'pending' | 'running' | 'success' | 'failure' | 'killed' | 'skipped';
export interface Pipeline { id: number; iid: number; status: RunStatus; user?: string; createdAt: string; startedAt?: string; finishedAt?: string; duration?: number; link: string }
export const isGitlabConfigured: () => boolean;
export const createPipeline: (inputs: Record<string, string | boolean>) => Promise<Pipeline>;
export const listPipelines: (page: number, perPage: number) => Promise<{ pipelines: Pipeline[]; total: number }>;
export const cancelPipeline: (id: number) => Promise<void>;
export const retryPipeline: (id: number) => Promise<Pipeline>;
```
Status map: `created|waiting_for_resource|preparing|pending|scheduled|manual → pending`, `running → running`, `success → success`, `failed → failure`, `canceled|canceling → killed`, `skipped → skipped`. Project is URL-encoded. Auth header `PRIVATE-TOKEN`. `total` from `X-Total` (fallback: page length). Errors: `GitLab API <status>: <first 300 chars of body>` with the token value redacted.

- [ ] **Failing tests** (mock `global.fetch`): create sends `POST …/projects/group%2Fautotests/pipeline` with `{ref, inputs}`; list maps fields + `X-Total`; cancel/retry hit the right URLs; each status maps; HTML 502 body → Error without the token string; `isGitlabConfigured` false when any of the three is missing.
- [ ] Implement; tests PASS. Commit `feat(autotests): GitLab pipeline client`.

### Task 3: Record of pipelines started from Testboard

**Files:** Modify `app/lib/tm/migrations.ts` (append migration 2). Create `app/lib/autotests/pipelines.ts`, `tests/unit/lib/autotest-pipelines.test.ts`.

Migration 2: `CREATE TABLE autotest_pipelines (pipeline_id INTEGER PRIMARY KEY, started_by TEXT, inputs TEXT NOT NULL, created_at TEXT NOT NULL)`.

**Produces:** `recordPipeline(db, {pipelineId, startedBy, inputs})`, `getPipelineRecords(db, ids: number[]): Map<number, {startedBy: string|null; inputs: Record<string,string|boolean>}>`.

- [ ] Failing tests on `openDb(':memory:')`: record + read back; unknown ids absent; `user_version` is 2 after migrate. Implement; PASS. Commit `feat(autotests): remember who started a pipeline and with what inputs`.

### Task 4: Routes

**Files:** Rewrite `app/api/autotests/{builds,trigger,cancel}/route.ts`; create `app/api/autotests/rerun/route.ts`, `app/lib/autotests/schema.ts`; modify `app/lib/access.ts` (`/api/autotests/rerun` POST → `run:tests`), `tests/unit/tm/access.test.ts`; delete `app/lib/drone.ts`. Create `tests/unit/lib/autotests-schema.test.ts`.

**Produces** (shape the UI consumes):
```ts
// GET /api/autotests/builds?page=N
{ enabled: boolean; page?: number; perPage?: number; total?: number; error?: string;
  builds: Array<Pipeline & { startedBy?: string; viaCi: boolean; inputs?: Record<string, string|boolean> }> }
// POST /api/autotests/trigger  body = TriggerInputs   → { build, link }
// POST /api/autotests/cancel   { id }                 → { ok: true }
// POST /api/autotests/rerun    { id }                 → { build, link }
```
`TriggerInputs` (zod, `schema.ts`): `env` enum, `mode` enum, `tag` string ≤200, `qase_run_id` digits-or-empty, `qase_id` `^[\d,\s]*$`, `force_snapshots_recollection` bool, `skip_visual_checks` bool; defaults from Global Constraints. Option lists exported from `app/lib/autotests/inputs.ts` (client-safe) and used by both schema and UI.

- [ ] Failing tests: schema defaults/rejections; access test `POST /api/autotests/rerun → run:tests`. Implement routes: unconfigured → builds `{enabled:false,builds:[]}`, others 503; trigger records `{pipelineId, startedBy: session name/email, inputs}`; builds joins records (`startedBy = record ?? pipeline.user`, `viaCi = !record`); rerun = `createPipeline(record.inputs)` when a record exists, else `retryPipeline(id)`; GitLab errors → 502 with the sanitised message.
- [ ] `tsc` clean, unit PASS. Commit `feat(autotests): run autotests through GitLab pipelines`.

### Task 5: Automated tab UI

**Files:** Modify `app/components/run-tests.tsx`, `messages/{en,uk}.json` (`runTests.*`), `app/runs/{layout,automated/page}.tsx` comments, `tests/unit/i18n/hardcoded-strings.test.ts` (allow `GitLab`, drop `Drone`), `app/lib/api-error.ts` comment.

- [ ] Replace ENVIRONMENTS/COUNTRIES/funnel/A-B/locale state with the inputs from `app/lib/autotests/inputs.ts`: env select, mode segmented/select, tag input + presets (`@smoke`, `@core-regression`, `@api`, `@visual`; disabled unless mode `by tag`), "Advanced" collapsible with the four advanced inputs. Persist prefs in localStorage as today (`run-tests-prefs`, new shape; ignore old shape).
- [ ] List: `#iid` link "Open in GitLab", status via the RunStatus map, params chips = env · mode · tag, started by / CI badge, started, duration (from `startedAt/finishedAt/duration`), cancel when active, rerun posts `/api/autotests/rerun`. Env filter uses the new env list. Polling every 10 s while any is active (as today).
- [ ] Messages: drop funnel/country/A-B/usCa/usNv keys; add mode, mode options, advanced input labels/hints, `openInGitlab`, `notConfiguredDescription` naming `GITLAB_URL, GITLAB_TOKEN and GITLAB_AUTOTESTS_PROJECT`, `buildStarted: "Pipeline #{number} started"`. uk plurals complete.
- [ ] `npm run test:unit`, `tsc`, lint (TM/new files 0 warnings). Browser check on isolated :3200 server: unconfigured state; with `GITLAB_URL=http://gitlab.invalid` + dummy token/project → form renders, Run shows the "unreachable" toast. Commit `feat(autotests): GitLab run form and history`.

### Task 6: E2E

**Files:** Modify `playwright.config.ts` (replace `DRONE_*` with `GITLAB_URL: 'http://gitlab.invalid'`, `GITLAB_TOKEN: 'e2e-gitlab-token'`, `GITLAB_AUTOTESTS_PROJECT: 'e2e/autotests'`), `tests/e2e/toasts.spec.ts` (comment + still clicks Run), create `tests/e2e/autotests.spec.ts`.

- [ ] New spec: Automated tab shows Environment, Mode, Tag; Advanced reveals Qase run ID and Skip visual checks; no Funnel/Country text. Run `npm run test:e2e` → all green. Commit `test(e2e): GitLab autotests form`.

### Task 7: GitLab CI for Testboard, Drone gone

**Files:** Create `.gitlab-ci.yml`; delete `.drone.yml`; modify `.env.example`, `deploy/README.md`, `deploy/redeploy.sh` (comments), `AGENTS.md`, `docs/{architecture,workflow,testing}.md`.

- [ ] `.gitlab-ci.yml` stages `deploy`, `publish`:
  - `update-env` (`alpine:3.20`, `rules: if $CI_COMMIT_BRANCH == "master"`): same SSH/known_hosts setup as Drone; writes `ANTHROPIC_API_KEY, ANTHROPIC_MODEL, GITLAB_URL, GITLAB_TOKEN, GITLAB_AUTOTESTS_PROJECT, GITLAB_REF, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_ALLOWED_DOMAINS, AUTH_ADMIN_EMAILS` from CI variables `TB_*`; the remote `grep -v` also strips the old `DRONE_*` lines.
  - `deploy` (needs update-env): `ssh … 'bash /home/dev0ps/testboard/repo/deploy/redeploy.sh && docker image prune -f'`, `timeout: 10m`.
  - `healthcheck` (`curlimages/curl:8.7.1`): same curl as Drone with `$HEALTH_URL`.
  - `publish-reporter` (`node:22`, `rules: if $CI_COMMIT_TAG =~ /^reporter-v/`): `cd packages/reporter && npm ci --ignore-scripts || true; npx tsc -p . && echo "@testboard:registry=${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/npm/" > .npmrc && echo "${CI_API_V4_URL#https?:}/projects/${CI_PROJECT_ID}/packages/npm/:_authToken=${CI_JOB_TOKEN}" >> .npmrc && npm publish`; version must equal the tag suffix (check, fail otherwise).
  - Header comment lists every CI/CD variable (masked + protected) and the owner actions from the spec.
- [ ] Validate YAML parses (`npx yaml valid`/`node -e` with `yaml`); `grep -ri drone` over code/config/docs (excluding `docs/superpowers`, `node_modules`) returns nothing.
- [ ] Docs: replace Drone mentions; `deploy/README.md` gets "Moving to GitLab" owner checklist (CI variables, repoint host clone `origin`, runner SSH reach). Commit `ci: deploy Testboard and publish the reporter from GitLab CI; remove Drone`.

### Task 8: Autotests switch (`~/Desktop/autotests`, branch `feat/testboard-reporter`)

**Files:** Modify `package.json`, `playwright.config.ts`, `.gitignore` (none needed if `.npmrc` has no secret), `CLAUDE.md` line 230, `docs/ci-pipeline.md`; create `.npmrc`.

- [ ] `.npmrc`: `@testboard:registry=${TESTBOARD_NPM_REGISTRY}` and `${TESTBOARD_NPM_REGISTRY_AUTH}:_authToken=${CI_JOB_TOKEN}` style lines using env vars only (no host or token committed); document the two variables in `docs/ci-pipeline.md` and `.env.example`.
- [ ] `playwright.config.ts`: reporter name `@cyborgtests/reporter-playwright-reports-server` → `@testboard/reporter`; options unchanged.
- [ ] `package.json`: replace the dev dependency with `"@testboard/reporter": "0.1.0"`. **Do not** regenerate `yarn.lock` against the registry (it doesn't exist yet).
- [ ] Local verification without committing: `yarn add -D file:<abs path>/packages/reporter` (after `npm run build` there), start isolated Testboard on :3200, run one read-only smoke test with `REPORTS_SERVER_URL=http://localhost:3200 REPORTS_SERVER_TOKEN=<made-up>` and `--grep "log in: modal opens from header"`; confirm the result appears in `/api/result/list` and the reporter logs the report URL. Then restore `package.json`/`yarn.lock` to the committed state (`git checkout package.json yarn.lock` after re-applying the version edit).
- [ ] Commit in autotests: `chore: switch to @testboard/reporter (needs the GitLab registry before merge)` with a body listing the follow-up (`yarn add -D -E @testboard/reporter@0.1.0` once published).

### Final

- [ ] Full Testboard checks: `npm run test:unit`, `npm run test:e2e`, `tsc`, `npm run lint` (0 errors).
- [ ] Whole-branch self-review against spec + Review Focus; fixes via TDD.
- [ ] Report to owner: rulings, deferred minors, owner follow-ups (GitLab URL, project id, CI variables, host repoint, publish tag `reporter-v0.1.0`, regenerate autotests lockfile).
