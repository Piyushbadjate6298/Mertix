-- Migration 009: Student Wallets, Course Enrollments, Withdrawal Requests & Admin Finance System

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(20),
  bio TEXT,
  target_exam VARCHAR(100),
  city VARCHAR(100),
  state VARCHAR(100),
  academic_year VARCHAR(20),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacher_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  designation VARCHAR(120),
  department VARCHAR(120),
  specialization VARCHAR(200),
  bio TEXT,
  experience_years INTEGER DEFAULT 0,
  phone VARCHAR(20),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS teacher_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS courses_teacher_idx ON courses(teacher_id);

CREATE TABLE IF NOT EXISTS course_enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  fee_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'wallet',
  transaction_id TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','refunded')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);
CREATE INDEX IF NOT EXISTS course_enrollments_student_idx ON course_enrollments(student_id);
CREATE INDEX IF NOT EXISTS course_enrollments_course_idx ON course_enrollments(course_id);

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  locked_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (locked_balance >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wallets_user_idx ON wallets(user_id);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL CHECK (type IN ('deposit','course_purchase','withdrawal','withdrawal_hold','withdrawal_release','refund','reversal','adjustment')),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('credit','debit')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance_before NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'successful' CHECK (status IN ('pending','successful','failed','reversed')),
  reference_id VARCHAR(180) UNIQUE,
  description VARCHAR(300) NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wallet_tx_user_date_idx ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_tx_wallet_date_idx ON wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_tx_type_status_idx ON wallet_transactions(type, status);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id TEXT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payout_method VARCHAR(30) NOT NULL CHECK (payout_method IN ('bank_transfer','upi')),
  payout_details JSONB NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','approved','completed','rejected','cancelled')),
  transaction_id TEXT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  admin_notes TEXT,
  rejection_reason TEXT,
  reference_number VARCHAR(100) UNIQUE,
  processed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS withdrawal_req_user_idx ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS withdrawal_req_status_idx ON withdrawal_requests(status);

CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id TEXT REFERENCES wallets(id) ON DELETE CASCADE,
  purpose VARCHAR(50) NOT NULL DEFAULT 'wallet_deposit' CHECK (purpose IN ('wallet_deposit','course_purchase','exam_registration')),
  target_id TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  amount_paise BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  payment_method VARCHAR(50) NOT NULL DEFAULT 'upi',
  gateway VARCHAR(80) NOT NULL DEFAULT 'RAZORPAY_DEMO',
  gateway_order_id TEXT UNIQUE,
  gateway_payment_id TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'created' CHECK (status IN ('created','attempted','captured','failed','cancelled','refunded')),
  error_message TEXT,
  idempotency_key VARCHAR(180) UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS payment_orders_user_idx ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS payment_orders_status_idx ON payment_orders(status);

-- Seed initial teacher assignment to demo courses
UPDATE courses SET teacher_id = 'teacher-1' WHERE teacher_id IS NULL AND id IN ('course-jee-main','course-jee-advanced','course-mht-cet');

-- Set realistic demo fees for courses if they are 0
UPDATE courses SET fee = 1499.00 WHERE id = 'course-jee-main' AND fee = 0;
UPDATE courses SET fee = 2499.00 WHERE id = 'course-jee-advanced' AND fee = 0;
UPDATE courses SET fee = 999.00 WHERE id = 'course-mht-cet' AND fee = 0;
UPDATE courses SET fee = 1899.00 WHERE id = 'course-neet' AND fee = 0;

-- Ensure demo student profile exists
INSERT INTO student_profiles (user_id, phone, bio, target_exam, city, state, academic_year)
VALUES ('student-1', '+91 98765 43210', 'Aspiring engineering student preparing for JEE Main & Advanced.', 'JEE Main', 'Pune', 'Maharashtra', '2027')
ON CONFLICT (user_id) DO NOTHING;

-- Ensure demo teacher profile exists
INSERT INTO teacher_profiles (user_id, designation, department, specialization, bio, experience_years, phone)
VALUES ('teacher-1', 'Senior Physics Faculty', 'Department of Physics', 'Mechanics, Electrodynamics & Quantum Physics', 'Mentoring top JEE Advanced and Olympiad aspirants for over 12 years.', 12, '+91 98220 12345')
ON CONFLICT (user_id) DO NOTHING;

-- Initialize wallet for demo student with starting balance ₹5,000
INSERT INTO wallets (id, user_id, balance, locked_balance, currency, status)
VALUES ('wallet-student-1', 'student-1', 5000.00, 0.00, 'INR', 'active')
ON CONFLICT (user_id) DO UPDATE SET balance = CASE WHEN wallets.balance = 0 THEN 5000.00 ELSE wallets.balance END;

-- Seed initial welcome deposit transaction if none exists
INSERT INTO wallet_transactions (id, wallet_id, user_id, type, direction, amount, balance_before, balance_after, status, reference_id, description, metadata)
VALUES (
  'tx-init-student-1',
  'wallet-student-1',
  'student-1',
  'deposit',
  'credit',
  5000.00,
  0.00,
  5000.00,
  'successful',
  'DEP-DEMO-WELCOME-01',
  'Welcome Demo Deposit (DEMO MODE)',
  '{"gateway":"DEMO_SANDBOX","method":"UPI - PhonePe"}'::jsonb
)
ON CONFLICT (reference_id) DO NOTHING;
