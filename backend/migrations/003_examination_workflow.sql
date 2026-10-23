ALTER TABLE question_banks DROP CONSTRAINT IF EXISTS question_banks_status_check;
ALTER TABLE question_banks ADD CONSTRAINT question_banks_status_check
  CHECK (status IN ('draft','submitted','under_review','approved','published','rejected'));
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS external_question_id VARCHAR(160);
ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(30) NOT NULL DEFAULT 'single_correct';
ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS correct_options JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS option_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS source_page INTEGER;

UPDATE bank_questions
SET correct_options = jsonb_build_array(correct_option)
WHERE correct_option IS NOT NULL AND jsonb_array_length(correct_options) = 0;

CREATE TABLE IF NOT EXISTS published_exams (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL UNIQUE REFERENCES question_banks(id) ON DELETE RESTRICT,
  title VARCHAR(160) NOT NULL,
  exam_type VARCHAR(80) NOT NULL DEFAULT 'Imported examination',
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_minutes INTEGER NOT NULL DEFAULT 180 CHECK (duration_minutes BETWEEN 1 AND 600),
  is_free BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('upcoming','published','cancelled')),
  published_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  question_count INTEGER NOT NULL CHECK (question_count > 0)
);
CREATE INDEX IF NOT EXISTS published_exams_status_idx ON published_exams(status, published_at DESC);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS subjects_name_lower_idx ON subjects(LOWER(name));

CREATE TABLE IF NOT EXISTS question_bank_events (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS question_bank_events_bank_idx ON question_bank_events(bank_id, created_at DESC);

ALTER TABLE attempts ALTER COLUMN positive_marks SET DEFAULT 0;
ALTER TABLE attempts ALTER COLUMN negative_marks SET DEFAULT 0;
