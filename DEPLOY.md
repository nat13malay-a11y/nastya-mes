# Deploy

Проект состоит из трех runtime-частей:

- `bot-api` - Telegram Bot API + Express API для Mini App.
- `user-client` - GramJS userbot worker, который слушает личный Telegram-аккаунт.
- `mini-app` - статический React/Vite Telegram Mini App.

## 1. Supabase

В Supabase SQL Editor выполни:

```sql
-- см. supabase/schema.sql
```

Файл схемы: `supabase/schema.sql`.

## 2. Environment

На сервере создай `.env` из шаблона:

```bash
cp .env.production.example .env
```

Заполни:

```env
BOT_TOKEN=...
DUMP_CHANNEL_ID=-100...
API_PORT=3001
CORS_ORIGIN=https://your-mini-app.example.com

TELEGRAM_API_ID=...
TELEGRAM_API_HASH=...
TELEGRAM_SESSION=...

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

VITE_API_BASE_URL=https://your-api.example.com
```

`TELEGRAM_SESSION` генерируется один раз локально или на сервере:

```bash
npm run auth
```

Скрипт покажет QR-код, после сканирования сам запишет session в `.env`.

## 3. Docker Deploy

Сборка и запуск всех сервисов:

```bash
docker compose up -d --build
```

Логи:

```bash
docker compose logs -f bot-api
docker compose logs -f user-client
docker compose logs -f mini-app
```

Перезапуск:

```bash
docker compose restart
```

Healthcheck API:

```bash
curl http://localhost:3001/health
```

## 4. Deploy Without Docker

Установить зависимости и собрать:

```bash
npm ci
npm run build
```

Запустить API/бот:

```bash
NODE_ENV=production npm run start:bot
```

Запустить GramJS worker:

```bash
NODE_ENV=production npm run start:user
```

Mini App после сборки лежит в:

```txt
apps/mini-app/dist
```

Его можно отдать через nginx, Caddy, Cloudflare Pages, Netlify или любой static hosting.

## 5. Telegram Setup

Bot:

- Добавь бота в `DUMP_CHANNEL_ID`.
- Дай боту право публиковать сообщения в dump channel.
- Для Mini App укажи HTTPS URL фронтенда в BotFather.

Userbot:

- `TELEGRAM_SESSION` должен принадлежать аккаунту, чьи чаты нужно слушать.
- Не запускай два `user-client` с одной session одновременно на разных серверах.

## 6. Production URLs

Для Telegram Mini App нужен HTTPS.

Пример:

```txt
API:      https://api.example.com
Mini App: https://app.example.com
```

Тогда:

```env
VITE_API_BASE_URL=https://api.example.com
CORS_ORIGIN=https://app.example.com
```

После изменения `VITE_API_BASE_URL` нужно пересобрать Mini App.

## 7. Preflight

Перед деплоем:

```bash
npm run check:env
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

`check:env` проверяет только наличие и формат переменных, сами секреты не печатает.
