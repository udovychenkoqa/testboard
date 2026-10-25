# Coding guidelines

These are the conventions the repo already follows, plus lessons learned the hard way. ESLint and Prettier
check formatting on their own; this covers what the tools don't catch.

## 1. Principles

1. **Simple beats flexible.** Build for the real need, not a hypothetical future one (YAGNI). Introduce an
   abstraction at the second use, not the first.
2. **One file, one responsibility.** Split a large file by meaning, not by kind of code.
3. **Explicit boundaries.** UI → API → service/repository → storage. A layer doesn't skip its neighbour or
   pull dependencies upward.
4. **Errors stay visible.** Never swallow exceptions silently. Handle them meaningfully or pass them on
   with context.
5. **Users never see internals.** No stack traces, raw response bodies or SQL — only clear messages from
   the dictionary.
6. **Secure by default.** Access is checked on the server. Unconfigured setups fail closed, not open
   (Google with no domains lets nobody in). Secrets never end up in code, logs or responses.
7. **Match the code next door.** Before writing, look at how it's done nearby and follow the same style,
   names and idioms.

## 2. TypeScript

- `strict` is on. `any` only at the edge of untyped code, with a comment saying why.
- Describe data with `interface` (objects) and `type` (unions). Enums are an `as const` array plus a
  derived type:
  ```ts
  export const RESULTS = ['untested', 'passed', 'failed', 'blocked', 'skipped'] as const;
  export type Result = (typeof RESULTS)[number];
  ```
- Absolute imports via `@/` (`@/app/lib/...`); relative ones only within a module (`./errors`). Use
  `import type` for types.
- Import order: external packages → `@/` → relative, with a blank line between groups (`import/order`).
- Unused variables and imports are lint errors. Don't leave commented-out code.
- Read env values only through `app/config/env.ts` (`envalid`), not `process.env` in random places. The
  exception is low-level constants that must work before env is initialised.

## 3. API routes

- A route is **thin**: parse input → call a service/repository → return a response. No business logic in
  `route.ts`.
- Every route has `export const dynamic = 'force-dynamic'`.
- Validate input with a **zod schema** (`app/lib/tm/schemas.ts` is the model). Never trust a request body.
- Statuses: `400` invalid input, `403` no permission, `404` not found, `409` conflict (duplicate,
  non-empty project), `500` unexpected, with the text `internal error` and no details.
- Test management: wrap the route in `tmRoute()` and throw `TmError(code, message)`. The wrapper maps the
  error to a status.
- Older report routes use `withError()`. New code there follows the same style; when refactoring, move to
  explicit statuses.
- Every new privileged endpoint **must** be added to `requiredCapability()` (`app/lib/access.ts`) along
  with a test in `tests/unit/tm/access.test.ts`. Otherwise any signed-in user can call it.
- Don't create helper files named `route.ts` anywhere a route isn't actually wanted.

## 4. Data

- **SQLite:** parameterised queries only (`?`), never concatenate values into SQL. For `IN (...)` generate
  placeholders (`inList(n)`).
- Several related writes go in one transaction (`db.transaction(() => { ... })()`).
- Change the schema **only with a new migration** appended to `MIGRATIONS`. Never edit old migrations:
  production has already run them.
- Repositories take `db` as their first parameter, so tests can use an in-memory or temporary database.
- Report storage: only through the `Storage` interface or `service`. Code must work on FS, S3 and Azure.
- Large files go through streams (`PassThrough`, `pipeline`), not buffered in memory.

## 5. React and UI

- Function components with named exports (`export const CaseList: React.FC<Props> = ...`). Pages
  (`page.tsx`) use `export default function`.
- `'use client'` only where hooks or interactivity are needed.
- **Client code doesn't import server modules** (`service`, `storage`, `tm/db`, `tm/cases`, etc.);
  `import type` is fine. UI enums come from `app/lib/tm/constants.ts`.
- Fetch data with `useQuery`/`useMutation`/`useTmMutation`, not bare `fetch`. That gives you the token,
  the login redirect and error toasts.
- Wrap `useSearchParams` in a page with `<Suspense>`, otherwise the build fails.
- Every list has **three states**: loading (`GridSkeleton`/skeleton), empty (`EmptyState` with an action),
  data. An error must not leave an endless skeleton.
- The UI kit is HeroUI (`@heroui/react`); our own primitives live in `app/components/ui`. Add a new
  primitive there only once it's needed in two or more places.
- Style with Tailwind classes; colours via theme tokens (`primary`, `default-500`, `content1`, `divider`,
  `success/danger/warning`), not hex. Dark mode should work with no extra effort.
- Font sizes in dense lists follow neighbouring components (`text-[13px]`, `text-[11.5px]`).
- Accessibility: interactive things are buttons or links, not a `div` with `onClick`; icon buttons have
  `aria-label`; `autoFocus` is forbidden. An eslint-disable exception is allowed only with a comment
  explaining why.
- UI permissions (`useCanManageCases`) only hide buttons. The real protection is on the server.

## 6. Text and i18n

- Every visible string is a key in `messages/en.json` **and** `messages/uk.json`, with the same structure.
- Group keys by section (`tm.runs.*`, `settings.*`), name them in `camelCase`.
- Plurals use ICU: `{count, plural, one {# case} other {# cases}}`. Ukrainian needs `one/few/many/other`.
- Proper names and technical tokens (`Testboard`, `Slack`, `API`) may stay as they are. Mark an exception
  in JSX with `// i18n-ignore — reason`.
- Show dates through `FormattedDate` or `i18n/dates.ts`, not `toLocaleString`.

## 7. Errors and logging

- Server: `console.log('[module] ...')` with a module prefix. Never log tokens, keys, `.env` contents, or
  request bodies with personal data.
- Client: `useApiErrorToast` shows API errors. Success messages use `toast.success(t('...'))`.
- Don't retry a request that can't succeed on a second try (404): `retry: false`.

## 8. Comments and naming

- A comment explains **why** (a constraint, a decision, a pitfall), not what a line does.
- Names are descriptive and domain-based: `createRun`, `suiteSubtreeIds`, `RunCaseView`. Booleans start
  with `is/has/can`.
- Code, comments, commit messages and docs are in English.

## 9. Dependencies

- Add a dependency only if a few lines of code can't replace it. Check peer dependencies (React 18!) and
  native builds (Docker).
- Versions are pinned through `package-lock.json`; `npm i` without `--legacy-peer-deps`.

## 10. Pre-commit checklist

- [ ] `npm run test:unit` is green
- [ ] `npx tsc --noEmit -p .` has no errors
- [ ] `npm run lint` — 0 errors, no new warnings
- [ ] UI or routing changed → `npm run test:e2e` and a look in the browser
- [ ] New strings are in both dictionaries
- [ ] New privileged endpoints are in `requiredCapability()`
- [ ] `tsconfig.json` not changed by accident, temporary `.next-*` dirs removed
- [ ] No secrets in the diff
