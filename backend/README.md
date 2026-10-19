# MERITX API

Production-oriented Express API for the MERITX React frontend. PostgreSQL is the only production persistence layer; no in-memory or local-file fallback is used.

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer, or a managed PostgreSQL connection string

## Local setup

```powershell
cd "F:\SW PROJECT\4.in_house\Meritx_project\New folder\Meritx Pro\LGW-MERITX\backend"
npm install
Copy-Item .env.example .env
```

Edit `.env`, set `DATABASE_URL`, and replace `JWT_SECRET` with at least 32 random characters. Then run:

```powershell
npm run db:migrate
npm run dev
```

The server defaults to `http://localhost:5000`; readiness is reported by `GET /api/health`. Startup runs the idempotent schema migration automatically. `SEED_DEMO_USERS=true` creates the four documented demo accounts for local development only.

## Data model

The schema is in `migrations/001_init.sql` and includes indexed tables for users, registrations, simulated payment records, attempts, teacher papers, support tickets, audit records, and exam publication overrides. Passwords are hashed with bcrypt. Authentication uses expiring signed JWTs.

## Optional email

Support tickets are always stored first. When all SMTP variables are configured, the API then sends a notification to `SUPPORT_TO_EMAIL`. A provider failure is logged and returned as `emailNotification: "failed"` without losing the saved ticket.

Required SMTP variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, and `SUPPORT_TO_EMAIL`. Brevo, another SMTP provider, or a compatible transactional email service can be used. No email credentials belong in the frontend.

## Render

Use the repository root `render.yaml`, or create a Web Service with:

- Root directory: `backend`
- Runtime: Node
- Build command: `npm ci`
- Start command: `npm start`
- Health check: `/api/health`

Create a managed PostgreSQL database and set its internal connection string as `DATABASE_URL`. Set `DATABASE_SSL=true`, `FRONTEND_URLS` to the comma-separated production Vercel origin and any approved preview origin, and configure a strong `JWT_SECRET`. Keep `SEED_DEMO_USERS=false` unless the deployed environment is intentionally a public demo.

The app binds to `process.env.PORT` on `0.0.0.0`, as required by Render.

## Tests

```powershell
npm test
```

The test suite uses injected fakes rather than a production database. It covers health, registration validation, safe database error responses, CORS rejection, support persistence during email failure, submission rate limiting, and exam scoring.
