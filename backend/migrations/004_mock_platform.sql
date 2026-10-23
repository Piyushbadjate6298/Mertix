CREATE TABLE IF NOT EXISTS exam_patterns (
  id TEXT PRIMARY KEY,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  official_year INTEGER,
  configuration JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(code, version)
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  slug VARCHAR(180) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(100) NOT NULL,
  exam_type VARCHAR(100) NOT NULL,
  short_description VARCHAR(300) NOT NULL DEFAULT '',
  full_description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  banner_image_url TEXT,
  fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  duration_days INTEGER NOT NULL DEFAULT 0 CHECK (duration_days >= 0),
  mock_test_count INTEGER NOT NULL DEFAULT 0 CHECK (mock_test_count >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS courses_public_idx ON courses(status,is_visible,display_order);

CREATE TABLE IF NOT EXISTS landing_content (
  key VARCHAR(100) PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS import_mode VARCHAR(30) NOT NULL DEFAULT 'compatible_practice';
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS pattern_code VARCHAR(80);
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS import_summary JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS source_limitations JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS source_row INTEGER;
ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS paper_number INTEGER;
ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS section_number INTEGER;
ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS source_question_type VARCHAR(60);
ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS numerical_answer NUMERIC;
ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS numerical_precision INTEGER;
ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS question_stem_id VARCHAR(160);
ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS matching_list_data JSONB;

ALTER TABLE published_exams ADD COLUMN IF NOT EXISTS course_id TEXT REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE published_exams ADD COLUMN IF NOT EXISTS pattern_id TEXT REFERENCES exam_patterns(id) ON DELETE RESTRICT;
ALTER TABLE published_exams ADD COLUMN IF NOT EXISTS pattern_version INTEGER;
ALTER TABLE published_exams ADD COLUMN IF NOT EXISTS configuration_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE published_exams ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE published_exams ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE published_exams ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE published_exams ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE published_exams ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE published_exams ADD COLUMN IF NOT EXISTS registration_open BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE published_exams ADD COLUMN IF NOT EXISTS import_mode VARCHAR(30) NOT NULL DEFAULT 'compatible_practice';
ALTER TABLE published_exams ADD COLUMN IF NOT EXISTS paper_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE attempts ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS accepted_instructions_at TIMESTAMPTZ;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS current_segment INTEGER NOT NULL DEFAULT 1;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS segment_started_at TIMESTAMPTZ;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS segment_state JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO landing_content (key,payload) VALUES
('about_courses','{"heading":"About Our Courses","description":"Structured mock examinations for JEE Main, JEE Advanced, MHT-CET and NEET UG.","buttonLabel":"Explore examinations","visible":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO exam_patterns (id,code,name,version,official_year,configuration,status,is_builtin) VALUES
('pattern-jee-main-2026-v1','jee-main-2026','JEE Main Paper 1 2026',1,2026,
 '{"durationMinutes":180,"questionCount":75,"maximumMarks":300,"papers":1,"subjects":["Physics","Chemistry","Mathematics"],"rules":{"single_correct":{"correct":4,"incorrect":-1,"unanswered":0},"numerical":{"correct":4,"incorrect":-1,"unanswered":0}},"strict":{"perSubject":{"single_correct":20,"numerical":5}},"instructions":["Each subject contains 20 single-correct MCQs and 5 compulsory numerical-value questions.","Incorrect MCQ and numerical responses receive one negative mark."]}'::jsonb,'active',TRUE),
('pattern-jee-advanced-2026-v1','jee-advanced-2026','JEE Advanced 2026',1,2026,
 '{"durationMinutes":360,"questionCount":102,"maximumMarks":360,"papers":2,"paperDurations":[180,180],"subjects":["Physics","Chemistry","Mathematics"],"rules":{"single_correct":{"correct":3,"incorrect":-1,"unanswered":0},"multiple_correct":{"correct":4,"incorrect":-1,"unanswered":0,"partial":true},"numerical":{"correct":4,"incorrect":0,"unanswered":0},"matching_list":{"correct":4,"incorrect":-1,"unanswered":0},"linked_numerical":{"correct":2,"incorrect":0,"unanswered":0}},"strict":{"paper1":{"perSubject":{"single_correct":4,"multiple_correct":4,"numerical":4,"matching_list":4}},"paper2":{"perSubject":{"single_correct":4,"multiple_correct":5,"numerical":5,"linked_numerical":4}}},"instructions":["Paper 1 and Paper 2 are compulsory and have separate 180-minute timers.","Multiple-correct questions award official subset partial marks only when no incorrect option is selected."]}'::jsonb,'active',TRUE),
('pattern-mht-cet-pcm-2026-v1','mht-cet-pcm-2026','MHT-CET PCM 2026',1,2026,
 '{"durationMinutes":180,"questionCount":150,"maximumMarks":200,"papers":1,"subjects":["Physics","Chemistry","Mathematics"],"rules":{"single_correct":{"correct":1,"incorrect":0,"unanswered":0},"subjectOverrides":{"Mathematics":{"correct":2,"incorrect":0}}},"segments":[{"number":1,"durationMinutes":90,"subjects":["Physics","Chemistry"],"locksOnExpiry":true},{"number":2,"durationMinutes":90,"subjects":["Mathematics"],"locksOnExpiry":true}],"strict":{"subjectCounts":{"Physics":50,"Chemistry":50,"Mathematics":50}},"instructions":["Physics and Chemistry are available for the first 90 minutes and lock permanently when that block ends.","Mathematics is available only in the second 90-minute block.","There is no negative marking."]}'::jsonb,'active',TRUE),
('pattern-neet-ug-2026-v1','neet-ug-2026','NEET UG 2026',1,2026,
 '{"durationMinutes":180,"questionCount":180,"maximumMarks":720,"papers":1,"subjects":["Physics","Chemistry","Biology"],"rules":{"single_correct":{"correct":4,"incorrect":-1,"unanswered":0}},"strict":{"subjectCounts":{"Physics":45,"Chemistry":45,"Biology":90}},"instructions":["This is a digital OMR-inspired MeritX mock and is not an official government examination system.","Correct responses receive four marks and incorrect responses receive one negative mark."]}'::jsonb,'active',TRUE)
ON CONFLICT (code,version) DO NOTHING;

INSERT INTO courses (id,slug,name,category,exam_type,short_description,full_description,fee,duration_days,mock_test_count,status,is_visible,is_featured,display_order) VALUES
('course-jee-main','jee-main-2026','JEE Main 2026 Mock Tests','Engineering Entrance','JEE Main','Full-length JEE Main practice with server-side scoring.','Practice the configured JEE Main pattern with detailed results and explanations.',0,180,1,'published',TRUE,TRUE,1),
('course-jee-advanced','jee-advanced-2026','JEE Advanced 2026 Practice','Engineering Entrance','JEE Advanced','Two-paper advanced practice with partial marking support.','Compatible uploaded banks are clearly labeled as practice sets until genuine section metadata is provided.',0,180,1,'published',TRUE,TRUE,2),
('course-mht-cet','mht-cet-pcm-2026','MHT-CET PCM 2026 Mock Tests','State Entrance','MHT-CET PCM','PCM mock tests with a locked 90+90 minute flow.','Physics and Chemistry run first, followed by the Mathematics block.',0,120,1,'published',TRUE,TRUE,3),
('course-neet','neet-ug-2026','NEET UG 2026 Mock Tests','Medical Entrance','NEET UG','Digital OMR-inspired NEET practice.','Full-length NEET mock tests with subject-wise analytics.',0,180,1,'published',TRUE,TRUE,4)
ON CONFLICT (id) DO NOTHING;
