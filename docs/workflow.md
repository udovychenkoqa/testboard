# Workflow

## Branches

- `master` is the stable branch, and **every push deploys automatically** (`.gitlab-ci.yml`).
- Work happens on branches: `feat/<short>`, `fix/<short>`, `chore/<short>`, `docs/<short>`.
- No merges into `master`, force-pushes or history rewrites without an explicit decision from the owner.

## Commits

- Conventional Commits: `type(scope): description`, imperative mood, up to ~72 characters.
  - `type`: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.
  - `scope` is the area: `tm`, `reports`, `settings`, `i18n`, `auth`, `e2e`…
- The body explains **why** and what changed for the user, not a retelling of the diff.
- One commit, one logical change, with its tests in the same commit.
- Commits made by an AI agent end with the agent's `Co-Authored-By` line.

Example:

```
fix(tm): show 'Run not found' instead of an endless skeleton

A stale or mistyped run link left the run page on its loading skeleton
forever. It now shows an empty state with a way back, and doesn't retry
a 404.
```

## Larger features

1. **Design:** discussion → spec in `docs/superpowers/specs/YYYY-MM-DD-<name>-design.md`.
2. **Plan:** tasks with tests → `docs/superpowers/plans/YYYY-MM-DD-<name>.md`.
3. **Implementation:** task by task, TDD, one commit per task.
4. **Review:** review the whole branch, fix important findings with a test.
5. **Integration:** merge or PR — the owner decides.

Specs and plans stay in the repo as a record of decisions.

## Code review checklist

- Is access checked on the server for every new endpoint?
- Is input validated (zod), and are the error statuses right?
- Do server modules leak into the client bundle?
- Are strings in both dictionaries, with correct Ukrainian plural forms?
- Are all three UI states covered: loading, empty, error?
- Is there a test that failed without this change?
- No secrets, no `console.log` with data, no commented-out code?

## Secrets and environments

- `.env` holds real local values and is **never committed**. `.env.example` has only variable names and
  placeholders.
- On the host, CI updates part of `.env` from GitLab CI/CD variables (`ANTHROPIC_*`, `GITLAB_*`, `AUTH_GOOGLE_*`…);
  the rest is maintained by hand.
- Tokens for local checks are throwaway (`openssl rand -hex 32`). Real tokens never go into tests,
  screenshots or chat.
- `data/` is real data (reports, `config.json`, `testboard.db`). Use a separate `DATA_DIR` for experiments.

## Deployment

Step by step in [deploy/README.md](../deploy/README.md). In short:

- push to `master` → GitLab CI updates `.env` on the host → `deploy/redeploy.sh` rebuilds and restarts the
  container;
- health check: `GET /api/ping`;
- data lives in the `data/` volume. Backing up that folder backs up reports, settings and test cases.
