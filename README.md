# MERITX — Learn. Practice. Rise.

MERITX is a React/Vite educational practice experience with a separate Express/PostgreSQL API. The frontend and backend are independently deployable to Vercel and Render.

## Repository audit

- The project contains `frontend` and `backend` applications; there is no separate `content` directory.
- The demo exam catalogue remains in `frontend/src/data/platform.js` and `backend/src/data/platform.js`; approved imported question banks are stored in PostgreSQL and override the representative questions for their assigned exam.
- Image assets are under `frontend/src/assets`, including two homepage sliders, seven supplied course images, optimized display derivatives for the four matched course routes, and MERITX logos.
- Submitting workflows found in the UI: account registration/login, exam registration, attempt start/save/submit, learner support, teacher paper submission, paper approval, and exam-status updates.
- No public contact, admission enquiry, or newsletter form currently exists, so unused public lead endpoints were intentionally not invented.

## Structure

```text
LGW-MERITX/
  backend/
    migrations/001_init.sql
    migrations/002_question_banks.sql
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
| GET | `/api/teacher/question-banks` | List owned banks (or all banks for reviewers) |
| GET | `/api/teacher/question-banks/:id` | Load a bank and its editable questions |
| POST | `/api/teacher/question-banks/import` | Upload and extract one PDF/XLSX/XLS file (multipart `file`, 12 MB limit) |
| PUT | `/api/teacher/question-banks/:id` | Save a validated draft revision |
| POST | `/api/teacher/question-banks/submit` | Validate and submit a bank for approval |
| GET | `/api/admin/overview` | Protected operational overview |
| POST | `/api/admin/papers/approve` | Protected paper approval |
| POST | `/api/admin/question-banks/approve` | Maker-checker approval and exam assignment |
| POST | `/api/admin/question-banks/reject` | Reject a submitted bank with a reason |
| POST | `/api/admin/question-banks/publish` | Atomically publish an approved bank as an examination |
| PATCH | `/api/admin/exam` | Protected exam publication status |
| POST | `/api/support` | Persist an authenticated support request |
| GET | `/api/admin/tickets` | Protected support queue |

No endpoint exposes raw password hashes or an unrestricted list of private lead records.

## Question-bank import format

Excel workbooks and CSV files may contain columns in any order. Recommended columns are `question_id`, `exam`, `subject`, `chapter`, `difficulty`, `question_type`, `question_text`, `option_a` through `option_d`, `correct_answers`, and `explanation`. Common case-insensitive aliases are recognized. Answers may be `B`, `Option B`, `A,C`, a one-based option number, or exact option text. PDF questions should be numbered, options should be labeled `A)`–`H)`, and answer lines should use `Answer: B`. Missing answers are never inferred; they are marked `Answer Required`.

Inline LaTeX between `$...$` and display LaTeX between `$$...$$` render as MathML in both teacher preview and the live exam. Unicode superscripts, subscripts, chemical symbols, and ordinary text are preserved.

Scanned PDFs are detected when little or no selectable text is available. The UI reports an OCR warning; this release does not bundle an OCR engine or an external AI/OCR credential. Convert scanned files to searchable PDFs before upload. Embedded PDF image extraction is also not enabled; diagrams can be supplied with an HTTPS `Image URL` Excel column.

Migrations `002_question_banks.sql` and `003_examination_workflow.sql` add question banks, multi-answer questions, lifecycle/audit history, custom subjects, published examinations, and immutable per-attempt snapshots. Approved/published banks cannot be edited in place, and submitted attempts are evaluated against their stored snapshot.

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

The backend suite covers endpoint validation, health, CORS, safe database failures, email-provider failure after persistence, rate limiting, Excel/CSV extraction, an exact 30-question workbook, text-PDF extraction, missing answers, file-signature rejection, and exact multiple-correct evaluation. Run `node tests/e2e-live.mjs` only against a development database to create and verify a complete 30-question teacher/admin/student workflow. See `AUDIT_AND_TEST_REPORT.md` for recorded results and limitations.

## Product boundaries

Rankings, prize pools, and wallets remain illustrative. Paid examination enrollment uses Razorpay Standard Checkout when Razorpay is configured; the default `RAZORPAY_MODE=test` accepts simulated test payments only. The question bank is representative and is not affiliated with NTA or IITs.

## Razorpay Test Mode

1. In the Razorpay Dashboard, switch to **Test Mode** and generate a test Key ID and Key Secret.
2. Copy `backend/.env.example` to `backend/.env` if needed, then set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and keep `RAZORPAY_MODE=test`.
3. Set a separate `RAZORPAY_WEBHOOK_SECRET`, then add `https://YOUR_API_HOST/api/payments/webhook` in the Razorpay Test Mode dashboard for the `payment.captured` and `payment.failed` events.
4. Restart the backend. Only the Key ID is returned to the browser; the Key Secret and Webhook Secret remain server-side.
5. Publish a course, set its Admin price above ₹0, and link an examination to it. The latest course price is read by the backend when the student starts checkout.
6. Use Razorpay's documented Test Mode payment methods. Enrollment is created only after HMAC signature verification and a trusted Razorpay API fetch confirms the expected order, INR amount, and `captured` status.

The immediate success path verifies the checkout signature and fetches the payment from Razorpay before enrollment. The signed webhook path independently handles captured/failed notifications, repeated delivery, and failed events arriving after a successful capture without duplicating or revoking enrollment. To move to live payments later, complete Razorpay activation and production testing first, explicitly set `RAZORPAY_MODE=live`, and replace both credentials with matching `rzp_live_...` keys. Test and live key prefixes are checked so they cannot be mixed accidentally.
