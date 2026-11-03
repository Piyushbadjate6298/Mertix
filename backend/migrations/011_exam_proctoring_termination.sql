-- Migration 011: Exam Proctoring Automatic Termination
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(100);
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS violation_history JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS attempts_status_idx ON attempts(status);
CREATE INDEX IF NOT EXISTS attempts_terminated_at_idx ON attempts(terminated_at DESC);
