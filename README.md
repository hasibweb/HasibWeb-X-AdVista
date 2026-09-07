# HasibWeb X AdVista

Next.js dashboard for managing hosting clients, monthly billing, offline payments, and WhatsApp reminders through the HasibWeb WA API.

## Local setup

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

Open `http://localhost:3000`, sign in with `ADMIN_PASSWORD`, then use `/dashboard`.

## Coolify

Create a GitHub-backed Docker Compose resource using `docker-compose.coolify.yml` and attach `advista.hasibweb.com` to the `app` service.

Required environment variables:

```text
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
ADMIN_PASSWORD
AUTH_SECRET
AUTH_COOKIE_SECURE=true
HASIBWEB_WA_BASE_URL=https://wa.hasibweb.com
```

WhatsApp API key and session ID are configured from the dashboard Settings page.
Secrets must stay in Coolify, local `.env`, or dashboard Settings; do not commit them.
