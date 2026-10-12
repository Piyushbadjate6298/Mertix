# LGW MERITX — Compete. Perform. Rise.

A **full-stack runnable demonstration** of a competitive JEE / NEET mock examination web platform for LGW Digital Hub. React + Vite frontend and a **Node.js built-in HTTP API** backend. Branded with a blue / cyan / white theme inspired by the supplied logo reference. The supplied original logo reference is included at `frontend/src/assets/reference-logo.jpg`; the interface uses a clean, custom SVG-style LGW icon and the changed LGW DIGITAL HUB wordmark.

## Quick start

**Prerequisites:** Node.js 20.19+ (Node 22 recommended), npm, internet connection for first frontend dependency installation.

Terminal 1:

```bash
cd backend
npm start
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser. API health: **http://localhost:4000/api/health**.

To build the frontend for deployment: `cd frontend && npm run build`. It creates `frontend/dist`. You must deploy the backend separately on a Node.js host with persistent storage and set `VITE_API_URL` during the frontend build.

## Demo login credentials

| Role | Email / username | Password | Dashboard |
|---|---|---|---|
| Student | `student@meritx.demo` | `Student@123` | `/student` |
| Teacher | `teacher@meritx.demo` | `Teacher@123` | `/teacher` |
| Admin | `admin@meritx.demo` | `Admin@123` | `/admin` |
| Super Admin | `superadmin@meritx.demo` | `Super@123` | `/superadmin` |

All role logins are on the **same** `/login` page. Click a demo role button to prefill credentials. These passwords are **only for local demonstrations**; never deploy these fixed accounts to production.

## Test exam flow

1. Sign in as student.
2. Open Explore Exams and click a JEE or NEET card.
3. Agree to the demo rules, click **Register for Demo**. **No actual money is charged.**
4. Click **Start Demo Exam**. There is a **12-minute sample session** with representative MCQs, not the full official 180-minute test.
5. Select choices, use Save & Next, Mark for Review, Clear Response, or question palette. Answers auto-save to the backend after a short pause.
6. Submit (or wait for automatic expiry). Receive your evaluated score and explanations. Visit My Results to see all submissions.
7. Log in as teacher, create a paper metadata submission. Log in as admin to approve the paper.
8. Register additional exams and view simulated collections with the super-admin login.

## Folder structure

```
LGW-MERITX/
  frontend/
    index.html
    package.json
    .env.example
    src/
      assets/reference-logo.jpg
      components/Brand.jsx, Brand.css, Layouts.jsx, Layouts.css
      context/AuthContext.jsx
      lib/api.js
      pages/
        public/Home.jsx, Home.css, Exams.jsx, Exams.css, ExamDetails.jsx
        auth/Auth.jsx, Auth.css
        student/Student.jsx, Student.css
        exam/Exam.jsx, Exam.css
        teacher/Teacher.jsx, Teacher.css
        admin/Admin.jsx, Admin.css
        superadmin/Finance.jsx, Finance.css
      App.jsx
      main.jsx
      index.css
  backend/
    src/data.js
    src/store.js
    src/engine.js
    src/server.js
    data/ (JSON demo persistence)
    tests/engine.test.js
    package.json
    .env.example
```

## What works in the demo

- Responsive marketing site, exam browsing / filtering, details and exam rules.
- Role-based sign-in and self-service student registration; session token, hashed demo passwords.
- Server-persisted student registrations with simulated payment records.
- Sample JEE / NEET single-choice MCQs and metadata.
- Server-based exam start time, 12-minute timer, answer auto-saving, review marks, one attempt per student/exam, idempotency guard at submission, scoring (+4 / −1), explanations, persisted results.
- Student dashboard, results, wallet/rewards *information-only* page, and support ticket submission.
- Teacher sample question bank and paper-submission workflow.
- Admin overview, users, exam publication state, paper review, support tickets, audit trail.
- Super admin illustrative collection, 60/40 projection, transactions and audits.
- Backend automated scoring and access-rule tests.

## Scope and production gaps — IMPORTANT

**This is a demo/prototype, not a production-ready examination, payment, or payout service.** Live payments, actual ranking across multiple participants, genuine national leaderboards, full JEE/NEET paper lengths, a complete question builder and random generator, certificates, real notifications, refunds, wallet credits, payouts/KYC, revenue settlement, anti-cheat enforcement and true remote proctoring are not implemented. The visible exam safeguards include tab visibility counts, but these are not reliable proctoring or fraud prevention.

The backend uses **a JSON file and in-memory login sessions** instead of a robust production database/session store. It has no rate limiting, OTP/email validation, CSRF controls, password reset, database transactions, concurrency-safe wallet ledger, durable session storage, or trusted exam-time synchronization mechanism. Deploying publicly requires security hardening, a real DB (PostgreSQL recommended), guarded transactions, an email/SMS provider, server-side validated payment callbacks, production authentication, data protection, proper academic paper validation and load testing. Guard against malicious clients and duplicate requests. The sample question bank is intentionally short and may not be suitable as a real exam.

**Legal/compliance:** Paid entry, monetary rewards, payout wallets and minor KYC/withdrawals may implicate specific Indian laws and regulations. Do not activate or market real cash prizes or paid competitions before receiving qualified legal advice and obtaining the necessary service-provider approvals. Do not claim NTA / JEE / NEET affiliation. Webcam or screen monitoring requires separate consent/privacy review.

## Tests

```bash
cd backend
npm test
```

## Branding

LGW DIGITAL HUB is the top-left parent brand; LGW MERITX is the product. To replace the CSS/SVG approximation with a finalized official logo, edit `frontend/src/components/Brand.jsx` and `Brand.css`. The attached original SW DIGITAL HUB logo is retained **as a reference only**; its text is not mechanically modified in the source image.
