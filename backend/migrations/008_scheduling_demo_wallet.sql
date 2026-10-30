ALTER TABLE exam_overrides ADD COLUMN IF NOT EXISTS schedule JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE exam_overrides ADD COLUMN IF NOT EXISTS prize_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_subject VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS users_google_subject_unique ON users(google_subject) WHERE google_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS demo_wallet_ledger (
  id TEXT PRIMARY KEY,
  transaction_key VARCHAR(180) NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  exam_id TEXT,
  kind VARCHAR(32) NOT NULL CHECK (kind IN ('demo_prize','demo_adjustment','demo_registration','demo_refund')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount <> 0),
  status VARCHAR(24) NOT NULL DEFAULT 'credited' CHECK (status IN ('pending','credited','reversed')),
  memo VARCHAR(300) NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS demo_wallet_user_date_idx ON demo_wallet_ledger(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS demo_prize_distributions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  UNIQUE(exam_id,student_id,rank)
);
