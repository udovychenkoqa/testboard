# Deploy Guide

## Layout on the host

```
/home/dev0ps/testboard/
├── .env          ← secrets; kept by hand, CI updates some lines (NEVER commit)
├── data/         ← volume with reports and test cases (created automatically, don't delete)
└── repo/         ← git clone of this repo
    ├── Dockerfile
    └── deploy/
        ├── redeploy.sh
        └── compose/
            └── docker-compose.yml
```

## First run on the host

```bash
# 1. Clone the repo
mkdir -p /home/dev0ps/testboard
cd /home/dev0ps/testboard
git clone <REPO_URL> repo

# 2. Create .env with secrets
cp repo/.env.example .env
# Fill in API_TOKEN, AUTH_SECRET, HOST_PORT

# 3. First start
bash repo/deploy/redeploy.sh
```

## Checks

```bash
# Logs
docker compose -p testboard logs -f testboard-app

# Health
curl http://localhost:<HOST_PORT>/api/ping
```

## Variables

Set by hand in the host's `.env`:

| Variable               | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `API_TOKEN`            | Token for the API and UI (`openssl rand -hex 32`) |
| `AUTH_SECRET`          | NextAuth JWT secret (`openssl rand -hex 32`)      |
| `HOST_PORT`            | Port on the host (e.g. `3300`)                    |
| `UI_AUTH_EXPIRE_HOURS` | Session length in hours (default: `8`)            |
| `DATA_STORAGE`         | `fs` or `s3` (default: `fs`)                      |

Updated on every deploy from GitLab CI/CD variables (`.gitlab-ci.yml`, `update-env` job): `ANTHROPIC_API_KEY`,
`ANTHROPIC_MODEL`, `GITLAB_URL`, `GITLAB_TOKEN`, `GITLAB_AUTOTESTS_PROJECT`, `GITLAB_REF`, `AUTH_GOOGLE_ID`,
`AUTH_GOOGLE_SECRET`, `AUTH_ALLOWED_DOMAINS`, `AUTH_ADMIN_EMAILS`. Everything else in `.env` is left
untouched.

## Moving to GitLab (one-off owner checklist)

1. Create the CI/CD variables listed at the top of `.gitlab-ci.yml` (Protected; secrets Masked;
   `SSH_PRIVATE_KEY` as a File variable).
2. On the host, point the clone at GitLab, because `redeploy.sh` pulls `origin/master`:
   `git -C /home/dev0ps/testboard/repo remote set-url origin <gitlab repo url>`.
3. Make sure the GitLab runner can reach the host over SSH.
4. Push to `master` and watch `update-env` → `deploy` → `healthcheck`. The first run also removes the old
   `DRONE_*` lines from `.env`.

## Nginx Proxy Manager

Add a new proxy host:

- **Forward Hostname/IP:** `172.16.100.46`
- **Forward Port:** `<HOST_PORT>`
- **Domain:** `testboard.example.com` (or another)
