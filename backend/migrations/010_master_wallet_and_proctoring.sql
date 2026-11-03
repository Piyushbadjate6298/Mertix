-- Migration 010: Platform Master Wallet, Double-Entry Platform Ledger, Admin Bank Payouts & Live Exam Proctoring

-- 1. Platform Master Ledger (Auditable, immutable platform financial record)
CREATE TABLE IF NOT EXISTS platform_master_ledger (
  id TEXT PRIMARY KEY,
  transaction_key VARCHAR(180) UNIQUE NOT NULL,
  category VARCHAR(40) NOT NULL CHECK (category IN ('treasury', 'user_liability', 'reward_liability', 'refund_liability', 'gateway_settlement')),
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'initial_balance',
    'course_sales_revenue',
    'platform_commission',
    'exam_payment_collected',
    'teacher_share_credit',
    'student_deposit_liability',
    'admin_payout_disbursed',
    'admin_payout_fee',
    'refund_disbursed',
    'reward_reserved',
    'reward_disbursed',
    'gateway_charge',
    'adjustment'
  )),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(12,2) NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  exam_id TEXT,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  reference_id VARCHAR(180),
  description VARCHAR(300) NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS platform_ledger_date_idx ON platform_master_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS platform_ledger_category_idx ON platform_master_ledger(category, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_ledger_type_idx ON platform_master_ledger(type);

-- 2. Platform Payout Requests (Admin / Super Admin Bank Withdrawals)
CREATE TABLE IF NOT EXISTS platform_payout_requests (
  id TEXT PRIMARY KEY,
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  fee_deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount > 0),
  bank_name VARCHAR(120) NOT NULL,
  account_holder_name VARCHAR(160) NOT NULL,
  account_number_masked VARCHAR(50) NOT NULL,
  ifsc_code VARCHAR(20) NOT NULL,
  withdrawal_purpose VARCHAR(255) NOT NULL DEFAULT 'Platform Revenue Payout',
  status VARCHAR(30) NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested',
    'awaiting_approval',
    'processing',
    'completed',
    'failed',
    'reversed',
    'rejected'
  )),
  idempotency_key VARCHAR(180) UNIQUE NOT NULL,
  gateway_payout_id VARCHAR(180),
  utr_number VARCHAR(100),
  admin_notes TEXT,
  failure_reason TEXT,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS platform_payout_status_idx ON platform_payout_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_payout_user_idx ON platform_payout_requests(requested_by);

-- 3. Platform Settings (Configurable business bank accounts, revenue allocations, and rules)
CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(80) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default platform settings
INSERT INTO platform_settings (key, value)
VALUES
(
  'business_bank_account',
  '{
    "accountHolderName": "MERITX ACADEMIC TECHNOLOGIES PVT LTD",
    "bankName": "HDFC Bank Ltd",
    "accountNumberMasked": "••••••••6721",
    "ifscCode": "HDFC0000240",
    "branch": "Senapati Bapat Road, Pune",
    "accountType": "Current Account",
    "isVerified": true,
    "payoutMode": "NEFT_RTGS_IMPS"
  }'::jsonb
),
(
  'financial_rules',
  '{
    "platformRevenuePercent": 40.0,
    "teacherRevenuePercent": 60.0,
    "payoutProcessingFee": 5.0,
    "minimumAdminWithdrawal": 100.0,
    "maximumAdminWithdrawalPerTx": 500000.0,
    "requireReauth": true
  }'::jsonb
),
(
  'proctoring_config',
  '{
    "maxWarnings": 3,
    "faceGracePeriodSeconds": 4,
    "warningCooldownSeconds": 8,
    "autoSubmitOnMaxWarnings": false,
    "requireFullscreen": true,
    "detectDevices": true,
    "detectMultipleFaces": true
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 4. Attempts table proctoring enhancements
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS flag_reason TEXT;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS proctoring_status VARCHAR(30) NOT NULL DEFAULT 'unmonitored';

-- 5. Proctoring Sessions
CREATE TABLE IF NOT EXISTS proctoring_sessions (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  camera_status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (camera_status IN ('active', 'interrupted', 'stopped', 'revoked')),
  verification_checks JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent_given_at TIMESTAMPTZ,
  warning_count INTEGER NOT NULL DEFAULT 0,
  is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  interruption_count INTEGER NOT NULL DEFAULT 0,
  total_interruption_seconds INTEGER NOT NULL DEFAULT 0,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS proctoring_sessions_exam_idx ON proctoring_sessions(exam_id);
CREATE INDEX IF NOT EXISTS proctoring_sessions_student_idx ON proctoring_sessions(student_id);
CREATE INDEX IF NOT EXISTS proctoring_sessions_status_idx ON proctoring_sessions(camera_status, is_flagged);

-- 6. Proctoring Events (Granular event stream)
CREATE TABLE IF NOT EXISTS proctoring_events (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES proctoring_sessions(id) ON DELETE CASCADE,
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS proctoring_events_attempt_idx ON proctoring_events(attempt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS proctoring_events_student_idx ON proctoring_events(student_id);
CREATE INDEX IF NOT EXISTS proctoring_events_type_idx ON proctoring_events(event_type, severity);

-- 7. Proctoring Warnings (Three-level warning records)
CREATE TABLE IF NOT EXISTS proctoring_warnings (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL,
  warning_number INTEGER NOT NULL CHECK (warning_number BETWEEN 1 AND 3),
  category VARCHAR(50) NOT NULL CHECK (category IN ('face_not_visible', 'multiple_faces_or_device', 'exam_rule_violation')),
  message VARCHAR(300) NOT NULL,
  evidence_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS proctoring_warnings_attempt_idx ON proctoring_warnings(attempt_id, warning_number);
CREATE INDEX IF NOT EXISTS proctoring_warnings_student_idx ON proctoring_warnings(student_id);

-- 8. Ensure demo teacher wallet exists with initial allocations
INSERT INTO wallets (id, user_id, balance, locked_balance, currency, status)
VALUES ('wallet-teacher-1', 'teacher-1', 12500.00, 0.00, 'INR', 'active')
ON CONFLICT (user_id) DO NOTHING;

-- Seed initial teacher credit transaction if not exists
INSERT INTO wallet_transactions (id, wallet_id, user_id, type, direction, amount, balance_before, balance_after, status, reference_id, description, metadata)
VALUES (
  'tx-init-teacher-1',
  'wallet-teacher-1',
  'teacher-1',
  'deposit',
  'credit',
  12500.00,
  0.00,
  12500.00,
  'successful',
  'TCH-ROYALTY-INIT-01',
  'Faculty Course Royalty & Honorarium Credit (60% Revenue Share)',
  '{"course":"course-jee-main","enrollmentsCount":15,"revenueSharePercent":60}'::jsonb
)
ON CONFLICT (reference_id) DO NOTHING;

-- Seed initial platform master ledger entries to establish platform treasury
INSERT INTO platform_master_ledger (id, transaction_key, category, type, direction, amount, balance_after, reference_id, description, metadata)
VALUES
(
  'pml-init-01',
  'PML-KEY-INIT-01',
  'treasury',
  'initial_balance',
  'credit',
  75000.00,
  75000.00,
  'CAP-INIT-2026',
  'Initial Platform Working Capital & Settled Revenue Allocation',
  '{"settledFromGateway":"RazorpayX","settlementBatch":"SETTL-2026-001"}'::jsonb
),
(
  'pml-init-02',
  'PML-KEY-INIT-02',
  'reward_liability',
  'reward_reserved',
  'credit',
  15000.00,
  15000.00,
  'RWD-RES-JEE-2026',
  'Reserved Prize Pool Allocation for Top 3 JEE Mock Scorers',
  '{"examId":"exam-jee-main-2026-01","prizeDistributionPolicy":"Top 3 Ranks"}'::jsonb
)
ON CONFLICT (transaction_key) DO NOTHING;
