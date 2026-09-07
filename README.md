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

Coolify generates these required secrets from `docker-compose.coolify.yml`:

```text
SERVICE_PASSWORD_POSTGRES
SERVICE_PASSWORD_ADMIN
SERVICE_REALBASE64_64_AUTH
```

The app service declares `SERVICE_FQDN_APP_3000=https://advista.hasibweb.com`.
Optional override: `HASIBWEB_WA_BASE_URL=https://wa.hasibweb.com`.

WhatsApp API key and session ID are configured from the dashboard Settings page.
Secrets must stay in Coolify, local `.env`, or dashboard Settings; do not commit them.

## GitHub Actions deployment

The `Deploy to Coolify` workflow triggers on every push to `main` and can also be run manually from GitHub Actions.

Add these repository secrets in GitHub:

```text
COOLIFY_URL=https://coolify.hasibweb.com
COOLIFY_TOKEN=<Coolify API token with deploy permission>
COOLIFY_RESOURCE_UUID=<Coolify application or service UUID>
```
