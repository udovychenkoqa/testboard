# Deploy Guide

## Структура на хості

```
/home/dev0ps/testboard/
├── .env          ← генерується CI із secrets (НЕ комітити)
├── data/         ← volume з репортами (створюється автоматично, не видаляти)
└── repo/         ← git clone цього репо
    ├── Dockerfile
    └── deploy/
        ├── redeploy.sh
        └── compose/
            └── docker-compose.yml
```

## Перший запуск на хості

```bash
# 1. Клонуємо репо
mkdir -p /home/dev0ps/testboard
cd /home/dev0ps/testboard
git clone <REPO_URL> repo

# 2. Створюємо .env із secrets (або CI зробить це автоматично)
cp repo/.env.example .env
# Заповнюємо API_TOKEN, AUTH_SECRET, HOST_PORT

# 3. Перший запуск
bash repo/deploy/redeploy.sh
```

## Перевірка

```bash
# Логи
docker compose -p testboard logs -f testboard-app

# Health
curl http://localhost:<HOST_PORT>/api/ping
```

## Змінні для CI secrets

| Змінна | Опис |
|---|---|
| `API_TOKEN` | Токен для API та UI (`openssl rand -hex 32`) |
| `AUTH_SECRET` | NextAuth JWT секрет (`openssl rand -hex 32`) |
| `HOST_PORT` | Порт на хості (наприклад `3300`) |
| `UI_AUTH_EXPIRE_HOURS` | Час сесії в годинах (default: `8`) |
| `DATA_STORAGE` | `fs` або `s3` (default: `fs`) |

## Nginx Proxy Manager

Додати новий proxy host:
- **Forward Hostname/IP:** `172.16.100.46`
- **Forward Port:** `<HOST_PORT>`
- **Domain:** `testboard.example.com` (або інший)
