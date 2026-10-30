# MERITX — Learn. Practice. Rise.

MERITX is a comprehensive educational platform featuring authentic mock examinations, role-based workflows, and a full-featured Student Wallet, Course Enrollment, and Administrative Finance System. The system is built with a React 19 / Vite frontend and an Express / PostgreSQL API designed for high-concurrency safety and zero-trust security.

---

## Architecture & Technology Stack

- **Frontend**: React 19, Vite, React Router 7, Lucide Icons, Vanilla CSS design system.
- **Backend**: Node.js, Express, PostgreSQL (Neon / Managed Postgres), pg connection pool, JWT authentication, bcrypt, express-rate-limit.
- **Financial Architecture**:
  - Double-entry-ready transaction ledger with row-level locks (`SELECT ... FOR UPDATE`) and advisory transaction locks (`pg_advisory_xact_lock`).
  - Strict zero-trust security: Roles, student IDs, balances, and course prices are never trusted from client input.
  - Public course pricing privacy: Course prices, enrollment charges, and wallet balances are hidden from unauthenticated visitors with *"Login to view price"*.
  - Strict data isolation: Teachers have access only to assigned courses, curriculum authoring, and authorized student rosters. Student wallet balances, deposit logs, and financial totals are completely hidden from faculty.
  - DEMO MODE: Simulated deposit orders and withdrawals are clearly labeled with prominent badges across all UI views. No real banking transfers or false claims are made until live merchant credentials and compliance onboarding are completed.

---

## Role-Based Access Control (RBAC)

The system supports three distinct authenticated roles:

| Role | Permissions & Accessible Sections | Route Protection |
|---|---|---|
| **Student** | Overview, My Courses, Browse Courses (with wallet enrollment), My Wallet, Add Money (Demo), Withdraw Money, Deposit History, Transaction History, Profile & Settings, Mock Tests & Results, Support. | `/student/*`, `/take/:id` |
| **Teacher** | Faculty Workspace, Assigned Courses with enrollment counts & student rosters, Faculty Profile, Question Bank Importer (PDF/Excel), Question Bank Reviews, Paper Authoring. *(Zero financial/wallet visibility)* | `/teacher/*` |
| **Admin / Superadmin** | Operations Overview, Finance Command Center (10 DB aggregates, reconciliation, CSV export), Student Wallet Management, Withdrawal Requests Workflow (Approve/Reject), Financial Reports, Catalog/Exam Management, Question Bank Approval. | `/admin/*`, `/superadmin/*` |

### Default Demo Credentials

For quick evaluation, pre-seeded demo accounts are available:

- **Demo Student**: `student@meritx.internal` / `StudentPass123!` (Pre-credited with ₹5,000 demo INR)
- **Demo Teacher**: `teacher@meritx.internal` / `TeacherPass123!` (Assigned to JEE & NEET courses)
- **Demo Admin**: `admin@meritx.internal` / `AdminPass123!`

New users can also self-register with any role (Student, Teacher, Admin) on the `/register` page.

---

## Student Wallet & Course Enrollment Engine

### 1. Individual Student Wallet (INR ₹)
- **Available Balance**: Immediately usable for course enrollments and withdrawal requests.
- **Total Deposited**: Lifetime sum of verified top-ups.
- **Total Spent on Courses**: Total debited atomically for course enrollments.
- **Total Withdrawn**: Completed payouts approved by an administrator.
- **Pending / Reserved Funds**: Funds locked during active withdrawal review.
- **Transaction Ledger**: Complete, tamper-proof history of every credit, debit, refund, and adjustment with unique references and statuses (*Pending, Successful, Failed, Reversed*).

### 2. Course Enrollment with Atomic Wallet Debit
When a student selects **Enroll Now** on any course:
1. Fetches the verified course price from the database (`courses.fee * (1 - discount_percent/100)`).
2. Displays a **Checkout Confirmation Modal** with course details, current balance, price, and projected balance after debit.
3. If funds are insufficient, warns with the exact shortfall and provides an **Add Money** shortcut.
4. If sufficient, executes an atomic database transaction:
   - Acquires a row-level lock on the student's wallet row (`FOR UPDATE`).
   - Verifies eligible balance again inside the lock.
   - Atomically debits the course price.
   - Creates the `course_enrollments` record.
   - Writes a debit record to `wallet_transactions`.
   - Prevents double-enrollment or duplicate debits.
   - Automatically rolls back if any step fails.
5. Immediately unlocks course access under **My Courses**.

### 3. Add Money / Deposit (DEMO MODE)
- Preset deposit amounts (₹500, ₹1,000, ₹2,000, ₹5,000) or custom input.
- Payment method selector: UPI (PhonePe, Google Pay, Paytm), Debit/Credit Card, Net Banking.
- Two-phase order creation & verification simulation:
  - `POST /api/me/wallet/deposit/order` -> generates order in `payment_orders`.
  - `POST /api/me/wallet/deposit/verify` -> verifies cryptographic signature, credits wallet atomically, updates order to `paid`, and writes transaction ledger.
- Clear **DEMO MODE** notice throughout.

### 4. Withdraw Money & Funds Reservation Policy
- Available and eligible balance calculation.
- Payout destination options: UPI ID (VPA) or Bank Account (Account Number, IFSC, Account Holder Name).
- When a student submits a request:
  - Funds are immediately reserved and deducted from `available_balance` to prevent double spending.
  - Recorded in `withdrawal_requests` with status `pending`.
- Admin Workflow:
  - **Approve**: Marks request as `completed` / `approved`, records payout reference.
  - **Reject**: Restores the locked funds back into the student's available balance atomically, records rejection reason, and updates student view.

---

## Admin Finance Dashboard & Reports

Accessible via `/admin/finance` or `/superadmin`:

### 1. Ten Real Database Aggregate Summary Cards
1. **Total Registered Students**
2. **Total Registered Faculty**
3. **Total Active Courses**
4. **Total Course Enrollments**
5. **Total Successful Deposits** (INR ₹)
6. **Total Completed Withdrawals** (INR ₹)
7. **Total Course Sales Revenue** (INR ₹)
8. **Total Outstanding Student Wallet Liabilities** (INR ₹)
9. **Total Pending Withdrawal Requests**
10. **Total Pending Payment Transactions**

### 2. Wallet Reconciliation & Capital Segregation
Distinguishes:
- **Total Student Deposits**: Gross funds injected into wallets (Held in Trust).
- **Earned Course Sales Revenue**: Recognized platform revenue.
- **Completed Withdrawals**: Settled payouts to students.
- **Outstanding Wallet Liabilities**: Unspent student balances held in trust.
- **Refunds & Reversals**: Corrected transactions.
- **Settlement Pipeline Status**: Gateway integration status.

### 3. Student Wallet Management Directory
- Searchable by student name or email; filterable by account status.
- Displays wallet balance, lifetime deposits, course spending, withdrawals, and enrolled courses.
- **Student Dossier Modal**: Full view of an individual student's balance, enrolled courses, ledger transactions, and withdrawal requests.

### 4. Withdrawal Request Workflow
- Pending payout queue with student information, amount, method, and destination details.
- Modal to **Approve & Mark Completed** (with payout reference) or **Reject & Restore Funds** (with mandatory reason).

### 5. Financial Reports & CSV Export
- Daily, weekly, and monthly reports.
- Course-wise sales report (enrollments & revenue per course).
- Student-wise payment activity report.
- **1-Click CSV Export**: Streams real database ledger lines with audit headers for offline accounting.

---

## API Endpoints Reference

### Public
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health & PostgreSQL readiness check |
| `GET` | `/api/exams` | Catalog exams (prices masked if not logged in) |
| `GET` | `/api/exams/:id` | Exam details (prices masked if not logged in) |
| `GET` | `/api/courses` | Published courses (prices masked if not logged in) |
| `GET` | `/api/landing-content` | Public landing content |

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register student, teacher, or admin account |
| `POST` | `/api/auth/login` | Login and receive secure JWT token |
| `GET` | `/api/auth/me` | Retrieve authenticated profile & role |

### Student Profile & Courses
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/me/profile` | Get student academic profile |
| `PUT` | `/api/me/profile` | Update student academic profile |
| `GET` | `/api/me/courses` | List student's enrolled courses |
| `POST` | `/api/me/courses/enroll` | Atomically debit wallet and enroll in course |
| `GET` | `/api/me/dashboard` | Student exam attempts & registrations |

### Student Wallet & Withdrawals
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/me/wallet` | Student wallet balance, stats, and ledger |
| `POST` | `/api/me/wallet/deposit/order` | Create simulated deposit order |
| `POST` | `/api/me/wallet/deposit/verify` | Verify deposit and credit wallet atomically |
| `POST` | `/api/me/wallet/withdraw` | Submit withdrawal request and reserve funds |
| `GET` | `/api/me/wallet/withdrawals` | Student's withdrawal request history |

### Teacher Workspace (Isolated)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/teacher/dashboard` | Assigned courses, student counts & rosters |
| `GET` | `/api/teacher/profile` | Get faculty profile |
| `PUT` | `/api/teacher/profile` | Update faculty credentials and bio |
| `GET` | `/api/teacher/papers` | Author papers |
| `POST` | `/api/teacher/question-banks/import` | Upload Excel/PDF MCQs |

### Admin Finance & Operations
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/finance/overview` | 10 DB aggregates & reconciliation metrics |
| `GET` | `/api/admin/finance/wallets` | Searchable student wallet directory |
| `GET` | `/api/admin/finance/wallets/:id` | Student wallet dossier |
| `GET` | `/api/admin/finance/withdrawals` | Admin withdrawal requests queue |
| `POST` | `/api/admin/finance/withdrawals/:id` | Approve or reject withdrawal request |
| `GET` | `/api/admin/finance/reports` | Daily, weekly, monthly report aggregates |
| `GET` | `/api/admin/finance/reports/export-csv` | Download CSV financial ledger |
| `GET/POST/PUT/DELETE` | `/api/admin/courses` | Manage course catalog |

---

## Local Development & Setup

### Requirements
- Node.js 20+
- PostgreSQL database (Neon or local PostgreSQL 14+)

### 1. Backend Setup

```powershell
cd backend
npm install

# Copy environment variables
Copy-Item .env.example .env

# Configure your database connection in .env:
# DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
# JWT_SECRET=your_32_character_super_secret_key_here

# Run migrations (automatically creates all tables, wallets, and demo seed data)
node src/scripts/migrate.js

# Run test suite (All 37 unit and integration tests)
npm test

# Start backend development server
npm run dev
```

### 2. Frontend Setup

```powershell
cd frontend
npm install

# Build production bundle
npm run build

# Start frontend development server
npm run dev
```

Access the frontend at `http://localhost:5173`. The backend runs on `http://localhost:5000`.

---

## Production Payment Activation Checklist (Razorpay / UPI)

Currently, the system operates in **DEMO MODE** with simulated transactions. To activate live Indian payments via Razorpay (including UPI, Google Pay, PhonePe, Cards, Net Banking):

1. **Merchant Onboarding & KYC**:
   - Complete merchant registration on the [Razorpay Dashboard](https://dashboard.razorpay.com).
   - Submit business documentation, bank account proof, and GSTIN/PAN verification.
2. **Configure Environment Variables in `backend/.env`**:
   ```ini
   PAYMENT_PROVIDER=razorpay
   PAYMENT_MODE=live
   RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_live_key_secret_here
   RAZORPAY_WEBHOOK_SECRET=your_live_webhook_secret_here
   ```
3. **Register Webhook Endpoint**:
   - In Razorpay Dashboard > Settings > Webhooks, add:
     `https://your-domain.com/api/payments/webhook`
   - Select events: `payment.captured`, `payment.failed`, `order.paid`.
4. **Payouts Activation (for Real Withdrawals)**:
   - For real student withdrawals, onboard with **Razorpay X** or an approved payout partner.
   - Complete Payout KYC and fund the current account.
   - Toggle payout execution in `platform.service.js` under `reviewWithdrawal()`.
