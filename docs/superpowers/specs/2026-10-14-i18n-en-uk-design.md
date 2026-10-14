# Testboard UI in English and Ukrainian — design

Date: 2026-10-14 · Branch: `feat/i18n-en-uk` (on top of `feat/testboard-rebrand`)

## Goal

Every person using Testboard can read its interface in English or Ukrainian.
The choice is per viewer, needs no setup, and survives reloads. Text the
server sends to everyone (Slack, delivery log, AI analysis) uses one language:
English.

Success looks like:

- A viewer whose browser prefers Ukrainian sees the whole UI in Ukrainian on
  first load, with no English flash.
- Anyone can switch language from the user menu (or on the login page) and the
  page re-renders in place, keeping the choice for later visits.
- Counts read naturally in both languages ("1 прогін / 2 прогони / 5 прогонів").
- Dates follow the UI language ("Today, 18:46 · 8 Jul" / "Сьогодні, 18:46 · 8 лип.").
- A missing or malformed translation fails a check before deploy, never shows
  up as a blank or a raw key in the UI.

## Decisions (agreed)

| Topic | Decision |
|---|---|
| Scope | UI only is translated per viewer. Slack messages, delivery-log details and AI analysis switch to English for everyone. |
| Default language | From the browser (`Accept-Language`): first preference `uk*` → Ukrainian, anything else → English. A manual choice overrides it. |
| Dates | Follow the UI language. |
| Library | `next-intl` 3.x (3.26.5 supports Next 14.2 / React 18) in "without i18n routing" mode — no `/uk/...` URL prefixes. |

## Architecture

### Locale resolution

`i18n/request.ts` (`getRequestConfig`) resolves the locale per request:

1. `NEXT_LOCALE` cookie, if it holds a supported locale (`en` | `uk`).
2. Otherwise `Accept-Language`: Ukrainian when the highest-weighted language
   starts with `uk`, else English.

It loads `messages/<locale>.json`. The server cannot know the viewer's time
zone, so dates keep being formatted on the client (as today) with the active
locale; next-intl's own date formatter is not used for timestamps.

`next.config.js` wraps the existing config with `createNextIntlPlugin()`.
`app/layout.tsx` wraps the tree in `NextIntlClientProvider` with the resolved
messages and sets `<html lang>` to the locale. Reading the cookie makes
rendering dynamic — already the case because of auth.

### Switching

- A server action `setLocale(locale)` writes `NEXT_LOCALE` (1 year,
  `SameSite=Lax`, path `/`, respecting the existing base path) after
  validating it against the supported list.
- The client calls it, then `router.refresh()` — no full reload, no URL change.
- UI: a "Language: English / Українська" item in the existing user menu; a
  compact EN / UK toggle in the corner of the login page (no user menu there).

### Messages

- `messages/en.json` (source of truth) and `messages/uk.json`, namespaced by
  area: `common`, `nav`, `login`, `reports`, `results`, `trends`, `runTests`,
  `settings`, `report`, `emptyStates`, `dates`.
- ICU syntax for plurals and placeholders, e.g.
  `"runs": "{count, plural, one {# прогін} few {# прогони} many {# прогонів} other {# прогону}}"`.
- Type safety: `global.d.ts` declares `IntlMessages` from `en.json`, so an
  unknown key is a TypeScript error.
- Ukrainian wording for strings that were Ukrainian before today's English
  pass (Settings, Run Tests) is restored from git history so it reads as it did.

### Dates and numbers

`UI_LOCALE` (constant `en-GB`) is replaced by the active locale
(`useLocale()`): `en` formats as `en-GB` (day-month order, 24h), `uk` as `uk`.
"Today / Yesterday" and relative times ("5 min ago") come from the `dates`
namespace with plurals. Affected: `date-format.tsx`, reports-table day headers,
trend chart axis/tooltip, Run health tooltips, Run Tests, Settings save
indicator and delivery log.

## What is translated

All text the app itself writes: sidebar, user menu, page headers and
subtitles, filters, table headers, empty states, skeleton/loader labels,
toasts, modals, tooltips and `aria-label`s, Settings, the report page (verdict
strip, test list, test details), Trends (cards, Run health, chart), Run Tests,
login, and the browser tab `<title>` (via `getTranslations` in
`generateMetadata`).

Not translated (it is data, not UI): test titles, error messages and stack
traces, CI metadata values (env, funnel, username), project and tag names, and
the Playwright HTML report itself.

## Server-side text → English

- Slack messages in `app/lib/notifications/index.ts`: headline ("Є падіння" →
  "Failures", "Тести полагодились" → "Tests recovered"), "Відкрити репорт" →
  "Open report", field labels.
- Delivery-log `detail` strings in the same file ("канал вимкнено" →
  "channel disabled", etc.).
- AI prompts in `app/lib/ai/reportSummary.ts`: "Respond in Ukrainian" →
  "Respond in English" (both prompts; the overview prompt's heading rule
  changes to keep headings in English).
- Existing `ai-summary.md` files and old delivery-log entries are not
  rewritten; only new ones are English.

## Order of work

1. Infrastructure: dependency, `i18n/request.ts`, plugin, provider, `<html
   lang>`, `setLocale` action, user-menu and login switchers; translate
   sidebar, user menu and login. Verify end-to-end in the browser (login page
   is reachable without auth).
2. Pages, one commit each: Reports → Results → Trends → Run Tests → Settings →
   report page.
3. Dates: replace `UI_LOCALE` with the active locale; relative-time strings.
4. Server texts to English: Slack, delivery log, AI prompts.

## Verification

- `scripts/check-i18n.mjs` (`npm run i18n:check`):
  - `en.json` and `uk.json` have identical key sets;
  - every message parses as ICU (via `intl-messageformat`, already a
    `next-intl` dependency) and Ukrainian plurals cover `one/few/many/other`;
  - heuristic scan of `.tsx` for leftover hard-coded UI phrases.
- `tsc --noEmit` (typed keys) and `npm run lint`.
- Browser check in both languages for the login page by the implementer;
  authenticated pages are checked by the user in Ukrainian with screenshots
  for any layout issues.

## Risks

- Ukrainian strings run longer ("Очищення даних" vs "Data cleanup"): column
  and button widths may need adjusting per page.
- Cookie read on every request: no change in practice (pages are already
  dynamic because of auth).
- Server time zone vs viewer time zone: keep formatting dates on the client as
  today to avoid hydration mismatches.

## Out of scope

- More than two languages (the setup allows adding one later by dropping in a
  JSON file and extending the supported list).
- Per-account language stored server-side.
- Translating Slack/AI output per recipient.
