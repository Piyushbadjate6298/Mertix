CREATE TABLE IF NOT EXISTS question_banks (
  id TEXT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  subject VARCHAR(60) NOT NULL,
  source_filename VARCHAR(255),
  source_type VARCHAR(20),
  extraction_status VARCHAR(30) NOT NULL DEFAULT 'ready',
  extraction_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_exam_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS question_banks_owner_idx ON question_banks(created_by, updated_at DESC);
CREATE INDEX IF NOT EXISTS question_banks_status_idx ON question_banks(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS bank_questions (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_option INTEGER,
  explanation TEXT,
  subject VARCHAR(60),
  chapter VARCHAR(120),
  topic VARCHAR(120),
  difficulty VARCHAR(20) NOT NULL DEFAULT 'Medium',
  image_url TEXT,
  extraction_confidence NUMERIC(5,2),
  extraction_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bank_id, position)
);
CREATE INDEX IF NOT EXISTS bank_questions_bank_idx ON bank_questions(bank_id, position);
CREATE INDEX IF NOT EXISTS bank_questions_hash_idx ON bank_questions(content_hash);

ALTER TABLE attempts ADD COLUMN IF NOT EXISTS question_snapshot JSONB;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS positive_marks NUMERIC(8,2) NOT NULL DEFAULT 4;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS negative_marks NUMERIC(8,2) NOT NULL DEFAULT -1;
