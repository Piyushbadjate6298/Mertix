ALTER TABLE payments ADD COLUMN IF NOT EXISTS course_id TEXT REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_paise BIGINT NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'INR';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_order_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS payments_gateway_order_unique ON payments(gateway_order_id) WHERE gateway_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_gateway_payment_unique ON payments(gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_exam_student_status_idx ON payments(student_id, exam_id, status);
