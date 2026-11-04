# Testboard

Internal QA dashboard. CI uploads Playwright results, and Testboard turns them into HTML reports, trends
and failure analysis. It also starts the autotests' GitLab pipelines and keeps manual test cases and runs
(Qase-style) in one place.

Started as a fork of `playwright-reports-server` and since reworked; storage, report generation and the
access model still follow upstream.

## What it does

- **Results and reports.** CI uploads blob reports (`PUT /api/result/upload`), usually through
  [`@testboard/reporter`](packages/reporter/README.md). Testboard merges them into one HTML report and
  serves it.
- **Analysis.** Trends, flaky tests, an AI summary of failures (Anthropic), and Slack or webhook
  notifications.
- **Autotests.** Start, cancel and rerun GitLab pipelines from **Test Runs → Automated**.
- **Test management.** Projects, suites, cases with steps, and manual runs with results.
- **Access.** Sign in with Google (allowed domains, roles viewer / tester / admin) or with the API token.
  The CI uses the same token in the `Authorization` header.

## Stack

Next.js 14 (App Router) and React 18, HeroUI and Tailwind, next-intl (English and Ukrainian), NextAuth v5.
Reports and results live on disk, S3 or Azure (`DATA_STORAGE`). Test management uses SQLite
(`<DATA_DIR>/testboard.db`). Node 22 (`.nvmrc`).

## Run locally

```bash
cp .env.example .env    # fill in API_TOKEN and AUTH_SECRET (openssl rand -hex 32)
npm ci
npm run dev             # http://localhost:3000, data in ./data
```

With neither `API_TOKEN` nor Google configured the app runs in open mode, where everyone is admin. Use that
only on your own machine.

## Configuration

The main variables are listed with comments in [`.env.example`](.env.example):

| Variable                                                               | Purpose                                                  |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| `API_TOKEN`                                                            | CI uploads and sign-in with the token                    |
| `AUTH_SECRET`                                                          | Signs sessions; required whenever sign-in is enabled     |
| `AUTH_URL`                                                             | Public URL; required behind a proxy (also used for PDFs) |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`                                 | Google sign-in, on only when both are set                |
| `AUTH_ALLOWED_DOMAINS`, `AUTH_ADMIN_EMAILS`                            | Who may sign in, who is admin                            |
| `UI_AUTH_EXPIRE_HOURS`                                                 | Session length (default 2)                               |
| `DATA_DIR`, `DATA_STORAGE`                                             | Where data lives: `fs` (default), `s3`, `azure`          |
| `MAX_UPLOAD_MB`                                                        | Upload size cap, `0` = no limit                          |
| `GITLAB_URL`, `GITLAB_TOKEN`, `GITLAB_AUTOTESTS_PROJECT`, `GITLAB_REF` | Autotest pipelines                                       |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`                                 | AI failure summary                                       |

In the deployed instance the secrets and team-owned settings come from Vault
(`aws-k8s-tf-uw2-ht-hm-dev/apps/testboard/dev/secrets`), the rest from the Helm values in
`honeytech-video-platform/devops/etc` (`charts/tools/testboard/values.develop.yaml`).

## Checks

```bash
npm run test:unit      # Jest
npx tsc --noEmit -p .  # types
npm run lint           # ESLint, 0 errors
npm run test:e2e       # Playwright; own server on :3100 with throwaway data
```

## Deploy

Pushing to `master` deploys automatically through GitLab CI (`.gitlab-ci.yml`, jobs included from
`devops/etc`): the image is built and pushed to this project's registry, then Argo CD (app `develop-testboard`)
rolls it out to the `testboard` namespace of `aws-k8s-tf-uw2-ht-hm-dev` and the job waits until the pod is
healthy. Data lives on a 50 GiB EBS volume with daily snapshots. URL:
https://testboard.aws-k8s-tf-uw2-ht-hm-dev.pento.ink (office/VPN and CI runner IPs only). Autotests that run on the
dev cluster's own runner (tag `aws-k8s-tf-uw2-ht-hm-dev-gitlab-runner`) can upload to
`http://testboard.testboard.svc.cluster.local:3000` instead, bypassing Cloudflare and its upload limits.

[deploy/](deploy/README.md) describes the previous single-host `docker compose` setup; it is kept for running
the production image locally.

## Docs

| Topic                                    | Where                                                  |
| ---------------------------------------- | ------------------------------------------------------ |
| Layers, data flow, auth, storage         | [docs/architecture.md](docs/architecture.md)           |
| Code conventions                         | [docs/coding-guidelines.md](docs/coding-guidelines.md) |
| Unit and e2e tests                       | [docs/testing.md](docs/testing.md)                     |
| Branches, commits, reviews, secrets      | [docs/workflow.md](docs/workflow.md)                   |
| Notes for AI agents and new contributors | [AGENTS.md](AGENTS.md)                                 |
