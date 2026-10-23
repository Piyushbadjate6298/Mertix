import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { exams, questionsForExam } from '../data/platform.js';
import { evaluate } from '../utils/evaluation.js';
import { AppError } from '../utils/errors.js';
import { extractQuestionFile, questionHash } from './question-import.service.js';

const uid = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
const iso = (value) => value ? new Date(value).toISOString() : null;
const dateOnly = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const publicUser = (row) => row && ({ id: row.id, name: row.name, email: row.email, role: row.role, target: row.target, city: row.city, year: row.academic_year, createdAt: iso(row.created_at) });
const registration = (row) => ({ id: row.id, studentId: row.student_id, examId: row.exam_id, paymentId: row.payment_id, status: row.status, date: iso(row.created_at) });
const payment = (row) => ({ id: row.id, studentId: row.student_id, examId: row.exam_id, amount: Number(row.amount), status: row.status, gateway: row.gateway, date: iso(row.created_at) });
const paper = (row) => ({ id: row.id, title: row.title, subject: row.subject, questions: row.question_count, status: row.status, createdBy: row.created_by, date: iso(row.created_at) });
const ticket = (row) => ({ id: row.id, userId: row.user_id, subject: row.subject, message: row.message, status: row.status, createdAt: iso(row.created_at) });
const attempt = (row) => ({ id: row.id, studentId: row.student_id, examId: row.exam_id, status: row.status, answers: row.answers || {}, marked: row.marked || [], result: row.result, questions: row.status === 'submitted' ? (row.question_snapshot || []) : undefined, durationSeconds: row.duration_seconds, startedAt: iso(row.started_at), deadlineAt: iso(row.deadline_at), serverNow: new Date().toISOString(), acceptedInstructionsAt: iso(row.accepted_instructions_at), currentSegment: Number(row.current_segment || 1), segmentState: row.segment_state || {}, lastSavedAt: iso(row.last_saved_at), submittedAt: iso(row.submitted_at), timeTaken: row.time_taken });
const bankSummary = (row) => ({ id: row.id, title: row.title, subject: row.subject, sourceFilename: row.source_filename, sourceType: row.source_type, importMode: row.import_mode || 'compatible_practice', patternCode: row.pattern_code, importSummary: row.import_summary || {}, sourceLimitations: row.source_limitations || [], extractionStatus: row.extraction_status, warnings: row.extraction_warnings || [], status: row.status, rejectionReason: row.rejection_reason || '', version: Number(row.version || 1), createdBy: row.created_by, teacherName: row.teacher_name, approvedBy: row.approved_by, assignedExamId: row.assigned_exam_id, questionCount: Number(row.question_count || 0), incompleteCount: Number(row.incomplete_count || 0), duplicateCount: Number(row.duplicate_count || 0), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), submittedAt: iso(row.submitted_at), approvedAt: iso(row.approved_at), publishedAt: iso(row.published_at) });
const bankQuestion = (row) => ({ id: row.id, externalQuestionId: row.external_question_id, sourceRow: row.source_row, text: row.text, options: row.options || [], questionType: row.question_type || 'single_correct', sourceQuestionType: row.source_question_type, correctOptions: row.correct_options?.length ? row.correct_options : (Number.isInteger(row.correct_option) ? [row.correct_option] : []), correctOption: row.correct_option, numericalAnswer: row.numerical_answer === null ? null : Number(row.numerical_answer), numericalPrecision: row.numerical_precision, paperNumber: row.paper_number, sectionNumber: row.section_number, questionStemId: row.question_stem_id, matchingListData: row.matching_list_data, explanation: row.explanation || '', subject: row.subject, chapter: row.chapter || '', topic: row.topic || '', difficulty: row.difficulty, imageUrl: row.image_url, optionImageUrls: row.option_image_urls || [], reference: row.reference, sourcePage: row.source_page, extractionConfidence: Number(row.extraction_confidence || 0), extractionErrors: row.extraction_errors || [], duplicate: Boolean(row.is_duplicate) });
const pattern = (row) => ({ id: row.id, code: row.code, name: row.name, version: Number(row.version), officialYear: row.official_year, configuration: row.configuration, status: row.status, builtIn: row.is_builtin, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
const course = (row) => ({ id: row.id, slug: row.slug, name: row.name, category: row.category, examType: row.exam_type, shortDescription: row.short_description, fullDescription: row.full_description, imageUrl: row.image_url, bannerImageUrl: row.banner_image_url, fee: Number(row.fee), discountPercent: Number(row.discount_percent), durationDays: row.duration_days, mockTestCount: row.mock_test_count, publishedExamCount: Number(row.published_exam_count || 0), publishedQuestionCount: Number(row.published_question_count || 0), status: row.status, visible: row.is_visible, featured: row.is_featured, displayOrder: row.display_order, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });

export function createPlatformService(db) {
  async function log(actorId, action, detail, client = db) {
    await client.query('INSERT INTO audit_log (id, actor_id, action, detail) VALUES ($1,$2,$3,$4)', [uid('audit'), actorId, action, String(detail || '').slice(0, 500)]);
  }

  async function listExams(client = db) {
    const [overrideResult, publishedResult, courseResult] = await Promise.all([
      client.query('SELECT *, exam_date::text AS exam_date_text FROM exam_overrides'),
      client.query('SELECT p.*, c.image_url AS course_image_url, c.banner_image_url AS course_banner_image_url FROM published_exams p LEFT JOIN courses c ON c.id=p.course_id ORDER BY p.published_at DESC'),
      client.query(`SELECT * FROM courses WHERE status='published' AND is_visible=TRUE ORDER BY display_order,name`),
    ]);
    const overrides = Object.fromEntries(overrideResult.rows.map((row) => [row.exam_id, row]));
    const applyOverride = (exam) => {
      const row = overrides[exam.id];
      if (!row) return exam;
      return {
        ...exam,
        title: row.title || exam.title,
        type: row.exam_type || exam.type,
        subject: row.subject || exam.subject,
        date: row.exam_date_text || (row.exam_date ? dateOnly(row.exam_date) : exam.date),
        duration: row.duration_minutes ?? exam.duration,
        fee: row.fee === null ? exam.fee : Number(row.fee),
        discountPercent: row.discount_percent === null ? (exam.discountPercent || 0) : Number(row.discount_percent),
        imageUrl: row.image_url || exam.imageUrl || null,
        description: row.description || exam.description,
        tag: row.tag || exam.tag,
        status: row.status || exam.status,
        registrationOpen: row.registration_open ?? exam.registrationOpen,
      };
    };
    const imported = publishedResult.rows.map((row) => applyOverride({ id: row.id, title: row.title, type: row.exam_type, subject: (row.subjects || []).join(' · '), subjects: row.subjects || [], date: (row.starts_at ? new Date(row.starts_at) : new Date(row.published_at)).toISOString().slice(0, 10), startsAt: iso(row.starts_at), endsAt: iso(row.ends_at), time: row.starts_at ? new Date(row.starts_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Available now', duration: row.duration_minutes, questions: row.question_count, marks: Number(row.configuration_snapshot?.maximumMarks || 0), fee: row.is_free ? 0 : Number(row.price || 0), discountPercent: Number(row.discount_percent || 0), registered: 0, prize: 0, tag: row.is_free ? 'Free' : 'Paid', description: row.description || 'MERITX mock examination approved and published by administration.', syllabus: (row.subjects || []).join(', '), status: row.status, imageUrl: row.course_banner_image_url || row.course_image_url || null, bankId: row.bank_id, courseId: row.course_id, patternId: row.pattern_id, patternVersion: row.pattern_version, configuration: row.configuration_snapshot || {}, importMode: row.import_mode || 'compatible_practice', registrationOpen: row.registration_open, paperVersion: row.paper_version }));
    const coursesByType = Object.fromEntries(courseResult.rows.map((row) => [row.exam_type, row]));
    const builtIn = exams.map((item) => {
      const linkedCourse = coursesByType[item.type];
      return applyOverride({ ...item, discountPercent: 0, imageUrl: linkedCourse?.banner_image_url || linkedCourse?.image_url || null, courseId: linkedCourse?.id || null, registrationOpen: true });
    });
    return [...imported, ...builtIn].filter((item) => !overrides[item.id]?.is_deleted);
  }

  async function getExam(examId, client = db) {
    return (await listExams(client)).find((item) => item.id === examId) || null;
  }

  async function getPattern(idOrCode, client = db) {
    if (!idOrCode) return null;
    const { rows } = await client.query(`SELECT * FROM exam_patterns WHERE (id=$1 OR code=$1) AND status='active' ORDER BY version DESC LIMIT 1`, [idOrCode]);
    return rows[0] ? pattern(rows[0]) : null;
  }

  async function approvedQuestions(exam, client = db) {
    const { rows } = await client.query(`SELECT q.* FROM bank_questions q JOIN question_banks b ON b.id=q.bank_id WHERE b.status='published' AND b.assigned_exam_id=$1 ORDER BY q.position`, [exam.id]);
    if (!rows.length) return questionsForExam(exam);
    return rows.map((row) => ({ id: row.id, subject: row.subject, chapter: row.chapter, topic: row.topic, difficulty: row.difficulty, text: row.text, options: row.options, questionType: row.question_type, answer: row.correct_option, correctOptions: row.correct_options, numericalAnswer: row.numerical_answer === null ? null : Number(row.numerical_answer), numericalPrecision: row.numerical_precision, paperNumber: row.paper_number, sectionNumber: row.section_number, questionStemId: row.question_stem_id, matchingListData: row.matching_list_data, explanation: row.explanation, imageUrl: row.image_url, optionImageUrls: row.option_image_urls || [] }));
  }

  async function loadBank(id, client = db) {
    const bankResult = await client.query(`SELECT b.*, u.name teacher_name, COUNT(q.id)::int question_count, COUNT(*) FILTER (WHERE q.id IS NOT NULL AND ((q.question_type IN ('numerical','linked_numerical') AND q.numerical_answer IS NULL) OR (q.question_type NOT IN ('numerical','linked_numerical') AND (jsonb_array_length(q.correct_options)=0 OR jsonb_array_length(q.options)<2))))::int incomplete_count, COUNT(*) FILTER (WHERE q.id IS NOT NULL AND q.extraction_errors::text ILIKE '%duplicate%')::int duplicate_count FROM question_banks b JOIN users u ON u.id=b.created_by LEFT JOIN bank_questions q ON q.bank_id=b.id WHERE b.id=$1 GROUP BY b.id,u.name`, [id]);
    if (!bankResult.rowCount) throw new AppError(404, 'Question bank not found', 'QUESTION_BANK_NOT_FOUND');
    const questionsResult = await client.query(`SELECT q.*, EXISTS(SELECT 1 FROM bank_questions other JOIN question_banks ob ON ob.id=other.bank_id WHERE other.content_hash=q.content_hash AND other.id<>q.id AND ob.status IN ('submitted','approved')) AS is_duplicate FROM bank_questions q WHERE q.bank_id=$1 ORDER BY q.position`, [id]);
    return { ...bankSummary(bankResult.rows[0]), questions: questionsResult.rows.map(bankQuestion) };
  }

  function assertBankAccess(user, bank) {
    if (user.role === 'teacher' && bank.createdBy !== user.id) throw new AppError(403, 'You cannot access another teacher’s question bank', 'FORBIDDEN');
  }

  function strictPatternIssues(bank, configuration) {
    const issues = [];
    if (bank.questions.length !== configuration.questionCount) issues.push(`Expected ${configuration.questionCount} questions, found ${bank.questions.length}`);
    const subjectCounts = configuration.strict?.subjectCounts;
    if (subjectCounts) for (const [subject, expected] of Object.entries(subjectCounts)) {
      const actual = bank.questions.filter((question) => question.subject === subject).length;
      if (actual !== expected) issues.push(`${subject}: expected ${expected}, found ${actual}`);
    }
    const nativeTypes = new Set(bank.questions.map((question) => question.questionType));
    const requiredTypes = new Set();
    for (const paper of Object.values(configuration.strict || {})) if (paper?.perSubject) Object.keys(paper.perSubject).forEach((type) => requiredTypes.add(type));
    if (configuration.strict?.perSubject) Object.keys(configuration.strict.perSubject).forEach((type) => requiredTypes.add(type));
    for (const type of requiredTypes) if (!nativeTypes.has(type)) issues.push(`Missing genuine ${type.replaceAll('_', ' ')} records`);
    if (configuration.papers > 1 && bank.questions.some((question) => !question.paperNumber)) issues.push('Paper numbers are required for a multi-paper strict examination');
    const paperEntries = Object.entries(configuration.strict || {}).filter(([key, value]) => /^paper\d+$/i.test(key) && value?.perSubject);
    for (const [paperKey, paperConfig] of paperEntries) {
      const paperNumber = Number(paperKey.replace(/\D/g, ''));
      for (const subject of configuration.subjects || []) for (const [type, expected] of Object.entries(paperConfig.perSubject)) {
        const actual = bank.questions.filter((question) => question.paperNumber === paperNumber && question.subject === subject && question.questionType === type).length;
        if (actual !== expected) issues.push(`Paper ${paperNumber} ${subject} ${type.replaceAll('_', ' ')}: expected ${expected}, found ${actual}`);
      }
    }
    if (configuration.strict?.perSubject) for (const subject of configuration.subjects || []) for (const [type, expected] of Object.entries(configuration.strict.perSubject)) {
      const actual = bank.questions.filter((question) => question.subject === subject && question.questionType === type).length;
      if (actual !== expected) issues.push(`${subject} ${type.replaceAll('_', ' ')}: expected ${expected}, found ${actual}`);
    }
    return issues;
  }

  function compatibleConfiguration(configuration, questions, mode) {
    if (mode === 'strict_standard') return configuration;
    const maximumMarks = questions.reduce((sum, question) => {
      const base = configuration.rules?.[question.questionType] || configuration.rules?.single_correct || {};
      const override = configuration.rules?.subjectOverrides?.[question.subject] || {};
      return sum + Math.max(0, Number(override.correct ?? base.correct ?? 0));
    }, 0);
    return { ...configuration, questionCount: questions.length, maximumMarks, sourcePatternMaximumMarks: configuration.maximumMarks };
  }

  return {
    async health() {
      await db.query('SELECT 1');
      return { database: 'connected' };
    },
    async findUserById(id) {
      const { rows } = await db.query('SELECT * FROM users WHERE id=$1', [id]);
      return publicUser(rows[0]);
    },
    async login({ email, password }) {
      const { rows } = await db.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1)', [email]);
      const row = rows[0];
      if (!row || !(await bcrypt.compare(password, row.password_hash))) throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
      await log(row.id, 'LOGIN', 'Authenticated session started');
      return publicUser(row);
    },
    async registerUser({ name, email, password, target }) {
      const existing = await db.query('SELECT 1 FROM users WHERE LOWER(email)=LOWER($1)', [email]);
      if (existing.rowCount) throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
      const row = (await db.query(
        `INSERT INTO users (id,name,email,password_hash,role,target,academic_year)
         VALUES ($1,$2,$3,$4,'student',$5,'2027') RETURNING *`,
        [uid('student'), name, email, await bcrypt.hash(password, 12), target],
      )).rows[0];
      return publicUser(row);
    },
    listExams,
    async listPatterns() {
      const { rows } = await db.query(`SELECT * FROM exam_patterns WHERE status<>'retired' ORDER BY code,version DESC`);
      return rows.map(pattern);
    },
    async createPattern(actorId, input) {
      const latest = await db.query('SELECT COALESCE(MAX(version),0)::int latest FROM exam_patterns WHERE code=$1', [input.code]);
      const version = latest.rows[0].latest + 1;
      const row = (await db.query(`INSERT INTO exam_patterns (id,code,name,version,official_year,configuration,status,is_builtin,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,$8) RETURNING *`, [uid('pattern'), input.code, input.name, version, input.officialYear || null, JSON.stringify(input.configuration), input.status || 'draft', actorId])).rows[0];
      await log(actorId, 'EXAM_PATTERN_CREATE', `${input.code} v${version}`); return pattern(row);
    },
    async listCourses({ publicOnly = false, excludeArchived = false } = {}) {
      const where = publicOnly ? `WHERE status='published' AND is_visible=TRUE` : excludeArchived ? `WHERE status<>'archived'` : '';
      const { rows } = await db.query(`SELECT courses.*, (SELECT COUNT(*)::int FROM published_exams WHERE published_exams.course_id=courses.id) AS published_exam_count, (SELECT COALESCE(SUM(question_count),0)::int FROM published_exams WHERE published_exams.course_id=courses.id) AS published_question_count FROM courses ${where} ORDER BY display_order,name`);
      return rows.map(course);
    },
    async saveCourse(actorId, input, id = null) {
      const courseId = id || uid('course');
      const row = (await db.query(`INSERT INTO courses (id,slug,name,category,exam_type,short_description,full_description,image_url,banner_image_url,fee,discount_percent,duration_days,mock_test_count,status,is_visible,is_featured,display_order,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug,name=EXCLUDED.name,category=EXCLUDED.category,exam_type=EXCLUDED.exam_type,short_description=EXCLUDED.short_description,full_description=EXCLUDED.full_description,image_url=EXCLUDED.image_url,banner_image_url=EXCLUDED.banner_image_url,fee=EXCLUDED.fee,discount_percent=EXCLUDED.discount_percent,duration_days=EXCLUDED.duration_days,mock_test_count=EXCLUDED.mock_test_count,status=EXCLUDED.status,is_visible=EXCLUDED.is_visible,is_featured=EXCLUDED.is_featured,display_order=EXCLUDED.display_order,updated_at=NOW() RETURNING *`, [courseId, input.slug, input.name, input.category, input.examType, input.shortDescription || '', input.fullDescription || '', input.imageUrl || null, input.bannerImageUrl || null, input.fee || 0, input.discountPercent || 0, input.durationDays || 0, input.mockTestCount || 0, input.status, input.visible, input.featured, input.displayOrder || 0, actorId])).rows[0];
      await log(actorId, id ? 'COURSE_UPDATE' : 'COURSE_CREATE', courseId); return course(row);
    },
    async archiveCourse(actorId, id) {
      const row = (await db.query(`UPDATE courses SET status='archived',is_visible=FALSE,updated_at=NOW() WHERE id=$1 RETURNING *`, [id])).rows[0];
      if (!row) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
      await log(actorId, 'COURSE_ARCHIVE', id); return course(row);
    },
    async getLandingContent() {
      const { rows } = await db.query('SELECT key,payload FROM landing_content');
      return Object.fromEntries(rows.map((row) => [row.key, row.payload]));
    },
    async updateLandingContent(actorId, key, payload) {
      await db.query(`INSERT INTO landing_content (key,payload,updated_by,updated_at) VALUES ($1,$2,$3,NOW()) ON CONFLICT (key) DO UPDATE SET payload=EXCLUDED.payload,updated_by=EXCLUDED.updated_by,updated_at=NOW()`, [key, JSON.stringify(payload), actorId]);
      await log(actorId, 'LANDING_CONTENT_UPDATE', key); return { key, payload };
    },
    async listQuestions(examId, role) {
      const exam = await getExam(examId);
      if (!exam) throw new AppError(404, 'Exam not found', 'EXAM_NOT_FOUND');
      const paperQuestions = await approvedQuestions(exam);
      return role === 'student' ? paperQuestions.map(({ answer, correctOptions, numericalAnswer, explanation, matchingListData, ...question }) => question) : structuredClone(paperQuestions);
    },
    async studentDashboard(studentId) {
      const [registrations, attempts] = await Promise.all([
        db.query('SELECT * FROM registrations WHERE student_id=$1 ORDER BY created_at DESC', [studentId]),
        db.query('SELECT * FROM attempts WHERE student_id=$1 ORDER BY started_at DESC', [studentId]),
      ]);
      return { registrations: registrations.rows.map(registration), attempts: attempts.rows.map(attempt), rewards: [] };
    },
    async registerExam(studentId, examId) {
      return db.transaction(async (client) => {
        const exam = await getExam(examId, client);
        if (!exam) throw new AppError(404, 'Exam unavailable', 'EXAM_NOT_FOUND');
        if (exam.status !== 'published' && exam.status !== 'upcoming') throw new AppError(409, 'Registration is not available for this examination', 'REGISTRATION_CLOSED');
        if (exam.registrationOpen === false) throw new AppError(409, 'Registration is closed', 'REGISTRATION_CLOSED');
        if (exam.fee > 0) throw new AppError(503, 'Paid registration requires a configured server-verified payment provider', 'PAYMENT_PROVIDER_REQUIRED');
        const exists = await client.query('SELECT 1 FROM registrations WHERE student_id=$1 AND exam_id=$2', [studentId, examId]);
        if (exists.rowCount) throw new AppError(409, 'Already registered', 'ALREADY_REGISTERED');
        const paymentRow = (await client.query(
          `INSERT INTO payments (id,student_id,exam_id,amount,status) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [uid('pay'), studentId, examId, 0, 'free'],
        )).rows[0];
        const registrationRow = (await client.query(
          `INSERT INTO registrations (id,student_id,exam_id,payment_id,status) VALUES ($1,$2,$3,$4,'confirmed') RETURNING *`,
          [uid('reg'), studentId, examId, paymentRow.id],
        )).rows[0];
        await log(studentId, 'EXAM_REGISTER', examId, client);
        return { registration: registration(registrationRow), payment: payment(paymentRow) };
      });
    },
    async startAttempt(studentId, examId, acceptedInstructions = false) {
      const exam = await getExam(examId);
      if (!exam) throw new AppError(404, 'Exam unavailable', 'EXAM_NOT_FOUND');
      if (!acceptedInstructions) throw new AppError(400, 'Accept the examination instructions before starting', 'INSTRUCTIONS_REQUIRED');
      if (exam.status !== 'published' && !exams.some((item) => item.id === examId)) throw new AppError(409, 'This examination is not published', 'EXAM_NOT_PUBLISHED');
      if (exam.startsAt && Date.now() < new Date(exam.startsAt).getTime()) throw new AppError(409, 'This examination has not started yet', 'EXAM_NOT_STARTED');
      if (exam.endsAt && Date.now() > new Date(exam.endsAt).getTime()) throw new AppError(409, 'This examination has ended', 'EXAM_ENDED');
      const registered = await db.query(`SELECT 1 FROM registrations WHERE student_id=$1 AND exam_id=$2 AND status='confirmed'`, [studentId, examId]);
      if (!registered.rowCount) throw new AppError(403, 'Register before starting', 'REGISTRATION_REQUIRED');
      const existing = await db.query('SELECT * FROM attempts WHERE student_id=$1 AND exam_id=$2', [studentId, examId]);
      if (existing.rows[0]?.status === 'submitted') throw new AppError(409, 'Attempt already submitted', 'ATTEMPT_SUBMITTED');
      if (existing.rows[0]) return attempt(existing.rows[0]);
      const snapshot = await approvedQuestions(exam);
      const durationSeconds = Math.max(60, Number(exam.duration || 12) * 60);
      const row = (await db.query(
        `INSERT INTO attempts (id,student_id,exam_id,status,duration_seconds,deadline_at,accepted_instructions_at,segment_started_at,question_snapshot) VALUES ($1,$2,$3,'in_progress',$4::integer,NOW()+make_interval(secs => $4::integer),NOW(),NOW(),$5) RETURNING *`,
        [uid('attempt'), studentId, examId, durationSeconds, JSON.stringify(snapshot)],
      )).rows[0];
      return attempt(row);
    },
    async saveAttempt(studentId, { attemptId, answers, marked }) {
      const current = await db.query(`SELECT * FROM attempts WHERE id=$1 AND student_id=$2 AND status='in_progress'`, [attemptId, studentId]);
      if (!current.rowCount) throw new AppError(404, 'Active attempt not found', 'ATTEMPT_NOT_FOUND');
      const row = current.rows[0];
      if (Date.now() > new Date(row.deadline_at || new Date(row.started_at).getTime() + row.duration_seconds * 1000).getTime() + 5000) throw new AppError(409, 'Time expired. Submit your attempt.', 'ATTEMPT_EXPIRED');
      const exam = await getExam(row.exam_id);
      const snapshot = row.question_snapshot || await approvedQuestions(exam);
      const ids = new Set(snapshot.map((item) => String(item.id)));
      const segments = exam.configuration?.segments || [];
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000));
      let segmentNumber = 1;
      if (segments.length) {
        let boundary = 0;
        segmentNumber = segments.length;
        for (const segment of segments) { boundary += Number(segment.durationMinutes) * 60; if (elapsedSeconds < boundary) { segmentNumber = Number(segment.number); break; } }
      }
      const activeSubjects = new Set(segments.find((segment) => Number(segment.number) === segmentNumber)?.subjects || []);
      const permitted = new Set(snapshot.filter((question) => !segments.length || activeSubjects.has(question.subject)).map((question) => String(question.id)));
      const incoming = Object.fromEntries(Object.entries(answers).filter(([key]) => ids.has(key) && permitted.has(key)));
      const safeAnswers = segments.length ? { ...(row.answers || {}), ...incoming } : incoming;
      const safeMarked = marked.map(String).filter((id) => ids.has(id));
      const updated = (await db.query(`UPDATE attempts SET answers=$1, marked=$2,current_segment=$3,last_saved_at=NOW() WHERE id=$4 RETURNING *`, [safeAnswers, JSON.stringify(safeMarked), segmentNumber, attemptId])).rows[0];
      return attempt(updated);
    },
    async submitAttempt(studentId, { attemptId, answers }) {
      return db.transaction(async (client) => {
        const current = await client.query(`SELECT * FROM attempts WHERE id=$1 AND student_id=$2 AND status='in_progress' FOR UPDATE`, [attemptId, studentId]);
        if (!current.rowCount) throw new AppError(404, 'Active attempt not found', 'ATTEMPT_NOT_FOUND');
        const row = current.rows[0];
        const exam = await getExam(row.exam_id, client);
        const merged = { ...(row.answers || {}), ...answers };
        const snapshot = row.question_snapshot || await approvedQuestions(exam, client);
        const validIds = new Set(snapshot.map((item) => String(item.id)));
        const safeAnswers = Object.fromEntries(Object.entries(merged).filter(([id]) => validIds.has(id)));
        const result = evaluate(snapshot, safeAnswers, exam.configuration || { rules: { single_correct: { correct: 4, incorrect: -1, unanswered: 0 } } });
        const elapsed = Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000);
        const updated = (await client.query(
          `UPDATE attempts SET answers=$1,status='submitted',submitted_at=NOW(),time_taken=$2,result=$3 WHERE id=$4 RETURNING *`,
          [safeAnswers, Math.min(row.duration_seconds, Math.max(0, elapsed)), result, attemptId],
        )).rows[0];
        await log(studentId, 'EXAM_SUBMIT', attemptId, client);
        return attempt(updated);
      });
    },
    async listPapers() {
      return (await db.query('SELECT * FROM papers ORDER BY created_at DESC')).rows.map(paper);
    },
    async createPaper(actorId, input) {
      const row = (await db.query(
        `INSERT INTO papers (id,title,subject,question_count,status,created_by) VALUES ($1,$2,$3,$4,'submitted',$5) RETURNING *`,
        [uid('paper'), input.title, input.subject, input.questions, actorId],
      )).rows[0];
      await log(actorId, 'PAPER_SUBMIT', row.id);
      return paper(row);
    },
    async listQuestionBanks(user) {
      const where = user.role === 'teacher' ? 'WHERE b.created_by=$1' : '';
      const params = user.role === 'teacher' ? [user.id] : [];
      const { rows } = await db.query(`SELECT b.*, u.name teacher_name, COUNT(q.id)::int question_count, COUNT(*) FILTER (WHERE q.id IS NOT NULL AND (jsonb_array_length(q.correct_options)=0 OR jsonb_array_length(q.options)<2))::int incomplete_count, COUNT(*) FILTER (WHERE q.id IS NOT NULL AND q.extraction_errors ? 'Duplicate within this upload')::int duplicate_count FROM question_banks b JOIN users u ON u.id=b.created_by LEFT JOIN bank_questions q ON q.bank_id=b.id ${where} GROUP BY b.id,u.name ORDER BY b.updated_at DESC`, params);
      return rows.map(bankSummary);
    },
    async getQuestionBank(user, id) {
      const bank = await loadBank(id); assertBankAccess(user, bank); return bank;
    },
    async importQuestionBank(actorId, file, metadata) {
      const subject = String(metadata.subject || 'General').trim().slice(0, 80) || 'General';
      const importMode = metadata.importMode === 'strict_standard' ? 'strict_standard' : 'compatible_practice';
      const extracted = await extractQuestionFile(file, { subject, importMode });
      const sourceLimitations = extracted.warnings.filter((warning) => /adapted practice|repeated question/i.test(warning));
      return db.transaction(async (client) => {
        const id = uid('bank');
        await client.query(`INSERT INTO subjects (id,name,created_by) VALUES ($1,$2,$3) ON CONFLICT (LOWER(name)) DO NOTHING`, [uid('subject'), subject, actorId]);
        await client.query(`INSERT INTO question_banks (id,title,subject,source_filename,source_type,import_mode,pattern_code,import_summary,source_limitations,extraction_status,extraction_warnings,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12)`, [id, String(metadata.title || file.originalname).slice(0, 160), subject, file.originalname.slice(0, 255), extracted.sourceType, importMode, metadata.patternCode || null, JSON.stringify(extracted.summary), JSON.stringify(sourceLimitations), extracted.summary.rejected ? 'needs_review' : 'ready', JSON.stringify(extracted.warnings), actorId]);
        for (const [position, question] of extracted.questions.entries()) await client.query(`INSERT INTO bank_questions (id,bank_id,position,external_question_id,source_row,text,options,question_type,source_question_type,correct_option,correct_options,numerical_answer,numerical_precision,paper_number,section_number,question_stem_id,matching_list_data,explanation,subject,chapter,topic,difficulty,image_url,option_image_urls,reference,source_page,extraction_confidence,extraction_errors,content_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`, [uid('question'), id, position, question.externalQuestionId, question.sourceRow, question.text, JSON.stringify(question.options), question.questionType, question.sourceQuestionType, question.correctOption, JSON.stringify(question.correctOptions), question.numericalAnswer, question.numericalPrecision, question.paperNumber, question.sectionNumber, question.questionStemId, question.matchingListData ? JSON.stringify(question.matchingListData) : null, question.explanation, question.subject, question.chapter, question.topic, question.difficulty, question.imageUrl, JSON.stringify(question.optionImageUrls), question.reference, question.sourcePage, question.extractionConfidence, JSON.stringify(question.extractionErrors), question.contentHash]);
        await client.query(`INSERT INTO question_bank_events (id,bank_id,actor_id,event_type,detail) VALUES ($1,$2,$3,'imported',$4)`, [uid('event'), id, actorId, JSON.stringify({ filename: file.originalname, count: extracted.questions.length, importMode, summary: extracted.summary })]);
        await log(actorId, 'QUESTION_BANK_IMPORT', `${id}: ${file.originalname}`, client);
        return loadBank(id, client);
      });
    },
    async updateQuestionBank(user, id, input) {
      const current = await loadBank(id); assertBankAccess(user, current);
      if (!['draft', 'rejected'].includes(current.status)) throw new AppError(409, 'Only draft or rejected question banks can be edited', 'QUESTION_BANK_LOCKED');
      return db.transaction(async (client) => {
        await client.query(`UPDATE question_banks SET title=$1,subject=$2,status='draft',updated_at=NOW() WHERE id=$3`, [input.title, input.subject, id]);
        await client.query('DELETE FROM bank_questions WHERE bank_id=$1', [id]);
        for (const [position, question] of input.questions.entries()) {
          const errors = [];
          if (!question.text.trim()) errors.push('Question text is missing');
          const numericalType = ['numerical', 'linked_numerical'].includes(question.questionType);
          if (!numericalType && question.options.filter((option) => option.trim()).length < 2) errors.push('At least two answer choices are required');
          const correctOptions = question.correctOptions?.length ? [...new Set(question.correctOptions)].sort((a, b) => a - b) : (Number.isInteger(question.correctOption) ? [question.correctOption] : []);
          if (numericalType ? !Number.isFinite(question.numericalAnswer) : !correctOptions.length || correctOptions.some((value) => value >= question.options.length || !question.options[value]?.trim())) errors.push('Answer Required');
          const questionType = numericalType || question.questionType === 'matching_list' ? question.questionType : question.questionType === 'multiple_correct' || correctOptions.length > 1 ? 'multiple_correct' : 'single_correct';
          await client.query(`INSERT INTO bank_questions (id,bank_id,position,external_question_id,source_row,text,options,question_type,source_question_type,correct_option,correct_options,numerical_answer,numerical_precision,paper_number,section_number,question_stem_id,matching_list_data,explanation,subject,chapter,topic,difficulty,image_url,option_image_urls,reference,extraction_confidence,extraction_errors,content_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,1,$26,$27)`, [question.id || uid('question'), id, position, question.externalQuestionId || null, question.sourceRow || null, question.text, JSON.stringify(question.options), questionType, question.sourceQuestionType || questionType, questionType === 'single_correct' || questionType === 'matching_list' ? correctOptions[0] : null, JSON.stringify(correctOptions), question.numericalAnswer ?? null, question.numericalPrecision ?? null, question.paperNumber ?? null, question.sectionNumber ?? null, question.questionStemId || null, question.matchingListData ? JSON.stringify(question.matchingListData) : null, question.explanation, question.subject, question.chapter, question.topic, question.difficulty, question.imageUrl || null, JSON.stringify(question.optionImageUrls || []), question.reference || null, JSON.stringify(errors), questionHash(question.text)]);
        }
        await log(user.id, 'QUESTION_BANK_SAVE_DRAFT', id, client); return loadBank(id, client);
      });
    },
    async submitQuestionBank(user, id) {
      const bank = await loadBank(id); assertBankAccess(user, bank);
      const incomplete = bank.questions.filter((q) => !q.text.trim() || (['numerical','linked_numerical'].includes(q.questionType) ? !Number.isFinite(q.numericalAnswer) : q.options.filter((option) => option.trim()).length < 2 || !q.correctOptions.length || q.correctOptions.some((value) => value >= q.options.length || !q.options[value]?.trim())));
      const duplicates = bank.questions.filter((q) => q.duplicate || q.extractionErrors.some((error) => /duplicate/i.test(error)));
      if (incomplete.length || duplicates.length) throw new AppError(400, `Cannot submit: ${incomplete.length} incomplete and ${duplicates.length} duplicate question(s) require review`, 'QUESTION_BANK_INVALID');
      if (!['draft', 'rejected'].includes(bank.status)) throw new AppError(409, 'Only drafts and rejected papers can be submitted', 'INVALID_BANK_STATUS');
      return db.transaction(async (client) => {
        const claimed = await client.query(`UPDATE question_banks SET status='submitted',submitted_at=NOW(),rejection_reason=NULL,version=CASE WHEN status='rejected' THEN version+1 ELSE version END,updated_at=NOW() WHERE id=$1 AND status IN ('draft','rejected') RETURNING id`, [id]);
        if (!claimed.rowCount) throw new AppError(409, 'This question bank has already been submitted', 'QUESTION_BANK_ALREADY_SUBMITTED');
        await client.query(`INSERT INTO question_bank_events (id,bank_id,actor_id,event_type,detail) VALUES ($1,$2,$3,'submitted',$4)`, [uid('event'), id, user.id, JSON.stringify({ questionCount: bank.questions.length })]);
        await log(user.id, 'QUESTION_BANK_SUBMIT', id, client); return loadBank(id, client);
      });
    },
    async approveQuestionBank(actorId, { id }) {
      const bank = await loadBank(id);
      if (bank.createdBy === actorId) throw new AppError(403, 'Maker cannot approve own question bank', 'SEPARATION_OF_DUTIES');
      if (bank.status !== 'submitted') throw new AppError(409, 'Only submitted question banks can be approved', 'INVALID_BANK_STATUS');
      return db.transaction(async (client) => {
        await client.query(`UPDATE question_banks SET status='approved',approved_by=$1,approved_at=NOW(),updated_at=NOW() WHERE id=$2`, [actorId, id]);
        await client.query(`INSERT INTO question_bank_events (id,bank_id,actor_id,event_type,detail) VALUES ($1,$2,$3,'approved','{}')`, [uid('event'), id, actorId]);
        await log(actorId, 'QUESTION_BANK_APPROVE', id, client); return loadBank(id, client);
      });
    },
    async rejectQuestionBank(actorId, { id, reason }) {
      const bank = await loadBank(id);
      if (!['submitted', 'under_review'].includes(bank.status)) throw new AppError(409, 'Only submitted papers can be rejected', 'INVALID_BANK_STATUS');
      await db.query(`UPDATE question_banks SET status='rejected',rejection_reason=$1,updated_at=NOW() WHERE id=$2`, [reason, id]);
      await db.query(`INSERT INTO question_bank_events (id,bank_id,actor_id,event_type,detail) VALUES ($1,$2,$3,'rejected',$4)`, [uid('event'), id, actorId, JSON.stringify({ reason })]);
      await log(actorId, 'QUESTION_BANK_REJECT', `${id}: ${reason}`); return loadBank(id);
    },
    async publishQuestionBank(actorId, { id, patternId, courseId, durationMinutes, isFree, price, description, startsAt, endsAt, registrationOpen, importMode }) {
      const bank = await loadBank(id);
      if (bank.status !== 'approved') throw new AppError(409, 'Only approved papers can be published', 'INVALID_BANK_STATUS');
      if (!bank.questions.length || bank.incompleteCount) throw new AppError(409, 'An incomplete paper cannot be published', 'QUESTION_BANK_INVALID');
      const selectedPattern = await getPattern(patternId || bank.patternCode);
      if (!selectedPattern) throw new AppError(400, 'Select an active examination pattern', 'PATTERN_REQUIRED');
      const mode = importMode === 'strict_standard' ? 'strict_standard' : 'compatible_practice';
      const strictIssues = strictPatternIssues(bank, selectedPattern.configuration);
      if (mode === 'strict_standard' && strictIssues.length) throw new AppError(400, `Strict-standard validation failed: ${strictIssues.join('; ')}`, 'STRICT_PATTERN_INVALID');
      if (!isFree && Number(price) <= 0) throw new AppError(400, 'A paid examination requires a positive price', 'PRICE_REQUIRED');
      return db.transaction(async (client) => {
        const examId = `exam-${crypto.randomUUID().slice(0, 12)}`;
        const subjects = [...new Set(bank.questions.map((question) => question.subject).filter(Boolean))];
        const examType = mode === 'strict_standard' ? selectedPattern.name : `${selectedPattern.name} · Compatible Practice`;
        const effectiveDuration = durationMinutes || selectedPattern.configuration.durationMinutes;
        const configurationSnapshot = compatibleConfiguration(selectedPattern.configuration, bank.questions, mode);
        await client.query(`INSERT INTO published_exams (id,bank_id,course_id,pattern_id,pattern_version,configuration_snapshot,title,exam_type,description,subjects,duration_minutes,is_free,price,discount_percent,starts_at,ends_at,registration_open,import_mode,status,published_by,question_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,$14,$15,$16,$17,'published',$18,$19)`, [examId, id, courseId || null, selectedPattern.id, selectedPattern.version, JSON.stringify(configurationSnapshot), bank.title, examType, description || (mode === 'strict_standard' ? 'Strict-standard MeritX mock examination.' : `Compatible practice set. Source limitations: ${[...bank.sourceLimitations, ...strictIssues].join(' ') || 'Legacy option-based question representation.'}`), JSON.stringify(subjects), effectiveDuration, Boolean(isFree), isFree ? 0 : Number(price), startsAt || null, endsAt || null, registrationOpen !== false, mode, actorId, bank.questions.length]);
        await client.query(`UPDATE question_banks SET status='published',assigned_exam_id=$1,published_at=NOW(),updated_at=NOW() WHERE id=$2`, [examId, id]);
        await client.query(`INSERT INTO question_bank_events (id,bank_id,actor_id,event_type,detail) VALUES ($1,$2,$3,'published',$4)`, [uid('event'), id, actorId, JSON.stringify({ examId, questionCount: bank.questions.length, patternId: selectedPattern.id, patternVersion: selectedPattern.version, importMode: mode, strictIssues })]);
        await log(actorId, 'QUESTION_BANK_PUBLISH', `${id} -> ${examId}`, client); return { bank: await loadBank(id, client), examId };
      });
    },
    async adminOverview() {
      const [counts, paymentsResult, papersResult, usersResult, auditResult, examList] = await Promise.all([
        db.query(`SELECT COUNT(*) FILTER (WHERE role='student')::int AS students, COUNT(*) FILTER (WHERE role='teacher')::int AS teachers FROM users`),
        db.query('SELECT * FROM payments ORDER BY created_at DESC'),
        db.query('SELECT * FROM papers ORDER BY created_at DESC'),
        db.query('SELECT * FROM users ORDER BY created_at DESC'),
        db.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 30'),
        listExams(),
      ]);
      const totals = await db.query(`SELECT (SELECT COUNT(*) FROM registrations)::int AS registrations, (SELECT COUNT(*) FROM attempts)::int AS attempts`);
      const payments = paymentsResult.rows.map(payment);
      return { ...counts.rows[0], ...totals.rows[0], payments, gross: payments.reduce((sum, item) => sum + item.amount, 0), rewards: [], papers: papersResult.rows.map(paper), users: usersResult.rows.map(publicUser), audit: auditResult.rows.map((row) => ({ id: row.id, actor: row.actor_id, action: row.action, detail: row.detail, date: iso(row.created_at) })), exams: examList };
    },
    async approvePaper(actorId, paperId) {
      const found = await db.query('SELECT * FROM papers WHERE id=$1', [paperId]);
      if (!found.rowCount) throw new AppError(404, 'Paper not found', 'PAPER_NOT_FOUND');
      if (found.rows[0].created_by === actorId) throw new AppError(403, 'Maker cannot approve own paper', 'SEPARATION_OF_DUTIES');
      const updated = (await db.query(`UPDATE papers SET status='approved' WHERE id=$1 RETURNING *`, [paperId])).rows[0];
      await log(actorId, 'PAPER_APPROVE', paperId);
      return paper(updated);
    },
    async updateExamStatus(actorId, { id, status }) {
      const exam = await getExam(id);
      if (!exam) throw new AppError(404, 'Exam not found', 'EXAM_NOT_FOUND');
      const locked = await db.query('SELECT 1 FROM attempts WHERE exam_id=$1 LIMIT 1', [id]);
      if (locked.rowCount) throw new AppError(409, 'Exam configuration locked once attempts exist', 'EXAM_LOCKED');
      await db.query(`INSERT INTO exam_overrides (exam_id,status,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (exam_id) DO UPDATE SET status=EXCLUDED.status,updated_at=NOW()`, [id, status]);
      await log(actorId, 'EXAM_STATUS', `${id}: ${status}`);
      return { ...exam, status };
    },
    async updateExamCatalog(actorId, id, input) {
      const exam = await getExam(id);
      if (!exam) throw new AppError(404, 'Exam not found', 'EXAM_NOT_FOUND');
      await db.query(`INSERT INTO exam_overrides (exam_id,status,title,exam_type,subject,exam_date,duration_minutes,fee,discount_percent,image_url,description,tag,registration_open,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
        ON CONFLICT (exam_id) DO UPDATE SET status=EXCLUDED.status,title=EXCLUDED.title,exam_type=EXCLUDED.exam_type,subject=EXCLUDED.subject,exam_date=EXCLUDED.exam_date,duration_minutes=EXCLUDED.duration_minutes,fee=EXCLUDED.fee,discount_percent=EXCLUDED.discount_percent,image_url=EXCLUDED.image_url,description=EXCLUDED.description,tag=EXCLUDED.tag,registration_open=EXCLUDED.registration_open,updated_at=NOW()`,
      [id, input.status, input.title, input.type, input.subject, input.date, input.duration, input.fee, input.discountPercent, input.imageUrl || null, input.description || '', input.tag || '', input.registrationOpen]);
      await log(actorId, 'EXAM_CATALOG_UPDATE', id);
      return getExam(id);
    },
    async deleteExamCatalog(actorId, id) {
      const exam = await getExam(id);
      if (!exam) throw new AppError(404, 'Examination not found', 'EXAM_NOT_FOUND');
      await db.query(`INSERT INTO exam_overrides (exam_id,status,is_deleted,updated_at) VALUES ($1,'cancelled',TRUE,NOW()) ON CONFLICT (exam_id) DO UPDATE SET status='cancelled',is_deleted=TRUE,updated_at=NOW()`, [id]);
      await log(actorId, 'EXAM_CATALOG_DELETE', id);
      return { deleted: true, id };
    },
    async createSupportTicket(userId, input) {
      const row = (await db.query(
        `INSERT INTO support_tickets (id,user_id,subject,message,status) VALUES ($1,$2,$3,$4,'open') RETURNING *`,
        [uid('ticket'), userId, input.subject, input.message],
      )).rows[0];
      return ticket(row);
    },
    async listSupportTickets() {
      return (await db.query('SELECT * FROM support_tickets ORDER BY created_at DESC')).rows.map(ticket);
    },
  };
}
