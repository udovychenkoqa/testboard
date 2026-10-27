# Testing

## Test levels

| Level | Where           | With               | Covers                                               |
| ----- | --------------- | ------------------ | ---------------------------------------------------- |
| Unit  | `tests/unit/**` | Jest (`next/jest`) | Pure logic: TM repositories, access, i18n, utilities |
| E2E   | `tests/e2e/**`  | Playwright         | User flows through a real server and browser         |

Components aren't tested in isolation; e2e flows cover them. Logic inside a component that's worth testing
gets extracted into a function with a unit test.

## Unit

```bash
npm run test:unit                       # everything (~1 s)
npx jest tests/unit/tm/runs.test.ts     # one file
npm run i18n:check                      # only dictionaries and hard-coded strings
```

- TM repositories are tested on real SQLite, in memory (`openDb(':memory:')`) or in a temporary file, with
  no database mocks. That way tests catch SQL mistakes too.
- i18n tests pick up new files automatically:
  - `messages.test.ts` checks that en/uk keys match and plural forms are complete;
  - `hardcoded-strings.test.ts` looks for text in `app/**/*.tsx` that bypasses the dictionary.
- The access test (`tests/unit/tm/access.test.ts`) is where every new rule in
  `can()`/`requiredCapability()` must be covered.

## E2E

```bash
npm run test:e2e                                         # everything
npx playwright test tests/e2e/test-management.spec.ts    # one file
npx playwright test -g "test name"                       # one test
```

- `playwright.config.ts` starts its **own** server, so real data and the server on `:3000` are left alone:
  - port `:3100`, `DATA_DIR=tests/e2e/.data` (wiped at start), `.next-e2e`;
  - a test `API_TOKEN`;
  - `GITLAB_URL=http://gitlab.invalid`, so the "external service unreachable" path is deterministic.
- `global.setup.ts` uploads the `fixtures/blob.zip` fixture, generates a report and signs in with the API
  token. The signed-in state is saved in `tests/e2e/.auth/`.
- `collectConsoleErrors(page)` collects console errors and 4xx/5xx responses. Pages must render without
  any.
- Set the test's language explicitly: `useLanguage(context, 'en' | 'uk', baseURL)`.

### Writing e2e tests

- Locate by role and text (`getByRole`, `getByLabel`, `getByText(..., { exact: true })`), not CSS classes.
- Use unique data per run (`Date.now()` in keys): the server may be reused.
- Wait for outcomes, not time: `expect(...).toBeVisible()` / `toHaveURL()`, never `waitForTimeout`.
- Don't call `page.goto` while the app is still navigating on its own (an aborted RSC request logs a
  console error). Wait for `toHaveURL` first.
- A HeroUI `Button as={NextLink}` has the `button` role, not `link`.

## TDD

For new logic and fixes:

1. Write a test that describes the expected behaviour.
2. Run it and **watch it fail** for the expected reason. A test that's green from the start proves nothing.
3. Write the minimal implementation.
4. Test green → whole suite green → refactor.

For a bug, first write a test that reproduces it, then fix.

## Checking the UI by hand

For changes visible in the browser, look at the result in addition to running tests:

- in light and dark theme;
- in both languages (long Ukrainian strings break layouts more often);
- with empty data, lots of data, and an error (a non-existent id).

Use an isolated server with a temporary `DATA_DIR` and its own port for this (example in
[CLAUDE.md](../CLAUDE.md)).
