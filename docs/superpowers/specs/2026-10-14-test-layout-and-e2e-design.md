# Test layout and Playwright e2e — design

Date: 2026-10-14

## Goal

Tests live in one place, split by kind, and the authenticated UI — which so far
could only be checked by hand — is covered by Playwright end-to-end tests that
run against an isolated server and never touch real data.

Success looks like:

- `npm run test:unit` runs the existing Jest tests from `tests/unit/`.
- `npm run test:e2e` starts its own server, signs in, and checks login, both
  languages, empty states and error toasts — without touching `data/`, the
  developer's `.env` or a dev server already running on port 3000.
- No dangling scripts (`test:api`, `test:ui` point at a config that no longer exists).

## Decisions (agreed)

| Topic | Decision |
|---|---|
| Unit tests | Stay on Jest (pure functions, `jest.mock` for `next/headers`); move to `tests/unit/`. |
| E2E | Playwright Test, Chromium only (already installed: chromium-1194 for Playwright 1.56.1). |
| Visual snapshots | Out of scope (no `toHaveScreenshot`). |
| Old API tests | Not restored. |

## Layout

```
tests/
  unit/                 Jest — i18n/*, api-error
  e2e/
    fixtures/blob.zip   Playwright blob (from this repo's history, a70a07e^:tests/testdata/correct_blob.zip)
    global-setup.ts     fresh data dir, upload blob, generate a report
    auth.setup.ts       sign in with the test API key → storage state
    *.spec.ts
playwright.config.ts    e2e config (root; the server's merge uses its own temp config, so no clash)
```

## Isolated server

Playwright's `webServer` starts `next dev -p 3100` with:

| Env | Value | Why |
|---|---|---|
| `DATA_DIR` | `tests/e2e/.data` | wiped by global setup; real `data/` untouched |
| `NEXT_DIST_DIR` | `.next-e2e` | two dev servers on one `.next` corrupt each other |
| `API_TOKEN` / `AUTH_SECRET` | fixed test values | never the developer's secrets |
| `AUTH_GOOGLE_ID/SECRET` | empty | API-key login only |
| `DRONE_SERVER` | `http://drone.invalid` (+ token/repo) | `.invalid` never resolves → deterministic "unreachable" toast |
| `ANTHROPIC_API_KEY` | empty | no AI calls |

App changes to support it:

- `app/lib/storage/constants.ts`: `DATA_PATH = process.env.DATA_DIR || 'data'`.
- `next.config.js`: `distDir: process.env.NEXT_DIST_DIR || '.next'`.
- `.gitignore`: `tests/e2e/.data`, `.next-e2e`, `playwright-report`, `test-results`, `tests/e2e/.auth`.

Env precedence: Next.js does not override variables already set in the
process, so the webServer env wins over `.env`.

## Specs

- `auth.spec.ts` — signed-out visit redirects to `/login`; wrong key shows the
  error; correct key lands on the app.
- `i18n.spec.ts` — `Accept-Language: uk` opens Ukrainian (`<html lang="uk">`);
  EN/UK switch flips text without a full reload and persists after reload;
  key pages (Reports, Trends, Settings, a report) show Ukrainian headings.
- `pages.spec.ts` — Reports, Results, Trends, Run Tests, Settings and a report
  render their heading with no console errors, in both languages.
- `empty-states.spec.ts` — a search with no matches shows the "no matching"
  state; Clear filters brings the list back.
- `toasts.spec.ts` — starting a run with Drone unreachable shows the
  translated "couldn't reach an external service" toast, not raw JSON.

## Verification

`npm run test:unit`, `npm run test:e2e`, `tsc`, `npm run lint` green; `git status`
shows no files under `data/` changed after an e2e run.

## Risks

- Report generation runs `npx playwright merge-reports` with the local
  Playwright (no `playwrightVersion` sent) — no network; if merging the 1.54
  blob fails, global setup fails loudly rather than tests silently skipping.
- First `next dev` compile of each page is slow: generous timeouts on the
  webServer and first navigations.
