# Test layout + Playwright e2e — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unit tests in `tests/unit/` (Jest), Playwright e2e in `tests/e2e/` against an isolated server.

**Spec:** `docs/superpowers/specs/2026-10-14-test-layout-and-e2e-design.md`

## Global Constraints

- E2E never touches `data/`, `.next/`, the developer's `.env` secrets, or port 3000.
- E2E server: port 3100, `DATA_DIR=tests/e2e/.data`, `NEXT_DIST_DIR=.next-e2e`, `API_TOKEN=e2e-test-token`, `AUTH_SECRET=e2e-test-secret`, `DRONE_SERVER=http://drone.invalid`.
- Chromium only; no visual snapshots.

## Review Focus

1. A failed report generation in setup must fail the run, not let specs pass on empty data.
2. A dev server already on 3000 keeps working during/after an e2e run (separate dist dir).
3. `DATA_DIR` unset → behaviour identical to today (`data/`).
4. Locale cookie from one spec must not leak into another (fresh contexts; explicit locale per test).
5. `git status` clean under `data/` after a run.

---

### Task 1: Move unit tests to `tests/unit/`

- [ ] `git mv i18n/*.test.ts tests/unit/i18n/`, `git mv app/lib/api-error.test.ts tests/unit/lib/`; fix relative imports to `@/…`.
- [ ] `jest.config.js`: `testMatch: ['<rootDir>/tests/unit/**/*.test.ts']`.
- [ ] `package.json`: `"i18n:check": "jest tests/unit/i18n"`.
- [ ] Run `npm run test:unit` → same count as before (479). Commit.

### Task 2: Configurable data dir and dist dir

- [ ] Failing test `tests/unit/lib/storage-paths.test.ts`: with `DATA_DIR` unset, `DATA_FOLDER` ends with `/data`; with `DATA_DIR=tests/e2e/.data` (fresh module via `jest.isolateModules`), it ends with `/tests/e2e/.data` and `RESULTS_FOLDER`/`REPORTS_FOLDER` sit under it.
- [ ] `constants.ts`: `export const DATA_PATH = process.env.DATA_DIR || 'data';`
- [ ] `next.config.js`: `distDir: process.env.NEXT_DIST_DIR || '.next'`.
- [ ] Green; commit.

### Task 3: Playwright config, global setup, auth setup

- [ ] `tests/e2e/fixtures/blob.zip` from `git show a70a07e^:tests/testdata/correct_blob.zip`.
- [ ] `playwright.config.ts` (root): testDir `tests/e2e`, `globalSetup`, projects `setup` (auth.setup.ts) → `chromium` (storageState `tests/e2e/.auth/user.json`, dependencies `setup`), `webServer` per constraints, `reuseExistingServer: false`, timeout 180 s.
- [ ] `global-setup.ts`: wipe and recreate `tests/e2e/.data`; wait for server; `PUT /api/result/upload` (multipart, project `e2e`); `POST /api/report/generate` with `{ resultsIds: [id], project: 'e2e' }`; throw on any non-2xx.
- [ ] `auth.setup.ts`: log in through the UI with `e2e-test-token`, save storage state.
- [ ] `.gitignore` entries; scripts `test:e2e`, remove `test:api`/`test:ui`.

### Task 4: Specs

- [ ] `auth.spec.ts`, `i18n.spec.ts`, `pages.spec.ts`, `empty-states.spec.ts`, `toasts.spec.ts` as in the spec.
- [ ] `npm run test:e2e` green; `git status -- data` empty. Commit.
