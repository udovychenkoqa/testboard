# AGENTS.md

Guide for AI coding agents (Claude Code, Codex, Cursor, …) and new contributors.
Read this first; the linked docs go deeper.

Testboard is an internal QA dashboard: it stores Playwright results uploaded by CI, generates and serves
HTML reports, shows trends, triggers autotest builds in Drone, and manages manual test cases and runs
(Qase-style). Next.js 14 App Router + React 18 + HeroUI + Tailwind; data on disk/S3/Azure plus SQLite for
test management. Node ≥ 22 (`.nvmrc`).

| Topic                                                    | Doc                                                    |
| -------------------------------------------------------- | ------------------------------------------------------ |
| Layers, data flow, auth, storage, test management        | [docs/architecture.md](docs/architecture.md)           |
| How to write code here (TS, React, API routes, i18n, UI) | [docs/coding-guidelines.md](docs/coding-guidelines.md) |
| Unit and e2e tests, TDD, verification                    | [docs/testing.md](docs/testing.md)                     |
| Branches, commits, reviews, secrets, deploy              | [docs/workflow.md](docs/workflow.md)                   |
| Deploying to the host                                    | [deploy/README.md](deploy/README.md)                   |

## Commands

```bash
npm run dev            # dev server on :3000, data in ./data
npm run test:unit      # Jest, tests/unit/** (fast, ~1 s)
npm run i18n:check     # only the translation tests
npm run test:e2e       # Playwright; starts its OWN server on :3100 with throwaway data
npx tsc --noEmit -p .  # type check (no npm script)
npm run lint           # ESLint; 0 errors required, warnings are tolerated legacy
```

Before saying a change is done: `test:unit`, `tsc`, `lint` (no new errors) and, for UI or routing changes,
`test:e2e`.

## Hard rules

- **Never** commit, print or paste secrets. `.env` holds real tokens; `.env.example` holds placeholders only.
  Mask `*_TOKEN`, `*_SECRET`, `*_KEY` values in any output.
- **Never** push, merge into `master`, rewrite history or force-push without the owner asking. `master`
  auto-deploys (`.drone.yml`).
- Work on a branch (`feat/…`, `fix/…`), never directly on `master`.
- Every user-visible string goes through `messages/en.json` **and** `messages/uk.json`. A unit test fails
  on hard-coded text in `app/**/*.tsx`.
- Client components must not import server modules (`app/lib/service`, `app/lib/storage`, `app/lib/tm/*`
  repos, `better-sqlite3`). Use `import type` or the client-safe `app/lib/tm/constants.ts`.
- Access rules live in one place: `app/lib/access.ts` (`can()`, `requiredCapability()`), enforced by
  `middleware.ts`. UI hiding is cosmetic; the API must enforce.
- Don't run a second dev server on :3000 (the owner's), and don't let tooling touch `./data` (real data).

## Gotchas

- Any file named `route.ts` under `app/` becomes an API route. Shared route helpers go elsewhere
  (`app/lib/tm/handler.ts`).
- `next dev` with a custom `NEXT_DIST_DIR` rewrites `tsconfig.json` (adds `.next-*/types`). After such a
  run: `git checkout tsconfig.json` and delete the `.next-*` dir.
- `.prettierrc` (printWidth 120) wins over `prettier.config.js`; format with `npx eslint --fix`.
- `DATA_DIR` may be relative or absolute; it is resolved with `path.resolve` (`app/lib/storage/constants.ts`).
- Result upload lives in the **Pages** router (`pages/api/result/upload.ts`) because it streams multipart
  bodies with Busboy; don't move it to App Router.
- `better-sqlite3` is native: it is listed in `serverComponentsExternalPackages` and the Docker deps stage
  needs `python3 make g++`.
- HeroUI `Button as={NextLink}` renders `<a role="button">`; query it by text or `button` role in tests.
- ESLint forbids `autoFocus` (`jsx-a11y/no-autofocus` is an error).
- `/run-tests` is a redirect to `/runs/automated`; Test Runs has Manual and Automated tabs.

## Conventions in one breath

TypeScript strict, functional React components, named exports for components, `@/` absolute imports,
zod at API boundaries, small focused files, comments explain _why_ (not what), Ukrainian-speaking owner
but English code, comments and commit messages.
