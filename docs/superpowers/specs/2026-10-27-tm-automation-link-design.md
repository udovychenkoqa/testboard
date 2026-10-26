# Test management stage 2: autotests ↔ test cases — design

Date: 2026-10-27. Status: owner skipped the Q&A and asked to proceed; every decision below is the builder's
call unless marked as the owner's, and stays open for the owner to change.

## Why

Test cases live in Testboard, and the autotests report to Testboard (not Qase). Today the two don't know
about each other: a case can't tell whether an autotest covers it or how that autotest did, and a manual run
can't take results from an automated one. The owner wants the Qase-style flow: autotests fill in the cases
they cover, inside a Testboard run, so manual and automated results sit in one run.

## Goals

1. **Link** an autotest to cases with a Playwright tag holding the case ID: `{ tag: ['@HAN-12'] }`. A test may
   carry several case tags; a case may be covered by several tests.
2. **Every report updates its cases**: each linked case remembers its latest automated result (passed / failed
   / skipped, when, which report, which tests). Cases whose automation is `manual` or `to_automate` become
   `automated`.
3. **Results into a Testboard run**: a report that carries `testboardRun` writes its linked cases' results into
   that run — an existing run id, or `new` to create one from the linked cases.
4. **Choose the run when starting autotests** from Testboard: the Automated form gets a "Testboard run"
   choice (none / new / an in-progress run). Running locally, the same value comes from an env variable.
5. **See it**: the case panel shows the latest automated result with a link to the report; run cases filled by
   autotests show who/what set them and link to the report.

## Non-goals

- Per-step results, matching tests to cases by title, Qase.
- Creating cases from autotests (an unknown `@CODE-N` tag is ignored and reported in the server log).
- Retroactively processing reports uploaded before this ships.

## Anti-goals

- Autotests overwriting a result a person set by hand in a run.
- A report failing to generate, or the report page breaking, because the case sync failed — sync errors are
  logged and isolated like the AI summary.
- Touching a completed run.

## Rules

- **Project match**: the report's `project` (CI metadata) must equal a TM project key; the tag's code must equal
  that project's code. Otherwise the tag is ignored.
- **Tag format**: `@<CODE>-<number>`, case-insensitive code, with or without the leading `@` (Playwright keeps
  the `@`).
- **Outcome per case** (several tests on one case): any `unexpected` → `failed`; else any `expected` or
  `flaky` → `passed`; else (all skipped) → `skipped`.
- **Latest automated result** is stored per case (one row, replaced on each report), with the report id and URL
  and the titles of the tests that produced it. Deleted cases are skipped.
- **Automation flag**: `manual` / `to_automate` → `automated` when a report links the case. Never the other way.
- **Run update** (`testboardRun` present):
  - numeric id of an in-progress run of the same project → for each linked case that is in the run, set the
    result unless a person already set one (`result_by` is a person, i.e. not `autotests`); result_by =
    `autotests`, comment = report URL plus failed test titles when failed.
  - `new` → create a run `Autotests · <env> · <date time>` (env from report metadata when present) from the
    linked cases, then fill it as above.
  - anything else, a completed run, or a run of another project → nothing, logged.
- **Where `testboardRun` comes from**: report metadata (the reporter's `resultDetails.testboardRun`). The
  autotests set it from the env variable `TESTBOARD_RUN`; the GitLab pipeline gets it from a new input
  `testboard_run` (default empty) that Testboard sends.

## Interfaces

- New migration: `tm_case_auto_results(case_id PRIMARY KEY, result, report_id, report_url, tests JSON,
  recorded_at)`.
- `app/lib/tm/automation.ts`: `parseCaseTags(tags, code)`, `outcomeForCase(outcomes)`, and
  `syncReport(db, report)` doing all of the above in one transaction; returns a summary for logging.
- Hook: after report generation in `service.generateReport`, alongside the AI summary, isolated.
- `GET /api/tm/cases/:id` includes `autoResult` (or null).
- Trigger form: `testboard_run` input = '' | 'new' | '<runId>'; the options list in-progress runs of all TM
  projects, labelled `<project> · <run name>`.
- Autotests repo: `.gitlab-ci.yml` input `testboard_run` → variable `TESTBOARD_RUN`; `playwright.config.ts`
  passes `testboardRun: process.env.TESTBOARD_RUN` in `resultDetails`.

## Testing

- Unit: tag parsing, outcome aggregation, sync on in-memory SQLite (latest result, automation flag, existing
  run fill without overwriting a person's result, `new` run creation, completed run untouched, foreign project
  and unknown tags ignored, deleted cases skipped).
- E2E: a seeded report whose test carries a case tag shows the automated result in the case panel; the
  Automated form offers the run choice.
