# MERITX — Learn. Practice. Rise.

MERITX is a React/Vite educational practice experience with a separate Express/PostgreSQL API. The frontend and backend are independently deployable to Vercel and Render.

## Repository audit

- The project contains `frontend` and `backend` applications; there is no separate `content` directory.
- Website content is currently defined in `frontend/src/data/platform.js` and mirrored server-side in `backend/src/data/platform.js` for the demo exam catalogue and representative questions.
- Image assets are under `frontend/src/assets`, including two homepage sliders, seven supplied course images, optimized display derivatives for the four matched course routes, and MERITX logos.
- Submitting workflows found in the UI: account registration/login, exam registration, attempt start/save/submit, learner support, teacher paper submission, paper approval, and exam-status updates.
- No public contact, admission enquiry, or newsletter form currently exists, so unused public lead endpoints were intentionally not invented.

## Structure

```text
LGW-MERITX/
  backend/
    migrations/001_init.sql
    src/
      config/
      controllers/
      data/
      middleware/
      routes/
      scripts/
      services/
      utils/
      app.js
      server.js
    tests/
    .env.example
    package.json
  frontend/
    public/
    src/
      assets/
      components/
      context/
      data/
      lib/
      pages/
    .env.example
    vercel.json
    package.json
  render.yaml
```

## Environment variables

Frontend (`frontend/.env`):

- `VITE_API_BASE_URL`: backend origin, without `/api`; locally `http://localhost:5000`.
- `VITE_WHATSAPP_NUMBER`: business WhatsApp number with country code and digits only. The floating button is hidden until a valid number is configured.
- `VITE_WHATSAPP_MESSAGE`: optional prefilled message.

Backend (`backend/.env`):

- `DATABASE_URL`: PostgreSQL connection string.
- `DATABASE_SSL`: `true` for managed production PostgreSQL when required.
- `JWT_SECRET`: minimum 32-character signing secret.
- `FRONTEND_URLS`: comma-separated explicit CORS allowlist.
- `SEED_DEMO_USERS`: `true` only for local/demo environments.
- SMTP variables documented in `backend/.env.example` are optional.

Never commit `.env` files. Vite variables are public browser configuration and must never contain database, JWT, or email secrets.

## Windows local development

Requirements: Node.js 20.19+ and PostgreSQL 14+ or a managed PostgreSQL URL.

Terminal 1 — API:

```powershell
cd "F:\SW PROJECT\4.in_house\Meritx_project\New folder\Meritx Pro\LGW-MERITX\backend"
npm install
Copy-Item .env.example .env
# Edit DATABASE_URL and JWT_SECRET in .env
npm run db:migrate
npm run dev
```

Terminal 2 — frontend:

```powershell
cd "F:\SW PROJECT\4.in_house\Meritx_project\New folder\Meritx Pro\LGW-MERITX\frontend"
npm install
Copy-Item .env.example .env
# Set VITE_API_BASE_URL and VITE_WHATSAPP_NUMBER
npm run dev
```

Vite normally serves `http://localhost:5173`; the API defaults to `http://localhost:5000`. If Vite selects another port, add that exact origin to `FRONTEND_URLS`.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | API and database readiness |
| POST | `/api/auth/register` | Create a student account |
| POST | `/api/auth/login` | Authenticate and issue an expiring JWT |
| GET | `/api/auth/me` | Restore the authenticated profile |
| GET | `/api/exams` | Public exam catalogue |
| GET | `/api/questions?examId=...` | Role-aware sample questions |
| GET | `/api/me/dashboard` | Student registrations and attempts |
| POST | `/api/exams/register` | Persist an illustrative exam registration |
| POST | `/api/attempts/start` | Start or resume an attempt |
| POST | `/api/attempts/save` | Save answers and marked questions |
| POST | `/api/attempts/submit` | Evaluate and persist an attempt |
| GET/POST | `/api/teacher/papers` | List or submit paper metadata |
| GET | `/api/admin/overview` | Protected operational overview |
| POST | `/api/admin/papers/approve` | Protected paper approval |
| PATCH | `/api/admin/exam` | Protected exam publication status |
| POST | `/api/support` | Persist an authenticated support request |
| GET | `/api/admin/tickets` | Protected support queue |

No endpoint exposes raw password hashes or an unrestricted list of private lead records.

## Vercel frontend deployment

1. Import the repository into Vercel.
2. Set Root Directory to `frontend`.
3. Use `npm run build` and output directory `dist` (Vite is normally auto-detected).
4. Add `VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com`.
5. Add the digits-only `VITE_WHATSAPP_NUMBER` and optional `VITE_WHATSAPP_MESSAGE`.
6. Deploy. `frontend/vercel.json` rewrites client-side routes to `index.html` for direct refreshes.
7. Add the final Vercel origin to Render's `FRONTEND_URLS` and redeploy/restart the API.

Do not put `DATABASE_URL`, `JWT_SECRET`, or SMTP credentials in Vercel's Vite variables.

## Render backend deployment

1. Create a managed PostgreSQL database in the same Render region as the API.
2. Create a Blueprint from the repository's `render.yaml`, or create a Node Web Service manually.
3. Confirm Root Directory `backend`, Build Command `npm ci`, Start Command `npm start`, and health path `/api/health`.
4. Set `DATABASE_URL` to the managed database's internal connection string.
5. Set `FRONTEND_URLS` to the exact Vercel production origin and explicitly approved preview origins.
6. Keep the generated strong `JWT_SECRET`; set `DATABASE_SSL=true` if required by the database provider.
7. Configure optional SMTP settings and `SUPPORT_TO_EMAIL` if notifications are wanted.
8. Deploy and verify `https://YOUR-RENDER-SERVICE.onrender.com/api/health` before setting the frontend API URL.

The schema migration runs idempotently at startup. Production demo-account seeding is disabled in `render.yaml`.

## Verification

```powershell
cd backend
npm test

cd ..\frontend
npm run build
```

The backend suite covers endpoint validation, health, CORS, safe database failures, email-provider failure after persistence, rate limiting, and scoring. A real PostgreSQL connection and SMTP delivery require credentials and must be verified in the target environment.

## Product boundaries

Fees, rankings, prize pools, wallets, and payments remain illustrative. No real payment or payout provider is enabled. The question bank is representative and is not affiliated with NTA or IITs.
