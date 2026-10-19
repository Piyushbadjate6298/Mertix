CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('student','teacher','admin','superadmin')),
  target VARCHAR(60),
  city VARCHAR(100),
  academic_year VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS exam_overrides (
  exam_id TEXT PRIMARY KEY,
  status VARCHAR(20) NOT NULL CHECK (status IN ('upcoming','published','cancelled')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL,
  gateway VARCHAR(80) NOT NULL DEFAULT 'SIMULATED—NO MONEY COLLECTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payments_student_idx ON payments(student_id);

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL,
  payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, exam_id)
);
CREATE INDEX IF NOT EXISTS registrations_exam_idx ON registrations(exam_id);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  marked JSONB NOT NULL DEFAULT '[]'::jsonb,
  result JSONB,
  duration_seconds INTEGER NOT NULL DEFAULT 720,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_saved_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  time_taken INTEGER,
  UNIQUE(student_id, exam_id)
);
CREATE INDEX IF NOT EXISTS attempts_student_idx ON attempts(student_id);

CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  subject VARCHAR(60) NOT NULL,
  question_count INTEGER NOT NULL CHECK (question_count BETWEEN 1 AND 180),
  status VARCHAR(20) NOT NULL DEFAULT 'submitted',
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(100) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS support_tickets_created_idx ON support_tickets(created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  detail VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log(created_at DESC);
