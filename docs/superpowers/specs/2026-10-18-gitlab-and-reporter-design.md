# Testboard reporter and GitLab runs — design

Date: 2026-10-18. Status: draft for owner approval.

## Why

The hanimax autotests (`~/Desktop/autotests`, package `hanimax.e2e`) upload results to Testboard through a
third-party package, `@cyborgtests/reporter-playwright-reports-server` (pinned `2.6.1`). Testboard is our
own fork of that server now, and the owner wants the autotests tied to **our** code, not to an upstream
package whose updates or API changes can silently break uploads.

At the same time the autotests run on **GitLab CI** (`.gitlab-ci.yml` with inputs), while Testboard's
"Run" button only knows **Drone**, with a form built for a previous project (country, A/B test, funnel).
The button doesn't work for this project at all.

Both repositories (Testboard and the autotests) will live in the same GitLab instance. The address isn't
known yet (gitlab.com or self-hosted), so it's configuration.

## Goals

1. **Own reporter.** A Testboard Playwright reporter, published to the GitLab npm Package Registry, replaces
   the Cyborg reporter in the autotests with no visible change in behaviour.
2. **Reversible.** The reporter accepts the same options as the Cyborg reporter and talks to the same
   endpoints, so switching back (or forward) is changing the package name in `package.json` and
   `playwright.config.ts`. Nothing else.
3. **Run autotests from Testboard via GitLab.** The Automated tab triggers a GitLab pipeline with the
   autotests' inputs, lists recent pipelines, and can cancel or rerun them.
4. **Drone removed completely.** The autotests integration (code, env vars, UI copy, tests) and Testboard's
   own deploy pipeline (`.drone.yml`) move to GitLab. Nothing Drone-related stays.

## Non-goals

- Linking automated tests to Testboard test cases (TM stage 2). Comes later; nothing here should block it.
- Any change to Qase or the Qase tooling in the autotests. Qase stays as it is.
- Changing the server's upload or report-generation API.

## Anti-goals (would be a failure even if it "works")

- Uploads break or reports stop merging shards after the switch.
- The GitLab token reaches the browser or the logs.
- The reporter diverges from Cyborg's options so that switching back needs config rewrites.

## Part 1 — the reporter

### Where it lives

- In the Testboard repo as a small workspace package, `packages/reporter/` (own `package.json`,
  TypeScript, built to JS + `.d.ts`). The server and its client change in one place.
- Published to the **GitLab npm Package Registry** of the Testboard GitLab project, through the
  _project-level_ endpoint (`<GITLAB_URL>/api/v4/projects/<id>/packages/npm/`). GitLab enforces the
  "scope = top-level group" naming rule only on the instance-level endpoint, so the package is
  `@testboard/reporter` whatever the group is.
- Zero runtime dependencies (Node ≥ 18 `fetch`, `FormData`, `Blob`). Peer dependency `@playwright/test`
  `>=1.37`.

### Behaviour (must match the Cyborg reporter 2.6.1)

Options, all as in Cyborg: `enabled` (default `true`), `url`, `token`, `reportPath` (required),
`requestTimeout` (default `60000`), `resultDetails` (string map), `triggerReportGeneration`
(default `false`).

On `onEnd` (as Cyborg 2.6.1 does it — read from its `dist/index.js`):

1. If `enabled === false` → do nothing. A missing `url` or `reportPath` is a configuration error at
   construction, as in Cyborg (the autotests only add the reporter when `REPORTS_SERVER_URL` is set).
2. Read the blob at `reportPath`.
3. Build the upload fields: every `resultDetails` entry, plus `username` (if not given),
   `playwrightVersion`, `shardCurrent`/`shardTotal` (when sharded) and `triggerReportGeneration`.
4. `PUT {url}/api/result/upload?fileContentLength=<size>` as a streamed multipart body, with
   `Authorization: <token>` when a token is set. Timeout: `blobUploadTimeout` ?? `requestTimeout` ??
   10 min.
5. **Sharded run:** nothing more. The server generates the report once all `shardTotal` uploads of the same
   `testRun` have arrived (`pages/api/result/upload.ts`, already implemented) and returns it in
   `data.generatedReport`.
6. **Not sharded** and `triggerReportGeneration`: `POST {url}/api/report/generate` with
   `{ resultsIds: [resultID], ...uploadFields, playwrightVersion }`.
7. Log `[TestboardReporter] HTML report: {url}{reportUrl}` when the server returns one.
8. Failures: see "Failure behaviour" below.

**Failure behaviour (owner's decision: same as Cyborg).** A missing blob or a failed upload/generate
request throws from `onEnd` with a clear `[TestboardReporter]` message, so the CI job fails and the
problem is visible. No silent swallowing.

The builder reads the installed Cyborg 2.6.1 source in the autotests' `node_modules` to match request
shapes field for field. If the two diverge anywhere, Cyborg's behaviour wins.

### Publishing

- A GitLab CI job in the Testboard repo publishes the package when a tag `reporter-v<semver>` is pushed,
  authenticating with `CI_JOB_TOKEN`. (Builder's call: tag-triggered job, not on every commit.)
- `packages/reporter/README.md` documents install, the `.npmrc` needed by consumers, options, and how to
  switch back to Cyborg.
- Testboard's own `package.json` drops `@cyborgtests/reporter-playwright-reports-server` (it was never
  imported).

### In the autotests repo

- `package.json`: replace the Cyborg dev dependency with `@testboard/reporter`, exact
  version.
- `.npmrc`: point the `@testboard` scope at the Testboard project's registry endpoint; auth via an env variable
  (`CI_JOB_TOKEN` in CI, a personal/deploy token locally). No token committed.
- `playwright.config.ts`: change only the reporter name. Options stay as they are (`env`, `testRun:
CI_PIPELINE_ID`, `project: 'hanimax'`, `triggerReportGeneration: true`).
- Docs: a short note in the autotests docs on the reporter and how to switch back.

### Sequencing constraint

The repos aren't in GitLab yet. Until they are, the reporter is built and verified locally: the
autotests install it from a local path (or `npm pack` tarball) and upload to a local Testboard. The
registry wiring (`.npmrc`, publish job) is written now and activated when the repos move.

## Part 2 — GitLab runs in Testboard

### Configuration (server-only env, replaces `DRONE_SERVER`, `DRONE_TOKEN`, `DRONE_AUTOTESTS_REPO`)

| Variable                   | Meaning                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `GITLAB_URL`               | Base URL of the GitLab instance, e.g. `https://gitlab.com`                             |
| `GITLAB_TOKEN`             | Project or group access token with `api` scope (create, read, cancel, retry pipelines) |
| `GITLAB_AUTOTESTS_PROJECT` | Autotests project path (`group/autotests`) or numeric id                               |
| `GITLAB_REF`               | Branch to run, default `main`                                                          |

The feature is off (the tab shows the existing "not configured" state) unless the first three are set.
The deploy pipeline (Part 3) writes these to the host's `.env`, and `.env.example` lists them.

### API (routes keep their provider-neutral paths)

- `POST /api/autotests/trigger` → GitLab "create pipeline" for `GITLAB_REF` with `inputs`. Validated
  with zod.
- `GET /api/autotests/builds` → recent pipelines (paged), newest first.
- `POST /api/autotests/cancel` → cancel a pipeline.
- Rerun → trigger a new pipeline with the same inputs when they're known, otherwise GitLab "retry".
- Access rules in `app/lib/access.ts` stay as they are: trigger and cancel need `run:tests` (viewers too).
- Errors: GitLab unreachable → the existing "external service unreachable" toast; GitLab 4xx → readable
  message; the token never appears in responses or logs.

### Form (Automated tab)

Mirrors the inputs of the autotests' `.gitlab-ci.yml`:

- Shown: **environment** (`prod` / `stage` / `dev`, default `prod`), **mode** (`by tag` / `smoke` /
  `regression`, default `by tag`), **tag** (default `@smoke`; used only when mode is `by tag`; valid:
  `@smoke`, `@core-regression`, `@api`, `@visual`, comma-separated).
- Under "Advanced": `qase_run_id`, `qase_id`, `force_snapshots_recollection`, `skip_visual_checks`
  (default `true`).
- The old fields (country, A/B test, variation, funnel) are removed.

The options list is defined in one place in Testboard. If the pipeline's inputs change, that list is the
one thing to update.

### Recent runs list

Same columns as today, from GitLab: pipeline number/link ("Open in GitLab"), status, started by, started
at, duration, the main inputs (env / mode / tag). "Only mine" filter, cancel and rerun stay.

**Started by** must show the Testboard user who pressed the button, not the token owner GitLab reports.
_(My call.)_ Testboard stores one row per pipeline it triggers in its SQLite database (`testboard.db`, new
migration): pipeline id, started by, inputs, created at. The list joins on it. That gives "started by"
and the inputs, and rerun uses those inputs; GitLab's API doesn't return a pipeline's inputs. For
pipelines started elsewhere: GitLab's user, no inputs, and rerun falls back to GitLab "retry".

### i18n

All new and changed copy in `messages/en.json` and `messages/uk.json`. "Open in Drone" → "Open in GitLab".
Drone-specific copy is removed.

## Part 3 — Testboard deploy on GitLab CI

`.drone.yml` is deleted and replaced by `.gitlab-ci.yml` in the Testboard repo. It does the same steps:

1. **update-env** (on push to `master`): over SSH, replace only the CI-managed lines in
   `/home/dev0ps/testboard/.env`. The rest of the file is untouched, same as today. CI-managed lines after
   this change: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GITLAB_URL`, `GITLAB_TOKEN`,
   `GITLAB_AUTOTESTS_PROJECT`, `GITLAB_REF`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
   `AUTH_ALLOWED_DOMAINS`, `AUTH_ADMIN_EMAILS`. The old `DRONE_*` lines are removed from the file.
2. **deploy:** `ssh … 'bash /home/dev0ps/testboard/repo/deploy/redeploy.sh && docker image prune -f'`,
   10-minute timeout.
3. **healthcheck:** `curl` the health URL with retries, as today.
4. **publish-reporter** (on tag `reporter-v*`): build and publish `packages/reporter` (Part 1).

Secrets become masked, protected GitLab CI/CD variables (SSH host, user, key, health URL, and the values
above). Host key checking stays strict (`ssh-keyscan` into `known_hosts`). Comments in
`deploy/redeploy.sh` and `deploy/README.md` stop mentioning Drone.

Owner actions when the repo moves (documented in `deploy/README.md`, not code):

- create the CI/CD variables;
- point the host's clone (`/home/dev0ps/testboard/repo`) `origin` at the GitLab repo, because
  `redeploy.sh` pulls from `origin/master`;
- make sure the GitLab runner can reach the host over SSH.

This can't be run until the repo is in GitLab. Before that, the builder validates the file with GitLab's
CI lint if reachable, otherwise by careful review against the Drone steps it replaces.

## Testing

- **Reporter**, unit tests against a stub HTTP server:
  - correct upload request (multipart fields, auth header);
  - generate request after upload;
  - no throw on network error, 500 or a missing file;
  - disabled / no-URL does nothing.
  - A contract test that our reporter and Cyborg 2.6.1 send equivalent requests for the same options.
- **Reporter, end to end:** the autotests run once against a local Testboard with the local build of the
  reporter; the report shows up and shards merge.
- **GitLab client**, unit tests with a mocked `fetch`: create pipeline payload (ref + inputs),
  list mapping, cancel, rerun fallback, error mapping, token never in thrown messages.
- **E2E** (Testboard): the Automated tab shows the new form fields. With `GITLAB_URL` pointing at an
  unresolvable host, Run shows the readable "unreachable" toast (replaces today's Drone toast test).

## Constraints

- Pipeline `inputs` through the create-pipeline API need a GitLab version that supports them (17.x+).
  gitlab.com does. For a self-hosted instance, check the version when the address is known.

## Left to the builder

- Package build tooling for `packages/reporter` (plain `tsc` is enough).
- Exact pagination and polling for the runs list (match today's Drone behaviour).
- Splitting the work into tasks and commits.

## Open items that need the owner later (not blocking the build)

- The GitLab address and the Testboard project id (for `GITLAB_URL` and the `.npmrc` registry URL).
- A GitLab access token for Testboard and the CI variables in both projects, once the repos move.
- Repointing the host's clone to GitLab and checking the runner can reach the host.
