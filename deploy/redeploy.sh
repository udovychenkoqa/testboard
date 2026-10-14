#!/usr/bin/env bash
#
# redeploy.sh — оновити testboard на хості.
#
# Викликається двома способами:
#
# 1) Вручну з локальної машини:
#      ssh dev0ps@<HOST> 'bash /home/dev0ps/testboard/repo/deploy/redeploy.sh'
#
# 2) CI (Drone/GitHub Actions/etc.):
#      ssh ... 'bash <DEPLOY_ROOT>/repo/deploy/redeploy.sh'
#
# Структура на хості:
#   <root>/
#   ├── .env
#   ├── data/          <- volume з репортами (не видаляється при redeploy)
#   └── repo/          <- git clone
#       └── deploy/redeploy.sh   <- цей файл
#
# Що робить:
#   1. git fetch + reset origin/master у <root>/repo
#   2. docker compose build --pull app
#   3. docker compose up -d --force-recreate app
#   4. docker compose ps

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
REPO="${ROOT}/repo"
COMPOSE_FILE="${REPO}/deploy/compose/docker-compose.yml"
ENV_FILE="${ROOT}/.env"
PROJECT=testboard

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "ERROR: compose file not found at ${COMPOSE_FILE}" >&2
  exit 1
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: env file not found at ${ENV_FILE}" >&2
  exit 1
fi

# Створюємо папку для даних якщо не існує
mkdir -p "${ROOT}/data"

COMPOSE=(docker compose --env-file "${ENV_FILE}" -p "${PROJECT}" -f "${COMPOSE_FILE}")

echo "==> pulling repo into ${REPO}"
git -C "${REPO}" fetch --quiet origin master
git -C "${REPO}" reset --hard --quiet origin/master

echo "==> building image"
"${COMPOSE[@]}" build --pull app

echo "==> applying (force-recreate)"
"${COMPOSE[@]}" up -d --force-recreate app

echo "==> status"
"${COMPOSE[@]}" ps
