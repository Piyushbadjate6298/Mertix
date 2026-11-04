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
const payment = (row) => ({ id: row.id, studentId: row.student_id, examId: row.exam_id, courseId: row.course_id || null, amount: Number(row.amount), amountPaise: Number(row.amount_paise || 0), currency: row.currency || 'INR', status: row.status, gateway: row.gateway, orderId: row.gateway_order_id || null, paymentId: row.gateway_payment_id || null, failureReason: row.failure_reason || null, date: iso(row.verified_at || row.created_at) });
const paper = (row) => ({ id: row.id, title: row.title, subject: row.subject, questions: row.question_count, status: row.status, createdBy: row.created_by, date: iso(row.created_at) });
const ticket = (row) => ({ id: row.id, userId: row.user_id, subject: row.subject, message: row.message, status: row.status, createdAt: iso(row.created_at) });
const attempt = (row) => ({
  id: row.id,
  studentId: row.student_id,
  examId: row.exam_id,
  status: row.status,
  answers: row.answers || {},
  marked: row.marked || [],
  result: row.result,
  questions: (row.status === 'submitted' || row.status === 'TERMINATED') ? (row.question_snapshot || []) : undefined,
  durationSeconds: row.duration_seconds,
  startedAt: iso(row.started_at),
  deadlineAt: iso(row.deadline_at),
  serverNow: new Date().toISOString(),
  acceptedInstructionsAt: iso(row.accepted_instructions_at),
  currentSegment: Number(row.current_segment || 1),
  segmentState: row.segment_state || {},
  lastSavedAt: iso(row.last_saved_at),
  submittedAt: iso(row.submitted_at),
  timeTaken: row.time_taken,
  warningCount: Number(row.warning_count || 0),
  isFlagged: Boolean(row.is_flagged),
  flagReason: row.flag_reason || null,
  proctoringStatus: row.proctoring_status || 'unmonitored',
  terminationReason: row.termination_reason || null,
  terminatedAt: iso(row.terminated_at),
  violationHistory: row.violation_history || []
});
const bankSummary = (row) => ({ id: row.id, title: row.title, subject: row.subject, sourceFilename: row.source_filename, sourceType: row.source_type, importMode: row.import_mode || 'compatible_practice', patternCode: row.pattern_code, importSummary: row.import_summary || {}, sourceLimitations: row.source_limitations || [], extractionStatus: row.extraction_status, warnings: row.extraction_warnings || [], status: row.status, rejectionReason: row.rejection_reason || '', version: Number(row.version || 1), createdBy: row.created_by, teacherName: row.teacher_name, approvedBy: row.approved_by, assignedExamId: row.assigned_exam_id, questionCount: Number(row.question_count || 0), incompleteCount: Number(row.incomplete_count || 0), duplicateCount: Number(row.duplicate_count || 0), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), submittedAt: iso(row.submitted_at), approvedAt: iso(row.approved_at), publishedAt: iso(row.published_at) });
const bankQuestion = (row) => ({ id: row.id, externalQuestionId: row.external_question_id, sourceRow: row.source_row, text: row.text, options: row.options || [], questionType: row.question_type || 'single_correct', sourceQuestionType: row.source_question_type, correctOptions: row.correct_options?.length ? row.correct_options : (Number.isInteger(row.correct_option) ? [row.correct_option] : []), correctOption: row.correct_option, numericalAnswer: row.numerical_answer === null ? null : Number(row.numerical_answer), numericalPrecision: row.numerical_precision, paperNumber: row.paper_number, sectionNumber: row.section_number, questionStemId: row.question_stem_id, matchingListData: row.matching_list_data, explanation: row.explanation || '', subject: row.subject, chapter: row.chapter || '', topic: row.topic || '', difficulty: row.difficulty, imageUrl: row.image_url, optionImageUrls: row.option_image_urls || [], reference: row.reference, sourcePage: row.source_page, extractionConfidence: Number(row.extraction_confidence || 0), extractionErrors: row.extraction_errors || [], duplicate: Boolean(row.is_duplicate) });
const pattern = (row) => ({ id: row.id, code: row.code, name: row.name, version: Number(row.version), officialYear: row.official_year, configuration: row.configuration, status: row.status, builtIn: row.is_builtin, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
const discountedFee = (fee, discountPercent = 0) => Math.max(0, Number((Number(fee || 0) * (1 - Number(discountPercent || 0) / 100)).toFixed(2)));
const course = (row) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  category: row.category,
  examType: row.exam_type,
  shortDescription: row.short_description,
  fullDescription: row.full_description,
  imageUrl: row.image_url,
  bannerImageUrl: row.banner_image_url,
  teacherId: row.teacher_id || null,
  teacherName: row.teacher_name || null,
  fee: Number(row.fee),
  discountPercent: Number(row.discount_percent),
  effectivePrice: discountedFee(row.fee, row.discount_percent),
  durationDays: row.duration_days,
  mockTestCount: row.mock_test_count,
  publishedExamCount: Number(row.published_exam_count || 0),
  publishedQuestionCount: Number(row.published_question_count || 0),
  enrolledStudentCount: Number(row.enrolled_student_count || 0),
  status: row.status,
  visible: row.is_visible,
  featured: row.is_featured,
  displayOrder: row.display_order,
  feeVisible: true,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at)
});

export function createPlatformService(db, { env = {}, razorpay = null } = {}) {
  const razorpayConfig = env.razorpay || {};
  const expectedKeyPrefix = razorpayConfig.mode === 'live' ? 'rzp_live_' : 'rzp_test_';
  const paymentProviderConfigured = Boolean(razorpay && razorpayConfig.keyId?.startsWith(expectedKeyPrefix) && razorpayConfig.keySecret && ['test', 'live'].includes(razorpayConfig.mode));
  async function log(actorId, action, detail, client = db) {
    await client.query('INSERT INTO audit_log (id, actor_id, action, detail) VALUES ($1,$2,$3,$4)', [uid('audit'), actorId, action, String(detail || '').slice(0, 500)]);
  }

  async function listExams(client = db, { authenticated = true } = {}) {
    const [overrideResult, publishedResult, courseResult, registrationResult] = await Promise.all([
      client.query('SELECT *, exam_date::text AS exam_date_text FROM exam_overrides'),
      client.query('SELECT p.*, c.image_url AS course_image_url, c.banner_image_url AS course_banner_image_url, c.fee AS course_fee, c.discount_percent AS course_discount_percent, c.status AS course_status, c.is_visible AS course_visible FROM published_exams p LEFT JOIN courses c ON c.id=p.course_id ORDER BY p.published_at DESC'),
      client.query('SELECT * FROM courses ORDER BY display_order,name'),
      client.query(`SELECT exam_id,COUNT(*)::int AS registrations FROM registrations WHERE status='confirmed' GROUP BY exam_id`),
    ]);
    const overrides = Object.fromEntries(overrideResult.rows.map((row) => [row.exam_id, row]));
    const registrationCounts = Object.fromEntries(registrationResult.rows.map((row) => [row.exam_id, row.registrations]));
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
        schedule: row.schedule || {},
        prizeConfig: row.prize_config || {},
        startsAt: row.schedule?.startsAt || exam.startsAt || null,
        endsAt: row.schedule?.endsAt || exam.endsAt || (row.schedule?.startsAt ? new Date(new Date(row.schedule.startsAt).getTime() + Number(exam.duration || 0) * 60000).toISOString() : null),
        scheduleStatus: row.schedule?.status || exam.status,
      };
    };
    const imported = publishedResult.rows.map((row) => {
      if (row.course_id && (row.course_status !== 'published' || !row.course_visible)) return null;
      const linkedFee = row.course_id ? discountedFee(row.course_fee, row.course_discount_percent) : null;
      const fee = linkedFee ?? (row.is_free ? 0 : discountedFee(row.price, row.discount_percent));
      return applyOverride({ id: row.id, title: row.title, type: row.exam_type, subject: (row.subjects || []).join(' · '), subjects: row.subjects || [], date: (row.starts_at ? new Date(row.starts_at) : new Date(row.published_at)).toISOString().slice(0, 10), startsAt: iso(row.starts_at), endsAt: iso(row.ends_at), time: row.starts_at ? new Date(row.starts_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Available now', duration: row.duration_minutes, questions: row.question_count, marks: Number(row.configuration_snapshot?.maximumMarks || 0), fee, discountPercent: 0, registered: 0, prize: 0, tag: fee ? 'Paid' : 'Free', description: row.description || 'MERITX mock examination approved and published by administration.', syllabus: (row.subjects || []).join(', '), status: row.status, imageUrl: row.course_banner_image_url || row.course_image_url || null, bankId: row.bank_id, courseId: row.course_id, patternId: row.pattern_id, patternVersion: row.pattern_version, configuration: row.configuration_snapshot || {}, importMode: row.import_mode || 'compatible_practice', registrationOpen: row.registration_open, paperVersion: row.paper_version });
    });
    const coursesByType = Object.fromEntries(courseResult.rows.map((row) => [row.exam_type, row]));
    const builtIn = exams.map((item) => {
      const linkedCourse = coursesByType[item.type];
      if (linkedCourse && (linkedCourse.status !== 'published' || !linkedCourse.is_visible)) return null;
      const fee = linkedCourse ? discountedFee(linkedCourse.fee, linkedCourse.discount_percent) : Number(item.fee || 0);
      return applyOverride({ ...item, fee, tag: fee ? 'Paid' : 'Free', discountPercent: 0, imageUrl: linkedCourse?.banner_image_url || linkedCourse?.image_url || null, courseId: linkedCourse?.id || null, registrationOpen: true });
    });
    return [...imported, ...builtIn]
      .filter(Boolean)
      .filter((item) => !overrides[item.id]?.is_deleted)
      .map((item) => {
        const actualFee = discountedFee(item.fee, item.discountPercent);
        if (!authenticated) {
          return {
            ...item,
            registered: registrationCounts[item.id] || 0,
            fee: null,
            discountPercent: null,
            feeVisible: false,
            tag: 'Login to view price',
          };
        }
        return {
          ...item,
          registered: registrationCounts[item.id] || 0,
          fee: actualFee,
          discountPercent: 0,
          feeVisible: true,
          tag: actualFee > 0 ? 'Paid' : 'Free',
        };
      });
  }

  async function getExam(examId, client = db, { authenticated = true } = {}) {
    return (await listExams(client, { authenticated })).find((item) => item.id === examId) || null;
  }

  async function finalizeCapturedPayment(stored, trustedPayment) {
    if (trustedPayment.order_id !== stored.gateway_order_id || Number(trustedPayment.amount) !== Number(stored.amount_paise) || trustedPayment.currency !== stored.currency || trustedPayment.status !== 'captured') throw new AppError(409, 'Payment has not been captured with the expected amount', 'PAYMENT_NOT_CAPTURED');
    return db.transaction(async (client) => {
      const locked = (await client.query('SELECT * FROM payments WHERE id=$1 FOR UPDATE', [stored.id])).rows[0];
      if (locked.status !== 'captured') {
        await client.query(`UPDATE payments SET status='captured',gateway_payment_id=$1,failure_reason=NULL,verified_at=NOW(),updated_at=NOW() WHERE id=$2`, [trustedPayment.id, stored.id]);
        await client.query(`INSERT INTO registrations (id,student_id,exam_id,payment_id,status) VALUES ($1,$2,$3,$4,'confirmed') ON CONFLICT (student_id,exam_id) DO UPDATE SET payment_id=EXCLUDED.payment_id,status='confirmed'`, [uid('reg'), stored.student_id, stored.exam_id, stored.id]);
        const examForEnroll = await getExam(stored.exam_id, client);
        if (examForEnroll?.courseId) {
          await client.query(
            `INSERT INTO course_enrollments (id, student_id, course_id, fee_paid, payment_method, status)
             VALUES ($1, $2, $3, $4, 'gateway', 'active')
             ON CONFLICT (student_id, course_id) DO UPDATE SET status = 'active'`,
            [uid('enr'), stored.student_id, examForEnroll.courseId, Number(stored.amount || 0)]
          );
        }
        await log(stored.student_id, 'PAYMENT_CAPTURED_AND_ENROLLED', `${stored.exam_id}:${trustedPayment.id}`, client);
      }
      const finalPayment = (await client.query('SELECT * FROM payments WHERE id=$1', [stored.id])).rows[0];
      const user = (await client.query('SELECT name FROM users WHERE id=$1', [stored.student_id])).rows[0];
      const exam = await getExam(stored.exam_id, client);
      return { payment: payment(finalPayment), studentName: user?.name || '', courseName: exam?.title || stored.exam_id, enrollmentConfirmed: true };
    });
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
      if (!row || !row.password_hash || !(await bcrypt.compare(password, row.password_hash))) throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
      await log(row.id, 'LOGIN', 'Authenticated session started');
      return publicUser(row);
    },
    async authenticateGoogle({ subject, email, name, target = 'JEE Main' }) {
      const found = await db.query('SELECT * FROM users WHERE google_subject=$1', [subject]);
      if (found.rows[0]) return publicUser(found.rows[0]);
      const emailMatch = await db.query('SELECT 1 FROM users WHERE LOWER(email)=LOWER($1)', [email]);
      if (emailMatch.rowCount) throw new AppError(409, 'An account already uses this email. Sign in with its existing method before linking Google.', 'GOOGLE_ACCOUNT_LINK_REQUIRED');
      const user = (await db.query(`INSERT INTO users(id,name,email,password_hash,role,target,academic_year,google_subject) VALUES($1,$2,$3,NULL,'student',$4,'2027',$5) RETURNING *`, [uid('student'), name, email, target, subject])).rows[0];
      await log(user.id, 'GOOGLE_SIGNUP', 'Google identity verified');
      return publicUser(user);
    },
    async registerUser({ name, email, password, target, role = 'student' }) {
      const existing = await db.query('SELECT 1 FROM users WHERE LOWER(email)=LOWER($1)', [email]);
      if (existing.rowCount) throw new AppError(409, 'Email already registered', 'EMAIL_EXISTS');
      const userRole = ['student', 'teacher', 'admin'].includes(role) ? role : 'student';
      const userId = uid(userRole);
      const row = (await db.query(
        `INSERT INTO users (id,name,email,password_hash,role,target,academic_year)
         VALUES ($1,$2,$3,$4,$5,$6,'2027') RETURNING *`,
        [userId, name, email, await bcrypt.hash(password, 12), userRole, target || 'JEE Main'],
      )).rows[0];

      if (userRole === 'student') {
        await db.query(
          `INSERT INTO wallets (id, user_id, balance, locked_balance, currency, status)
           VALUES ($1, $2, 0.00, 0.00, 'INR', 'active')
           ON CONFLICT (user_id) DO NOTHING`,
          [uid('wallet'), userId]
        );
        await db.query(
          `INSERT INTO student_profiles (user_id, target_exam, academic_year)
           VALUES ($1, $2, '2027')
           ON CONFLICT (user_id) DO NOTHING`,
          [userId, target || 'JEE Main']
        );
      } else if (userRole === 'teacher') {
        await db.query(
          `INSERT INTO teacher_profiles (user_id, designation, department)
           VALUES ($1, 'Faculty Member', 'Academics')
           ON CONFLICT (user_id) DO NOTHING`,
          [userId]
        );
      }
      return publicUser(row);
    },
    getExam,
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
    async listCourses({ publicOnly = false, excludeArchived = false, authenticated = true } = {}) {
      const where = publicOnly ? `WHERE courses.status='published' AND courses.is_visible=TRUE` : excludeArchived ? `WHERE courses.status<>'archived'` : '';
      const { rows } = await db.query(`
        SELECT courses.*,
          u.name AS teacher_name,
          (SELECT COUNT(*)::int FROM published_exams WHERE published_exams.course_id=courses.id) AS published_exam_count,
          (SELECT COALESCE(SUM(question_count),0)::int FROM published_exams WHERE published_exams.course_id=courses.id) AS published_question_count,
          (SELECT COUNT(*)::int FROM course_enrollments WHERE course_enrollments.course_id=courses.id AND course_enrollments.status='active') AS enrolled_student_count
        FROM courses
        LEFT JOIN users u ON u.id = courses.teacher_id
        ${where}
        ORDER BY courses.display_order, courses.name
      `);
      return rows.map((r) => {
        const c = course(r);
        if (!authenticated) {
          return {
            ...c,
            fee: null,
            discountPercent: null,
            effectivePrice: null,
            feeVisible: false,
          };
        }
        return {
          ...c,
          feeVisible: true,
        };
      });
    },
    async saveCourse(actorId, input, id = null) {
      const courseId = id || uid('course');
      const row = (await db.query(`
        INSERT INTO courses (id,slug,name,category,exam_type,short_description,full_description,image_url,banner_image_url,fee,discount_percent,duration_days,mock_test_count,status,is_visible,is_featured,display_order,created_by,teacher_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT (id) DO UPDATE SET
          slug=EXCLUDED.slug,name=EXCLUDED.name,category=EXCLUDED.category,exam_type=EXCLUDED.exam_type,
          short_description=EXCLUDED.short_description,full_description=EXCLUDED.full_description,
          image_url=EXCLUDED.image_url,banner_image_url=EXCLUDED.banner_image_url,
          fee=EXCLUDED.fee,discount_percent=EXCLUDED.discount_percent,duration_days=EXCLUDED.duration_days,
          mock_test_count=EXCLUDED.mock_test_count,status=EXCLUDED.status,is_visible=EXCLUDED.is_visible,
          is_featured=EXCLUDED.is_featured,display_order=EXCLUDED.display_order,
          teacher_id=COALESCE(EXCLUDED.teacher_id, courses.teacher_id),
          updated_at=NOW()
        RETURNING *
      `, [courseId, input.slug, input.name, input.category, input.examType, input.shortDescription || '', input.fullDescription || '', input.imageUrl || null, input.bannerImageUrl || null, input.fee || 0, input.discountPercent || 0, input.durationDays || 0, input.mockTestCount || 0, input.status, input.visible, input.featured, input.displayOrder || 0, actorId, input.teacherId || null])).rows[0];
      await log(actorId, id ? 'COURSE_UPDATE' : 'COURSE_CREATE', courseId);
      return course(row);
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
    async getOrCreateWallet(userId, client = db) {
      let { rows } = await client.query('SELECT * FROM wallets WHERE user_id = $1', [userId]);
      if (!rows[0]) {
        const id = uid('wallet');
        rows = (await client.query(
          `INSERT INTO wallets (id, user_id, balance, locked_balance, currency, status)
           VALUES ($1, $2, 0.00, 0.00, 'INR', 'active')
           ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
           RETURNING *`,
          [id, userId]
        )).rows;
      }
      return rows[0];
    },
    async getStudentWallet(studentId) {
      const wallet = await this.getOrCreateWallet(studentId);
      const [historyResult, aggregates] = await Promise.all([
        db.query(`
          SELECT * FROM wallet_transactions
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 100
        `, [studentId]),
        db.query(`
          SELECT
            COALESCE(SUM(amount) FILTER (WHERE type = 'deposit' AND status = 'successful'), 0)::numeric AS total_deposited,
            COALESCE(SUM(amount) FILTER (WHERE type = 'course_purchase' AND status = 'successful'), 0)::numeric AS total_spent,
            COALESCE(SUM(amount) FILTER (WHERE type = 'withdrawal' AND status = 'successful'), 0)::numeric AS total_withdrawn,
            COALESCE((SELECT SUM(amount) FROM withdrawal_requests WHERE user_id = $1 AND status IN ('pending', 'processing')), 0)::numeric AS pending_withdrawals,
            COALESCE((SELECT SUM(amount) FROM payment_orders WHERE user_id = $1 AND status = 'created' AND purpose = 'wallet_deposit'), 0)::numeric AS pending_deposits
          FROM wallet_transactions
          WHERE user_id = $1
        `, [studentId])
      ]);

      const balance = Number(wallet.balance);
      const lockedBalance = Number(wallet.locked_balance);
      const availableBalance = Number((balance - lockedBalance).toFixed(2));
      const agg = aggregates.rows[0];

      const transactions = historyResult.rows.map(tx => ({
        id: tx.id,
        type: tx.type,
        direction: tx.direction,
        amount: Number(tx.amount),
        balanceBefore: Number(tx.balance_before),
        balanceAfter: Number(tx.balance_after),
        status: tx.status,
        referenceId: tx.reference_id,
        description: tx.description,
        metadata: tx.metadata || {},
        date: iso(tx.created_at)
      }));

      return {
        mode: 'demo',
        currency: 'INR',
        balance,
        availableBalance,
        lockedBalance,
        totalDeposited: Number(agg.total_deposited),
        totalSpent: Number(agg.total_spent),
        totalWithdrawn: Number(agg.total_withdrawn),
        pendingWithdrawals: Number(agg.pending_withdrawals),
        pendingDeposits: Number(agg.pending_deposits),
        transactions
      };
    },
    async demoWallet(studentId) {
      return this.getStudentWallet(studentId);
    },
    async studentDashboard(studentId) {
      const [registrations, attempts, studentCourses] = await Promise.all([
        db.query('SELECT * FROM registrations WHERE student_id=$1 ORDER BY created_at DESC', [studentId]),
        db.query('SELECT * FROM attempts WHERE student_id=$1 ORDER BY started_at DESC', [studentId]),
        this.listStudentCourses(studentId),
      ]);
      const wallet = await this.getStudentWallet(studentId);
      return {
        registrations: registrations.rows.map(registration),
        attempts: attempts.rows.map(attempt),
        enrolledCourses: studentCourses.map(r => ({
          id: r.id,
          enrollmentId: r.enrollmentId || r.id,
          courseId: r.courseId,
          courseName: r.courseName || r.name,
          name: r.name || r.courseName,
          slug: r.slug,
          category: r.category,
          examType: r.examType,
          shortDescription: r.shortDescription,
          imageUrl: r.imageUrl,
          bannerImageUrl: r.bannerImageUrl,
          feePaid: Number(r.feePaid ?? 0),
          teacherName: r.teacherName,
          durationDays: r.durationDays || 180,
          mockTestCount: r.mockTestCount || 1,
          examCount: r.examCount || 1,
          primaryExamId: r.primaryExamId,
          linkedExams: r.linkedExams || [],
          status: r.status,
          enrolledAt: r.enrolledAt,
        })),
        wallet: {
          balance: wallet.balance,
          availableBalance: wallet.availableBalance,
          lockedBalance: wallet.lockedBalance,
          currency: wallet.currency
        },
        rewards: []
      };
    },
    async createDepositOrder(studentId, { amount, paymentMethod = 'upi_phonepe' }) {
      if (amount < 10 || amount > 500000) throw new AppError(400, 'Deposit amount must be between ₹10 and ₹5,00,000', 'INVALID_AMOUNT');
      return db.transaction(async (client) => {
        const wallet = await this.getOrCreateWallet(studentId, client);
        const orderId = uid('order');
        const amountPaise = Math.round(amount * 100);
        const idempotencyKey = `dep-order-${studentId}-${amountPaise}-${Date.now()}`;
        const gatewayOrderId = `order_demo_${crypto.randomBytes(8).toString('hex')}`;

        let razorpayOrderId = gatewayOrderId;
        if (paymentProviderConfigured && razorpay) {
          try {
            const rzpOrder = await razorpay.orders.create({
              amount: amountPaise,
              currency: 'INR',
              receipt: orderId.slice(0, 40),
              notes: { studentId, walletId: wallet.id, purpose: 'wallet_deposit' }
            });
            razorpayOrderId = rzpOrder.id;
          } catch {
            razorpayOrderId = gatewayOrderId;
          }
        }

        const { rows } = await client.query(
          `INSERT INTO payment_orders (id, user_id, wallet_id, purpose, amount, amount_paise, currency, payment_method, gateway, gateway_order_id, status, idempotency_key, metadata)
           VALUES ($1,$2,$3,'wallet_deposit',$4,$5,'INR',$6,$7,$8,'created',$9,$10)
           RETURNING *`,
          [orderId, studentId, wallet.id, amount, amountPaise, paymentMethod, 'DEMO_SANDBOX', razorpayOrderId, idempotencyKey, JSON.stringify({ studentId, method: paymentMethod })]
        );

        await log(studentId, 'DEPOSIT_ORDER_CREATED', `₹${amount} via ${paymentMethod}`, client);

        return {
          orderId: rows[0].id,
          gatewayOrderId: razorpayOrderId,
          amount,
          currency: 'INR',
          paymentMethod,
          mode: 'DEMO MODE',
          isDemo: true,
          keyId: razorpayConfig.keyId || 'rzp_test_demo'
        };
      });
    },
    async verifyDepositOrder(studentId, { orderId, gatewayPaymentId, gatewaySignature, isDemoSimulated = true }) {
      return db.transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`deposit_order:${orderId}`]);
        const { rows: orderRows } = await client.query(
          `SELECT * FROM payment_orders WHERE (id=$1 OR gateway_order_id=$1) AND user_id=$2 FOR UPDATE`,
          [orderId, studentId]
        );
        const order = orderRows[0];
        if (!order) throw new AppError(404, 'Deposit order not found', 'ORDER_NOT_FOUND');
        if (order.status === 'captured') {
          const wallet = await this.getOrCreateWallet(studentId, client);
          return { verified: true, wallet: { balance: Number(wallet.balance) }, order, alreadyProcessed: true };
        }
        if (order.status !== 'created' && order.status !== 'attempted') {
          throw new AppError(400, `Order is in invalid status: ${order.status}`, 'INVALID_ORDER_STATUS');
        }

        const verifiedPaymentId = gatewayPaymentId || `pay_demo_${crypto.randomBytes(8).toString('hex')}`;
        const wallet = await this.getOrCreateWallet(studentId, client);
        const balanceBefore = Number(wallet.balance);
        const depositAmount = Number(order.amount);
        const balanceAfter = Number((balanceBefore + depositAmount).toFixed(2));

        await client.query('UPDATE wallets SET balance=$1, updated_at=NOW() WHERE id=$2', [balanceAfter, wallet.id]);

        const txId = uid('tx');
        await client.query(
          `INSERT INTO wallet_transactions (id, wallet_id, user_id, type, direction, amount, balance_before, balance_after, status, reference_id, description, metadata)
           VALUES ($1,$2,$3,'deposit','credit',$4,$5,$6,'successful',$7,$8,$9)`,
          [txId, wallet.id, studentId, depositAmount, balanceBefore, balanceAfter, `DEP-${order.id}`, `Deposit via ${order.payment_method.toUpperCase()} (DEMO MODE)`, JSON.stringify({ orderId: order.id, gatewayPaymentId: verifiedPaymentId, gateway: order.gateway })]
        );

        await client.query(
          `UPDATE payment_orders SET status='captured', gateway_payment_id=$1, verified_at=NOW(), updated_at=NOW() WHERE id=$2`,
          [verifiedPaymentId, order.id]
        );

        await log(studentId, 'DEPOSIT_SUCCESSFUL', `₹${depositAmount} credited (DEMO MODE)`, client);

        return {
          verified: true,
          amount: depositAmount,
          balance: balanceAfter,
          transactionId: txId,
          orderId: order.id,
          isDemo: true
        };
      });
    },
    async requestWithdrawal(studentId, { amount, payoutMethod, payoutDetails }) {
      if (amount < 10) throw new AppError(400, 'Minimum withdrawal amount is ₹10', 'MINIMUM_WITHDRAWAL');
      if (amount > 100000) throw new AppError(400, 'Maximum single withdrawal is ₹1,00,000', 'MAXIMUM_WITHDRAWAL');

      return db.transaction(async (client) => {
        let { rows: walletRows } = await client.query('SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE', [studentId]);
        if (!walletRows[0]) {
          const wId = uid('wallet');
          walletRows = (await client.query(
            `INSERT INTO wallets (id, user_id, balance, locked_balance, currency, status)
             VALUES ($1, $2, 0.00, 0.00, 'INR', 'active')
             RETURNING *`,
            [wId, studentId]
          )).rows;
        }
        const wallet = walletRows[0];
        const balance = Number(wallet.balance);
        const locked = Number(wallet.locked_balance);
        const available = Number((balance - locked).toFixed(2));

        if (available < amount) {
          throw new AppError(400, `Insufficient eligible balance. Available: ₹${available.toFixed(2)}, requested: ₹${amount.toFixed(2)}.`, 'INSUFFICIENT_FUNDS');
        }

        const newLocked = Number((locked + amount).toFixed(2));
        await client.query('UPDATE wallets SET locked_balance=$1, updated_at=NOW() WHERE id=$2', [newLocked, wallet.id]);

        const reqId = uid('wd');
        const refNum = `WD-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const { rows: wdRows } = await client.query(
          `INSERT INTO withdrawal_requests (id, user_id, wallet_id, amount, payout_method, payout_details, status, reference_number)
           VALUES ($1,$2,$3,$4,$5,$6,'pending',$7)
           RETURNING *`,
          [reqId, studentId, wallet.id, amount, payoutMethod, JSON.stringify(payoutDetails), refNum]
        );

        const txId = uid('tx');
        await client.query(
          `INSERT INTO wallet_transactions (id, wallet_id, user_id, type, direction, amount, balance_before, balance_after, status, reference_id, description, metadata)
           VALUES ($1,$2,$3,'withdrawal_hold','debit',$4,$5,$6,'pending',$7,$8,$9)`,
          [txId, wallet.id, studentId, amount, balance, Number((available - amount).toFixed(2)), `HOLD-${refNum}`, `Withdrawal request placed - funds reserved (${refNum})`, JSON.stringify({ withdrawalId: reqId, referenceNumber: refNum, payoutMethod })]
        );

        await log(studentId, 'WITHDRAWAL_REQUESTED', `${refNum}: ₹${amount}`, client);

        return {
          withdrawal: wdRows[0],
          availableBalance: Number((balance - newLocked).toFixed(2)),
          lockedBalance: newLocked
        };
      });
    },
    async listStudentWithdrawals(studentId) {
      const { rows } = await db.query(
        `SELECT * FROM withdrawal_requests WHERE user_id=$1 ORDER BY created_at DESC`,
        [studentId]
      );
      return rows.map(r => ({
        id: r.id,
        amount: Number(r.amount),
        payoutMethod: r.payout_method,
        payoutDetails: r.payout_details,
        status: r.status,
        referenceNumber: r.reference_number,
        rejectionReason: r.rejection_reason || null,
        adminNotes: r.admin_notes || null,
        createdAt: iso(r.created_at),
        processedAt: iso(r.processed_at)
      }));
    },
    async enrollCourse(studentId, courseId) {
      return db.transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`course_enroll:${studentId}:${courseId}`]);

        const { rows: courseRows } = await client.query('SELECT * FROM courses WHERE id=$1 AND status<>\'archived\'', [courseId]);
        const targetCourse = courseRows[0];
        if (!targetCourse) throw new AppError(404, 'Course not found', 'COURSE_NOT_FOUND');
        if (targetCourse.status !== 'published') throw new AppError(409, 'Course is not currently open for enrollment', 'COURSE_NOT_PUBLISHED');

        const { rowCount: existing } = await client.query(
          `SELECT 1 FROM course_enrollments WHERE student_id=$1 AND course_id=$2 AND status='active'`,
          [studentId, courseId]
        );
        if (existing) throw new AppError(409, 'You are already enrolled in this course', 'ALREADY_ENROLLED');

        let { rows: walletRows } = await client.query('SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE', [studentId]);
        if (!walletRows[0]) {
          const wId = uid('wallet');
          walletRows = (await client.query(
            `INSERT INTO wallets (id, user_id, balance, locked_balance, currency, status)
             VALUES ($1, $2, 0.00, 0.00, 'INR', 'active')
             RETURNING *`,
            [wId, studentId]
          )).rows;
        }
        const wallet = walletRows[0];
        const price = discountedFee(targetCourse.fee, targetCourse.discount_percent);
        const available = Number((Number(wallet.balance) - Number(wallet.locked_balance)).toFixed(2));

        if (price > 0 && available < price) {
          throw new AppError(400, `Insufficient wallet balance. Course fee is ₹${price}, available balance is ₹${available.toFixed(2)}. Shortfall: ₹${(price - available).toFixed(2)}.`, 'INSUFFICIENT_FUNDS');
        }

        let txId = null;
        let balanceBefore = Number(wallet.balance);
        let balanceAfter = balanceBefore;

        if (price > 0) {
          balanceAfter = Number((balanceBefore - price).toFixed(2));
          await client.query('UPDATE wallets SET balance=$1, updated_at=NOW() WHERE id=$2', [balanceAfter, wallet.id]);

          txId = uid('tx');
          await client.query(
            `INSERT INTO wallet_transactions (id, wallet_id, user_id, type, direction, amount, balance_before, balance_after, status, reference_id, description, metadata)
             VALUES ($1,$2,$3,'course_purchase','debit',$4,$5,$6,'successful',$7,$8,$9)`,
            [txId, wallet.id, studentId, price, balanceBefore, balanceAfter, `COURSE-ENROLL-${studentId}-${courseId}-${Date.now()}`, `Enrolled in course: ${targetCourse.name}`, JSON.stringify({ courseId, courseName: targetCourse.name, price })]
          );
        }

        const enrollmentId = uid('enroll');
        const { rows: enrollRows } = await client.query(
          `INSERT INTO course_enrollments (id, student_id, course_id, fee_paid, payment_method, transaction_id, status)
           VALUES ($1,$2,$3,$4,$5,$6,'active')
           RETURNING *`,
          [enrollmentId, studentId, courseId, price, price > 0 ? 'wallet' : 'free', txId]
        );

        await log(studentId, 'COURSE_ENROLLED', `${targetCourse.name} (₹${price})`, client);

        const allExams = await listExams(client, { authenticated: true });
        const matchingExams = allExams.filter(x =>
          x.courseId === targetCourse.id ||
          (x.type && targetCourse.exam_type && x.type.toLowerCase().includes(targetCourse.exam_type.toLowerCase())) ||
          (targetCourse.slug && x.id.includes(targetCourse.slug.replace('-2026', '')))
        );
        const fallbackExamId = targetCourse.slug?.includes('neet') ? 'neet-01' : targetCourse.slug?.includes('advanced') ? 'jee-advanced-01' : 'jee-main-01';
        const primaryExamId = matchingExams[0]?.id || fallbackExamId;

        const examsToRegister = Array.from(new Set([primaryExamId, ...matchingExams.map(x => x.id)].filter(Boolean)));
        for (const exId of examsToRegister) {
          await client.query(
            `INSERT INTO registrations (id, student_id, exam_id, status)
             VALUES ($1, $2, $3, 'confirmed')
             ON CONFLICT (student_id, exam_id) DO UPDATE SET status = 'confirmed'`,
            [uid('reg'), studentId, exId]
          );
        }

        return {
          enrollment: enrollRows[0],
          course: { id: targetCourse.id, name: targetCourse.name, fee: price },
          walletBalance: balanceAfter,
          feePaid: price,
          reference: txId || `ENROLL-${enrollmentId}`,
          primaryExamId,
          wallet: {
            availableBalance: balanceAfter,
            balance: balanceAfter,
          },
        };
      });
    },
    async listStudentCourses(studentId) {
      const allExams = await listExams(db, { authenticated: true });
      const [enrollmentRes, regRes] = await Promise.all([
        db.query(`
          SELECT e.*, c.name AS course_name, c.slug, c.category, c.exam_type,
                 c.short_description, c.full_description, c.image_url, c.banner_image_url,
                 c.fee, c.discount_percent, c.duration_days, c.mock_test_count,
                 u.name AS teacher_name,
                 (SELECT COUNT(*)::int FROM published_exams p WHERE p.course_id = c.id) AS exam_count
          FROM course_enrollments e
          JOIN courses c ON c.id = e.course_id
          LEFT JOIN users u ON u.id = c.teacher_id
          WHERE e.student_id = $1 AND e.status = 'active'
          ORDER BY e.enrolled_at DESC
        `, [studentId]),
        db.query(`
          SELECT r.* FROM registrations r
          WHERE r.student_id = $1 AND r.status = 'confirmed'
          ORDER BY r.created_at DESC
        `, [studentId])
      ]);

      const courses = enrollmentRes.rows.map(r => {
        const matchingExams = allExams.filter(x =>
          x.courseId === r.course_id ||
          (x.type && r.exam_type && x.type.toLowerCase().includes(r.exam_type.toLowerCase())) ||
          (r.slug && x.id.includes(r.slug.replace('-2026', '')))
        );
        const fallbackExamId = r.slug?.includes('neet') ? 'neet-01' : r.slug?.includes('advanced') ? 'jee-advanced-01' : 'jee-main-01';
        const primaryExamId = matchingExams[0]?.id || fallbackExamId;

        return {
          id: r.id,
          enrollmentId: r.id,
          courseId: r.course_id,
          courseName: r.course_name,
          name: r.course_name,
          slug: r.slug,
          category: r.category,
          examType: r.exam_type,
          shortDescription: r.short_description,
          fullDescription: r.full_description,
          imageUrl: r.image_url,
          bannerImageUrl: r.banner_image_url,
          feePaid: Number(r.fee_paid),
          paymentMethod: r.payment_method,
          teacherName: r.teacher_name,
          durationDays: r.duration_days,
          mockTestCount: r.mock_test_count,
          examCount: matchingExams.length || r.exam_count || 1,
          primaryExamId,
          linkedExams: matchingExams.length ? matchingExams.map(ex => ({
            id: ex.id,
            title: ex.title,
            duration: ex.duration,
            questions: ex.questions,
            marks: ex.marks,
            subject: ex.subject,
            tag: ex.tag,
          })) : [{
            id: primaryExamId,
            title: `${r.course_name} · Grand Mock Test 01`,
            duration: 180,
            questions: 75,
            marks: 300,
            subject: r.exam_type || 'Comprehensive',
            tag: 'Official Practice',
          }],
          status: r.status,
          enrolledAt: iso(r.enrolled_at)
        };
      });

      // Include registered exams not already covered by an existing course
      const coveredExamIds = new Set();
      courses.forEach(c => {
        if (c.primaryExamId) coveredExamIds.add(c.primaryExamId);
        (c.linkedExams || []).forEach(x => coveredExamIds.add(x.id));
      });

      for (const reg of regRes.rows) {
        if (coveredExamIds.has(reg.exam_id)) continue;
        const exam = allExams.find(x => x.id === reg.exam_id);
        if (!exam) continue;

        coveredExamIds.add(reg.exam_id);
        courses.push({
          id: reg.id,
          enrollmentId: reg.id,
          courseId: exam.courseId || exam.id,
          courseName: exam.title,
          name: exam.title,
          slug: exam.id,
          category: exam.type || 'Registered Examination',
          examType: exam.type || 'Examination',
          shortDescription: exam.description || exam.syllabus || 'Registered examination access.',
          fullDescription: exam.description || exam.syllabus || '',
          imageUrl: exam.imageUrl || null,
          bannerImageUrl: exam.imageUrl || null,
          feePaid: Number(exam.fee || 0),
          paymentMethod: 'free',
          teacherName: 'Meritx Faculty',
          durationDays: 180,
          mockTestCount: 1,
          examCount: 1,
          primaryExamId: exam.id,
          linkedExams: [{
            id: exam.id,
            title: exam.title,
            duration: exam.duration,
            questions: exam.questions,
            marks: exam.marks,
            subject: exam.subject,
            tag: exam.tag || 'Free',
          }],
          status: 'active',
          enrolledAt: iso(reg.created_at)
        });
      }

      return courses;
    },
    async getStudentProfile(studentId) {
      const [userResult, profileResult] = await Promise.all([
        db.query('SELECT * FROM users WHERE id=$1', [studentId]),
        db.query('SELECT * FROM student_profiles WHERE user_id=$1', [studentId])
      ]);
      const user = userResult.rows[0];
      const profile = profileResult.rows[0] || {};
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        target: user.target,
        city: profile.city || user.city || '',
        state: profile.state || '',
        academicYear: profile.academic_year || user.academic_year || '2027',
        phone: profile.phone || '',
        bio: profile.bio || '',
        avatarUrl: profile.avatar_url || null,
        createdAt: iso(user.created_at)
      };
    },
    async updateStudentProfile(studentId, input) {
      if (input.city !== undefined || input.targetExam !== undefined) {
        await db.query(
          `UPDATE users SET city=COALESCE($1, city), target=COALESCE($2, target) WHERE id=$3`,
          [input.city || null, input.targetExam || null, studentId]
        );
      }
      await db.query(`
        INSERT INTO student_profiles (user_id, phone, bio, target_exam, city, state, academic_year, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          phone = COALESCE(EXCLUDED.phone, student_profiles.phone),
          bio = COALESCE(EXCLUDED.bio, student_profiles.bio),
          target_exam = COALESCE(EXCLUDED.target_exam, student_profiles.target_exam),
          city = COALESCE(EXCLUDED.city, student_profiles.city),
          state = COALESCE(EXCLUDED.state, student_profiles.state),
          academic_year = COALESCE(EXCLUDED.academic_year, student_profiles.academic_year),
          updated_at = NOW()
      `, [studentId, input.phone || null, input.bio || null, input.targetExam || null, input.city || null, input.state || null, input.academicYear || null]);
      await log(studentId, 'PROFILE_UPDATE', 'Student profile updated');
      return this.getStudentProfile(studentId);
    },
    async getTeacherDashboard(teacherId) {
      const [profileResult, coursesResult] = await Promise.all([
        db.query('SELECT * FROM teacher_profiles WHERE user_id=$1', [teacherId]),
        db.query(`
          SELECT c.*,
            (SELECT COUNT(*)::int FROM course_enrollments e WHERE e.course_id = c.id AND e.status = 'active') AS student_count,
            (SELECT COUNT(*)::int FROM published_exams p WHERE p.course_id = c.id) AS exam_count
          FROM courses c
          WHERE (c.teacher_id = $1 OR c.created_by = $1) AND c.status <> 'archived'
          ORDER BY c.name
        `, [teacherId])
      ]);

      const teacherCourses = coursesResult.rows;
      const courseIds = teacherCourses.map(c => c.id);

      let enrolledStudents = [];
      if (courseIds.length > 0) {
        const studentsResult = await db.query(`
          SELECT e.course_id, e.enrolled_at, e.status AS enrollment_status,
                 u.id AS student_id, u.name AS student_name, u.email AS student_email,
                 c.name AS course_name
          FROM course_enrollments e
          JOIN users u ON u.id = e.student_id
          JOIN courses c ON c.id = e.course_id
          WHERE e.course_id = ANY($1::text[]) AND e.status = 'active'
          ORDER BY e.enrolled_at DESC
        `, [courseIds]);
        enrolledStudents = studentsResult.rows;
      }

      const user = (await db.query('SELECT * FROM users WHERE id=$1', [teacherId])).rows[0];

      return {
        teacher: {
          id: teacherId,
          name: user?.name || '',
          email: user?.email || '',
          designation: profileResult.rows[0]?.designation || 'Faculty Member',
          department: profileResult.rows[0]?.department || 'Academics',
          specialization: profileResult.rows[0]?.specialization || 'Physics / Chemistry / Mathematics',
          bio: profileResult.rows[0]?.bio || '',
          experienceYears: profileResult.rows[0]?.experience_years || 0,
          phone: profileResult.rows[0]?.phone || ''
        },
        courses: teacherCourses.map(c => ({
          ...course(c),
          studentCount: c.student_count,
          examCount: c.exam_count
        })),
        enrolledStudents: enrolledStudents.map(s => ({
          studentId: s.student_id,
          studentName: s.student_name,
          studentEmail: s.student_email,
          courseId: s.course_id,
          courseName: s.course_name,
          enrolledAt: iso(s.enrolled_at),
          status: s.enrollment_status
        }))
      };
    },
    async getTeacherProfile(teacherId) {
      const dashboard = await this.getTeacherDashboard(teacherId);
      return dashboard.teacher;
    },
    async updateTeacherProfile(teacherId, input) {
      await db.query(`
        INSERT INTO teacher_profiles (user_id, phone, bio, designation, department, specialization, experience_years, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          phone = COALESCE(EXCLUDED.phone, teacher_profiles.phone),
          bio = COALESCE(EXCLUDED.bio, teacher_profiles.bio),
          designation = COALESCE(EXCLUDED.designation, teacher_profiles.designation),
          department = COALESCE(EXCLUDED.department, teacher_profiles.department),
          specialization = COALESCE(EXCLUDED.specialization, teacher_profiles.specialization),
          experience_years = COALESCE(EXCLUDED.experience_years, teacher_profiles.experience_years),
          updated_at = NOW()
      `, [teacherId, input.phone || null, input.bio || null, input.designation || null, input.department || null, input.specialization || null, input.experienceYears || null]);
      await log(teacherId, 'PROFILE_UPDATE', 'Teacher profile updated');
      return this.getTeacherProfile(teacherId);
    },
    async getAdminFinanceOverview(query = {}) {
      const [
        counts,
        courseCount,
        enrollmentCount,
        depositsSum,
        withdrawalsSum,
        courseRevenueSum,
        walletLiabilities,
        teacherWalletLiabilities,
        pendingWithdrawals,
        pendingAdminPayouts,
        pendingPayments,
        refundsSum,
        todayDeposits,
        todayPayments,
        todayPaidStudents,
        treasuryLedger,
        rewardsReserved
      ] = await Promise.all([
        db.query(`SELECT COUNT(*) FILTER (WHERE role='student')::int AS students, COUNT(*) FILTER (WHERE role='teacher')::int AS teachers FROM users`),
        db.query(`SELECT COUNT(*)::int AS count FROM courses WHERE status='published'`),
        db.query(`SELECT COUNT(*)::int AS count FROM course_enrollments WHERE status='active'`),
        db.query(`SELECT COALESCE(SUM(amount), 0)::numeric AS total, COUNT(*)::int AS count FROM wallet_transactions WHERE type='deposit' AND status='successful'`),
        db.query(`SELECT COALESCE(SUM(amount), 0)::numeric AS total, COUNT(*)::int AS count FROM wallet_transactions WHERE type='withdrawal' AND status='successful'`),
        db.query(`SELECT COALESCE(SUM(fee_paid), 0)::numeric AS total FROM course_enrollments WHERE status='active'`),
        db.query(`SELECT COALESCE(SUM(w.balance), 0)::numeric AS total, COALESCE(SUM(w.locked_balance), 0)::numeric AS locked FROM wallets w JOIN users u ON u.id = w.user_id WHERE u.role='student'`),
        db.query(`SELECT COALESCE(SUM(w.balance), 0)::numeric AS total, COALESCE(SUM(w.locked_balance), 0)::numeric AS locked FROM wallets w JOIN users u ON u.id = w.user_id WHERE u.role='teacher'`),
        db.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::numeric AS total FROM withdrawal_requests WHERE status IN ('pending', 'processing')`),
        db.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::numeric AS total FROM platform_payout_requests WHERE status IN ('requested', 'awaiting_approval', 'processing')`),
        db.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::numeric AS total FROM payment_orders WHERE status='created'`),
        db.query(`SELECT COALESCE(SUM(amount), 0)::numeric AS total, COUNT(*)::int AS count FROM wallet_transactions WHERE type IN ('refund', 'reversal') AND status='successful'`),
        db.query(`SELECT COALESCE(SUM(amount), 0)::numeric AS total, COUNT(*)::int AS count FROM wallet_transactions WHERE type='deposit' AND status='successful' AND created_at >= CURRENT_DATE`),
        db.query(`SELECT COALESCE(SUM(amount), 0)::numeric AS total, COUNT(*)::int AS count FROM payment_orders WHERE status IN ('captured', 'paid') AND created_at >= CURRENT_DATE`),
        db.query(`
          SELECT COUNT(DISTINCT user_id)::int AS count FROM (
            SELECT user_id FROM wallet_transactions WHERE type='deposit' AND status='successful' AND created_at >= CURRENT_DATE
            UNION
            SELECT user_id FROM payment_orders WHERE status IN ('captured', 'paid') AND created_at >= CURRENT_DATE
            UNION
            SELECT student_id AS user_id FROM course_enrollments WHERE status='active' AND enrolled_at >= CURRENT_DATE
          ) unique_payers
        `),
        db.query(`
          SELECT
            COALESCE(SUM(amount) FILTER (WHERE direction='credit' AND category='treasury'), 0)::numeric AS treasury_credits,
            COALESCE(SUM(amount) FILTER (WHERE direction='debit' AND category='treasury'), 0)::numeric AS treasury_debits,
            COALESCE(SUM(amount) FILTER (WHERE direction='credit' AND category='gateway_settlement'), 0)::numeric AS gateway_settled
          FROM platform_master_ledger
        `),
        db.query(`
          SELECT
            COALESCE(SUM(amount) FILTER (WHERE direction='credit' AND category='reward_liability'), 0)::numeric -
            COALESCE(SUM(amount) FILTER (WHERE direction='debit' AND category='reward_liability'), 0)::numeric AS net_reserved
          FROM platform_master_ledger
        `)
      ]);

      const totalStudents = counts.rows[0].students;
      const totalTeachers = counts.rows[0].teachers;
      const totalActiveCourses = courseCount.rows[0].count;
      const totalCourseEnrollments = enrollmentCount.rows[0].count;
      const totalSuccessfulDeposits = Number(depositsSum.rows[0].total);
      const totalSuccessfulWithdrawals = Number(withdrawalsSum.rows[0].total);
      const totalCourseRevenue = Number(courseRevenueSum.rows[0].total);
      const totalStudentWalletBalance = Number(walletLiabilities.rows[0].total);
      const totalTeacherWalletBalance = Number(teacherWalletLiabilities.rows[0].total);
      const totalWalletLiabilities = Number((totalStudentWalletBalance + totalTeacherWalletBalance).toFixed(2));
      const totalLockedLiabilities = Number((Number(walletLiabilities.rows[0].locked) + Number(teacherWalletLiabilities.rows[0].locked)).toFixed(2));
      const pendingWithdrawalCount = pendingWithdrawals.rows[0].count + pendingAdminPayouts.rows[0].count;
      const pendingWithdrawalAmount = Number((Number(pendingWithdrawals.rows[0].total) + Number(pendingAdminPayouts.rows[0].total)).toFixed(2));
      const pendingPaymentCount = pendingPayments.rows[0].count;
      const pendingPaymentAmount = Number(pendingPayments.rows[0].total);
      const totalRefunds = Number(refundsSum.rows[0].total);

      const todayCollection = Number((Number(todayDeposits.rows[0].total) + Number(todayPayments.rows[0].total)).toFixed(2));
      const todaySuccessfulPayments = Number(todayDeposits.rows[0].count) + Number(todayPayments.rows[0].count);
      const todayStudentsPaid = Number(todayPaidStudents.rows[0].count);

      const totalAmountCollectedAllTime = Number((totalSuccessfulDeposits + totalCourseRevenue).toFixed(2));
      const totalSuccessfulTransactions = Number(depositsSum.rows[0].count) + Number(withdrawalsSum.rows[0].count) + Number(enrollmentCount.rows[0].count);

      const treasuryCredits = Number(treasuryLedger.rows[0].treasury_credits);
      const treasuryDebits = Number(treasuryLedger.rows[0].treasury_debits);
      const totalSettledAmount = Number(treasuryLedger.rows[0].gateway_settled) || treasuryCredits;
      const totalRewardsReserved = Math.max(0, Number(rewardsReserved.rows[0].net_reserved));

      // Calculate available treasury and withdrawable platform balance
      const availablePlatformBalance = Number(Math.max(0, treasuryCredits - treasuryDebits).toFixed(2));
      const pendingAdminPayoutAmount = Number(pendingAdminPayouts.rows[0].total);
      const withdrawablePlatformBalance = Number(Math.max(0, availablePlatformBalance - totalRewardsReserved - pendingAdminPayoutAmount).toFixed(2));

      // Fetch Time Series Data for Graphs
      const [dailyRows, monthlyRows, refundsTrendRows, revenueTrendRows, withdrawalsTrendRows] = await Promise.all([
        db.query(`
          SELECT
            TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
            TO_CHAR(d.day, 'Mon DD') AS label,
            COALESCE(SUM(t.amount), 0)::numeric AS amount,
            COUNT(t.id)::int AS count
          FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day'::interval) d(day)
          LEFT JOIN wallet_transactions t ON DATE_TRUNC('day', t.created_at) = d.day AND t.type='deposit' AND t.status='successful'
          GROUP BY d.day ORDER BY d.day ASC
        `),
        db.query(`
          SELECT
            TO_CHAR(m.month, 'YYYY-MM') AS month,
            TO_CHAR(m.month, 'Mon YYYY') AS label,
            COALESCE(SUM(t.amount), 0)::numeric AS amount,
            COUNT(t.id)::int AS count
          FROM generate_series(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months'), DATE_TRUNC('month', CURRENT_DATE), '1 month'::interval) m(month)
          LEFT JOIN wallet_transactions t ON DATE_TRUNC('month', t.created_at) = m.month AND t.type='deposit' AND t.status='successful'
          GROUP BY m.month ORDER BY m.month ASC
        `),
        db.query(`
          SELECT
            TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(t.amount), 0)::numeric AS amount
          FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day'::interval) d(day)
          LEFT JOIN wallet_transactions t ON DATE_TRUNC('day', t.created_at) = d.day AND t.type IN ('refund','reversal') AND t.status='successful'
          GROUP BY d.day ORDER BY d.day ASC
        `),
        db.query(`
          SELECT
            TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(e.fee_paid) * 0.4, 0)::numeric AS platform_revenue
          FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day'::interval) d(day)
          LEFT JOIN course_enrollments e ON DATE_TRUNC('day', e.enrolled_at) = d.day AND e.status='active'
          GROUP BY d.day ORDER BY d.day ASC
        `),
        db.query(`
          SELECT
            TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(w.amount), 0)::numeric AS amount
          FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, '1 day'::interval) d(day)
          LEFT JOIN withdrawal_requests w ON DATE_TRUNC('day', w.processed_at) = d.day AND w.status='completed'
          GROUP BY d.day ORDER BY d.day ASC
        `)
      ]);

      const dailyCollections = dailyRows.rows.map(r => ({ date: r.date, label: r.label, amount: Number(r.amount), count: r.count }));
      const monthlyCollections = monthlyRows.rows.map(r => ({ month: r.month, label: r.label, amount: Number(r.amount), count: r.count }));
      const paymentsTrend = dailyCollections.map(d => ({ date: d.date, count: d.count }));
      const refundsTrend = refundsTrendRows.rows.map(r => ({ date: r.date, amount: Number(r.amount) }));
      const revenueTrend = revenueTrendRows.rows.map(r => ({ date: r.date, platformRevenue: Number(r.platform_revenue) }));
      const withdrawalTrend = withdrawalsTrendRows.rows.map(r => ({ date: r.date, amount: Number(r.amount) }));

      const summary = {
        totalStudents,
        totalTeachers,
        totalActiveCourses,
        totalCourseEnrollments,
        totalSuccessfulDeposits,
        depositCount: depositsSum.rows[0].count,
        totalSuccessfulWithdrawals,
        withdrawalCount: withdrawalsSum.rows[0].count,
        totalCourseRevenue,
        totalWalletLiabilities,
        totalLockedLiabilities,
        pendingWithdrawalCount,
        pendingWithdrawalAmount,
        pendingPaymentCount,
        pendingPaymentAmount,
        todayCollection,
        todaySuccessfulPayments,
        todayStudentsPaid,
        totalAmountCollectedAllTime,
        totalSuccessfulTransactions,
        totalStudentWalletBalance,
        totalTeacherWalletBalance,
        totalPendingWithdrawals: pendingWithdrawalAmount,
        totalRefunds,
        totalRewardsReserved,
        totalSettledAmount,
        availablePlatformBalance,
        withdrawablePlatformBalance
      };

      return {
        ...summary,
        summary,
        charts: {
          dailyCollections,
          monthlyCollections,
          paymentsTrend,
          refundsTrend,
          revenueTrend,
          withdrawalTrend
        },
        reconciliation: {
          totalCollectedDeposits: totalSuccessfulDeposits,
          totalEarnedCourseRevenue: totalCourseRevenue,
          totalCompletedWithdrawals: totalSuccessfulWithdrawals,
          totalOutstandingWalletLiabilities: totalWalletLiabilities,
          studentWalletLiabilities: totalStudentWalletBalance,
          teacherWalletLiabilities: totalTeacherWalletBalance,
          pendingTransactionsVolume: pendingPaymentAmount + pendingWithdrawalAmount,
          platformTreasuryBalance: availablePlatformBalance,
          withdrawableAmount: withdrawablePlatformBalance,
          settlementMode: 'VERIFIED PLATFORM MASTER WALLET'
        }
      };
    },
    async listStudentWallets({ search = '', status = 'all' } = {}) {
      let query = `
        SELECT
          u.id AS student_id, u.name AS student_name, u.email,
          COALESCE(w.balance, 0)::numeric AS balance,
          COALESCE(w.locked_balance, 0)::numeric AS locked_balance,
          COALESCE(w.status, 'active') AS wallet_status,
          COALESCE((SELECT SUM(t.amount) FROM wallet_transactions t WHERE t.user_id = u.id AND t.type = 'deposit' AND t.status = 'successful'), 0)::numeric AS total_deposits,
          COALESCE((SELECT SUM(t.amount) FROM wallet_transactions t WHERE t.user_id = u.id AND t.type = 'course_purchase' AND t.status = 'successful'), 0)::numeric AS total_spent,
          COALESCE((SELECT SUM(t.amount) FROM wallet_transactions t WHERE t.user_id = u.id AND t.type = 'withdrawal' AND t.status = 'successful'), 0)::numeric AS total_withdrawals,
          COALESCE((SELECT COUNT(*)::int FROM course_enrollments e WHERE e.student_id = u.id AND e.status = 'active'), 0)::int AS enrolled_course_count
        FROM users u
        LEFT JOIN wallets w ON w.user_id = u.id
        WHERE u.role = 'student'
      `;
      const params = [];
      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        query += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(u.id) LIKE $${params.length})`;
      }
      query += ` ORDER BY u.created_at DESC`;
      const { rows } = await db.query(query, params);
      return rows.map(r => ({
        studentId: r.student_id,
        studentName: r.student_name,
        email: r.email,
        balance: Number(r.balance),
        availableBalance: Number((Number(r.balance) - Number(r.locked_balance)).toFixed(2)),
        lockedBalance: Number(r.locked_balance),
        totalDeposits: Number(r.total_deposits),
        totalSpent: Number(r.total_spent),
        totalWithdrawals: Number(r.total_withdrawals),
        enrolledCourses: r.enrolled_course_count,
        accountStatus: r.wallet_status
      }));
    },
    async getStudentWalletDetails(studentId) {
      const [userResult, walletResult, txResult, enrollmentsResult, withdrawalsResult, depositsResult] = await Promise.all([
        db.query('SELECT * FROM users WHERE id=$1 AND role=\'student\'', [studentId]),
        db.query('SELECT * FROM wallets WHERE user_id=$1', [studentId]),
        db.query('SELECT * FROM wallet_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [studentId]),
        db.query(`
          SELECT e.*, c.name AS course_name, c.fee, c.discount_percent
          FROM course_enrollments e
          JOIN courses c ON c.id = e.course_id
          WHERE e.student_id=$1 ORDER BY e.enrolled_at DESC
        `, [studentId]),
        db.query('SELECT * FROM withdrawal_requests WHERE user_id=$1 ORDER BY created_at DESC', [studentId]),
        db.query('SELECT * FROM payment_orders WHERE user_id=$1 ORDER BY created_at DESC', [studentId])
      ]);

      if (!userResult.rows[0]) throw new AppError(404, 'Student not found', 'STUDENT_NOT_FOUND');
      const user = userResult.rows[0];
      const wallet = walletResult.rows[0] || { balance: 0, locked_balance: 0, currency: 'INR', status: 'active' };

      return {
        student: publicUser(user),
        wallet: {
          id: wallet.id,
          balance: Number(wallet.balance),
          lockedBalance: Number(wallet.locked_balance),
          availableBalance: Number((Number(wallet.balance) - Number(wallet.locked_balance)).toFixed(2)),
          currency: wallet.currency,
          status: wallet.status
        },
        transactions: txResult.rows.map(tx => ({
          id: tx.id,
          type: tx.type,
          direction: tx.direction,
          amount: Number(tx.amount),
          balanceBefore: Number(tx.balance_before),
          balanceAfter: Number(tx.balance_after),
          status: tx.status,
          referenceId: tx.reference_id,
          description: tx.description,
          date: iso(tx.created_at)
        })),
        enrollments: enrollmentsResult.rows.map(e => ({
          id: e.id,
          courseId: e.course_id,
          courseName: e.course_name,
          feePaid: Number(e.fee_paid),
          status: e.status,
          enrolledAt: iso(e.enrolled_at)
        })),
        withdrawals: withdrawalsResult.rows.map(w => ({
          id: w.id,
          amount: Number(w.amount),
          status: w.status,
          payoutMethod: w.payout_method,
          payoutDetails: w.payout_details,
          referenceNumber: w.reference_number,
          rejectionReason: w.rejection_reason,
          createdAt: iso(w.created_at),
          processedAt: iso(w.processed_at)
        })),
        deposits: depositsResult.rows.map(d => ({
          id: d.id,
          amount: Number(d.amount),
          paymentMethod: d.payment_method,
          status: d.status,
          gatewayOrderId: d.gateway_order_id,
          gatewayPaymentId: d.gateway_payment_id,
          createdAt: iso(d.created_at)
        }))
      };
    },
    async listAdminWithdrawals({ status = 'all' } = {}) {
      let query = `
        SELECT w.*, u.name AS student_name, u.email AS student_email
        FROM withdrawal_requests w
        JOIN users u ON u.id = w.user_id
      `;
      const params = [];
      if (status && status !== 'all') {
        params.push(status);
        query += ` WHERE w.status = $${params.length}`;
      }
      query += ` ORDER BY w.created_at DESC`;
      const { rows } = await db.query(query, params);
      return rows.map(r => ({
        id: r.id,
        studentId: r.user_id,
        studentName: r.student_name,
        studentEmail: r.student_email,
        amount: Number(r.amount),
        payoutMethod: r.payout_method,
        payoutDetails: r.payout_details,
        status: r.status,
        referenceNumber: r.reference_number,
        adminNotes: r.admin_notes,
        rejectionReason: r.rejection_reason,
        createdAt: iso(r.created_at),
        processedAt: iso(r.processed_at)
      }));
    },
    async reviewWithdrawal(actorId, { id, action, rejectionReason, notes }) {
      return db.transaction(async (client) => {
        const { rows: reqRows } = await client.query('SELECT * FROM withdrawal_requests WHERE id=$1 FOR UPDATE', [id]);
        const req = reqRows[0];
        if (!req) throw new AppError(404, 'Withdrawal request not found', 'NOT_FOUND');
        if (req.status !== 'pending' && req.status !== 'processing') {
          throw new AppError(409, `Withdrawal request is already ${req.status}`, 'ALREADY_PROCESSED');
        }

        const { rows: walletRows } = await client.query('SELECT * FROM wallets WHERE id=$1 FOR UPDATE', [req.wallet_id]);
        const wallet = walletRows[0];
        const amount = Number(req.amount);
        const currentBalance = Number(wallet.balance);
        const currentLocked = Number(wallet.locked_balance);

        if (action === 'approve') {
          const newBalance = Number(Math.max(0, currentBalance - amount).toFixed(2));
          const newLocked = Number(Math.max(0, currentLocked - amount).toFixed(2));

          await client.query('UPDATE wallets SET balance=$1, locked_balance=$2, updated_at=NOW() WHERE id=$3', [newBalance, newLocked, wallet.id]);

          const txId = uid('tx');
          await client.query(
            `INSERT INTO wallet_transactions (id, wallet_id, user_id, type, direction, amount, balance_before, balance_after, status, reference_id, description, metadata)
             VALUES ($1,$2,$3,'withdrawal','debit',$4,$5,$6,'successful',$7,$8,$9)`,
            [txId, wallet.id, req.user_id, amount, currentBalance, newBalance, `WD-CMPL-${req.id}`, `Withdrawal payout processed (DEMO SIMULATION) - ${req.reference_number}`, JSON.stringify({ withdrawalId: req.id, referenceNumber: req.reference_number, approvedBy: actorId })]
          );

          const { rows: updatedReq } = await client.query(
            `UPDATE withdrawal_requests SET status='completed', transaction_id=$1, admin_notes=$2, processed_by=$3, processed_at=NOW(), updated_at=NOW() WHERE id=$4 RETURNING *`,
            [txId, notes || 'Approved and payout simulated', actorId, req.id]
          );

          await log(actorId, 'WITHDRAWAL_APPROVED', `${req.reference_number}: ₹${amount}`, client);
          return updatedReq[0];
        } else {
          const newLocked = Number(Math.max(0, currentLocked - amount).toFixed(2));
          await client.query('UPDATE wallets SET locked_balance=$1, updated_at=NOW() WHERE id=$2', [newLocked, wallet.id]);

          const txId = uid('tx');
          await client.query(
            `INSERT INTO wallet_transactions (id, wallet_id, user_id, type, direction, amount, balance_before, balance_after, status, reference_id, description, metadata)
             VALUES ($1,$2,$3,'reversal','credit',$4,$5,$6,'successful',$7,$8,$9)`,
            [txId, wallet.id, req.user_id, amount, currentBalance, currentBalance, `WD-REJ-${req.id}`, `Withdrawal rejected: ${rejectionReason || 'Declined'} - reserved funds restored`, JSON.stringify({ withdrawalId: req.id, referenceNumber: req.reference_number, rejectionReason, rejectedBy: actorId })]
          );

          const { rows: updatedReq } = await client.query(
            `UPDATE withdrawal_requests SET status='rejected', rejection_reason=$1, admin_notes=$2, processed_by=$3, processed_at=NOW(), updated_at=NOW() WHERE id=$4 RETURNING *`,
            [rejectionReason || 'Declined by administrator', notes || null, actorId, req.id]
          );

          await log(actorId, 'WITHDRAWAL_REJECTED', `${req.reference_number}: ₹${amount} - ${rejectionReason}`, client);
          return updatedReq[0];
        }
      });
    },
    async getFinancialReports({ startDate, endDate, status, type } = {}) {
      let txQuery = `SELECT * FROM wallet_transactions WHERE 1=1`;
      const params = [];
      if (startDate) {
        params.push(startDate);
        txQuery += ` AND created_at >= $${params.length}::timestamptz`;
      }
      if (endDate) {
        params.push(endDate);
        txQuery += ` AND created_at <= $${params.length}::timestamptz`;
      }
      if (status && status !== 'all') {
        params.push(status);
        txQuery += ` AND status = $${params.length}`;
      }
      if (type && type !== 'all') {
        params.push(type);
        txQuery += ` AND type = $${params.length}`;
      }
      txQuery += ` ORDER BY created_at DESC LIMIT 500`;

      const [txResult, courseSalesResult, studentPaymentsResult] = await Promise.all([
        db.query(txQuery, params),
        db.query(`
          SELECT c.id AS course_id, c.name AS course_name, COUNT(e.id)::int AS total_sales,
                 COALESCE(SUM(e.fee_paid), 0)::numeric AS total_revenue
          FROM courses c
          LEFT JOIN course_enrollments e ON e.course_id = c.id AND e.status = 'active'
          GROUP BY c.id, c.name
          ORDER BY total_revenue DESC
        `),
        db.query(`
          SELECT u.id AS student_id, u.name AS student_name, u.email,
                 COUNT(e.id)::int AS enrolled_courses,
                 COALESCE(SUM(e.fee_paid), 0)::numeric AS total_spent,
                 COALESCE((SELECT SUM(t.amount) FROM wallet_transactions t WHERE t.user_id = u.id AND t.type = 'deposit' AND t.status = 'successful'), 0)::numeric AS total_deposited
          FROM users u
          LEFT JOIN course_enrollments e ON e.student_id = u.id AND e.status = 'active'
          WHERE u.role = 'student'
          GROUP BY u.id, u.name, u.email
          ORDER BY total_spent DESC
          LIMIT 100
        `)
      ]);

      return {
        transactions: txResult.rows.map(tx => ({
          id: tx.id,
          userId: tx.user_id,
          type: tx.type,
          direction: tx.direction,
          amount: Number(tx.amount),
          balanceBefore: Number(tx.balance_before),
          balanceAfter: Number(tx.balance_after),
          status: tx.status,
          referenceId: tx.reference_id,
          description: tx.description,
          date: iso(tx.created_at)
        })),
        courseSales: courseSalesResult.rows.map(cs => ({
          courseId: cs.course_id,
          courseName: cs.course_name,
          salesCount: cs.total_sales,
          revenue: Number(cs.total_revenue)
        })),
        studentPayments: studentPaymentsResult.rows.map(sp => ({
          studentId: sp.student_id,
          studentName: sp.student_name,
          email: sp.email,
          coursesEnrolled: sp.enrolled_courses,
          totalSpent: Number(sp.total_spent),
          totalDeposited: Number(sp.total_deposited)
        }))
      };
    },
    async exportFinancialCsv(filters = {}) {
      const reports = await this.getFinancialReports(filters);
      const headers = ['Transaction ID', 'Date & Time', 'User ID', 'Type', 'Direction', 'Amount (INR)', 'Balance Before', 'Balance After', 'Status', 'Reference ID', 'Description'];
      const rows = [headers.join(',')];
      for (const tx of reports.transactions) {
        const row = [
          tx.id,
          `"${tx.date}"`,
          tx.userId,
          tx.type,
          tx.direction,
          tx.amount.toFixed(2),
          tx.balanceBefore.toFixed(2),
          tx.balanceAfter.toFixed(2),
          tx.status,
          `"${tx.referenceId || ''}"`,
          `"${(tx.description || '').replace(/"/g, '""')}"`
        ];
        rows.push(row.join(','));
      }
      return rows.join('\n');
    },
    async registerExam(studentId, examId) {
      return db.transaction(async (client) => {
        const exam = await getExam(examId, client);
        if (!exam) throw new AppError(404, 'Exam unavailable', 'EXAM_NOT_FOUND');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`registration:${examId}`]);
        if (exam.status !== 'published' && exam.status !== 'upcoming') throw new AppError(409, 'Registration is not available for this examination', 'REGISTRATION_CLOSED');
        if (exam.registrationOpen === false || (exam.schedule?.registrationClosesAt && Date.now() > new Date(exam.schedule.registrationClosesAt).getTime()) || (exam.schedule?.registrationOpensAt && Date.now() < new Date(exam.schedule.registrationOpensAt).getTime())) throw new AppError(409, 'Registration is outside its configured window', 'REGISTRATION_CLOSED');
        if (exam.schedule?.eligibleStudentIds?.length && !exam.schedule.eligibleStudentIds.includes(studentId)) throw new AppError(403, 'You are not eligible for this examination', 'EXAM_NOT_ELIGIBLE');
        if (exam.schedule?.maximumParticipants) {
          const count = await client.query(`SELECT COUNT(*)::int AS count FROM registrations WHERE exam_id=$1 AND status='confirmed'`, [examId]);
          if (count.rows[0].count >= exam.schedule.maximumParticipants) throw new AppError(409, 'This examination has reached its participant limit', 'EXAM_FULL');
        }
        if (exam.fee > 0) throw new AppError(503, 'Paid registration requires a configured server-verified payment provider', 'PAYMENT_PROVIDER_REQUIRED');
        const exists = await client.query('SELECT 1 FROM registrations WHERE student_id=$1 AND exam_id=$2', [studentId, examId]);
        if (exists.rowCount) throw new AppError(409, 'Already registered', 'ALREADY_REGISTERED');
        const paymentRow = (await client.query(
          `INSERT INTO payments (id,student_id,exam_id,course_id,amount,amount_paise,status,gateway) VALUES ($1,$2,$3,$4,0,0,'free','FREE') RETURNING *`,
          [uid('pay'), studentId, examId, exam.courseId || null],
        )).rows[0];
        const registrationRow = (await client.query(
          `INSERT INTO registrations (id,student_id,exam_id,payment_id,status) VALUES ($1,$2,$3,$4,'confirmed') RETURNING *`,
          [uid('reg'), studentId, examId, paymentRow.id],
        )).rows[0];

        // Also ensure student is enrolled in the linked or matching course in course_enrollments if a course exists
        let targetCourseId = exam.courseId;
        if (!targetCourseId) {
          const courseMatch = await client.query(
            `SELECT id FROM courses
             WHERE status<>'archived'
             AND (
               exam_type = $1
               OR ($2 LIKE 'jee-%' AND (exam_type ILIKE '%jee%' OR slug ILIKE '%jee%'))
               OR ($2 LIKE 'neet-%' AND (exam_type ILIKE '%neet%' OR slug ILIKE '%neet%'))
               OR ($2 LIKE 'mht-%' AND (exam_type ILIKE '%mht%' OR slug ILIKE '%mht%'))
             )
             ORDER BY display_order ASC LIMIT 1`,
            [exam.type || '', examId]
          );
          if (courseMatch.rows[0]) targetCourseId = courseMatch.rows[0].id;
        }
        if (targetCourseId) {
          await client.query(
            `INSERT INTO course_enrollments (id, student_id, course_id, fee_paid, payment_method, status)
             VALUES ($1, $2, $3, 0, 'free', 'active')
             ON CONFLICT (student_id, course_id) DO UPDATE SET status = 'active'`,
            [uid('enr'), studentId, targetCourseId]
          );
        }

        await log(studentId, 'EXAM_REGISTER', examId, client);
        return { registration: registration(registrationRow), payment: payment(paymentRow) };
      });
    },
    paymentConfiguration() {
      return { configured: env.nodeEnv !== 'production' && paymentProviderConfigured, mode: razorpayConfig.mode || 'test', realMoneyEnabled: false };
    },
    async createPaymentOrder(studentId, examId) {
      if (env.nodeEnv === 'production') throw new AppError(503, 'Real-money registration is disabled pending documented legal and provider approval', 'REAL_MONEY_DISABLED');
      const exam = await getExam(examId);
      if (!exam || !['published', 'upcoming'].includes(exam.status) || exam.registrationOpen === false) throw new AppError(409, 'Registration is not available for this examination', 'REGISTRATION_CLOSED');
      const amount = discountedFee(exam.fee, exam.discountPercent);
      if (amount <= 0) return { free: true };
      if (!paymentProviderConfigured) throw new AppError(503, 'Razorpay Test Mode is not configured. Ask an administrator to add the test API keys.', 'PAYMENT_PROVIDER_NOT_CONFIGURED');

      return db.transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`payment:${studentId}:${examId}`]);
        const enrolled = await client.query(`SELECT 1 FROM registrations WHERE student_id=$1 AND exam_id=$2 AND status='confirmed'`, [studentId, examId]);
        if (enrolled.rowCount) throw new AppError(409, 'Already registered', 'ALREADY_REGISTERED');
        const existing = await client.query(`SELECT * FROM payments WHERE student_id=$1 AND exam_id=$2 AND status='created' AND amount_paise=$3 AND created_at > NOW() - INTERVAL '15 minutes' ORDER BY created_at DESC LIMIT 1`, [studentId, examId, Math.round(amount * 100)]);
        if (existing.rows[0]) return { free: false, keyId: razorpayConfig.keyId, mode: razorpayConfig.mode, order: { id: existing.rows[0].gateway_order_id, amount: Number(existing.rows[0].amount_paise), currency: existing.rows[0].currency }, payment: payment(existing.rows[0]), exam: { id: exam.id, name: exam.title } };

        const internalId = uid('pay');
        const amountPaise = Math.round(amount * 100);
        const gatewayOrder = await razorpay.orders.create({
          amount: amountPaise,
          currency: 'INR',
          receipt: internalId.slice(0, 40),
          notes: { studentId, examId, courseId: exam.courseId || '' },
        });
        const row = (await client.query(`INSERT INTO payments (id,student_id,exam_id,course_id,amount,amount_paise,currency,status,gateway,gateway_order_id) VALUES ($1,$2,$3,$4,$5,$6,'INR','created','RAZORPAY',$7) RETURNING *`, [internalId, studentId, examId, exam.courseId || null, amount, amountPaise, gatewayOrder.id])).rows[0];
        await log(studentId, 'PAYMENT_ORDER_CREATE', `${examId}:${gatewayOrder.id}`, client);
        return { free: false, keyId: razorpayConfig.keyId, mode: razorpayConfig.mode, order: { id: gatewayOrder.id, amount: Number(gatewayOrder.amount), currency: gatewayOrder.currency }, payment: payment(row), exam: { id: exam.id, name: exam.title } };
      });
    },
    async verifyPayment(studentId, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
      if (env.nodeEnv === 'production') throw new AppError(503, 'Real-money registration is disabled pending documented legal and provider approval', 'REAL_MONEY_DISABLED');
      const stored = (await db.query(`SELECT * FROM payments WHERE student_id=$1 AND gateway_order_id=$2`, [studentId, razorpayOrderId])).rows[0];
      if (!stored) throw new AppError(404, 'Payment order not found', 'PAYMENT_ORDER_NOT_FOUND');
      if (stored.status === 'captured') {
        if (stored.gateway_payment_id !== razorpayPaymentId) throw new AppError(409, 'This order was already paid using a different payment', 'PAYMENT_ALREADY_CAPTURED');
        const exam = await getExam(stored.exam_id);
        const user = (await db.query('SELECT name FROM users WHERE id=$1', [studentId])).rows[0];
        return { payment: payment(stored), studentName: user?.name || '', courseName: exam?.title || stored.exam_id, enrollmentConfirmed: true };
      }
      if (!paymentProviderConfigured) throw new AppError(503, 'Razorpay is not configured', 'PAYMENT_PROVIDER_NOT_CONFIGURED');

      const expectedSignature = crypto.createHmac('sha256', razorpayConfig.keySecret).update(`${stored.gateway_order_id}|${razorpayPaymentId}`).digest('hex');
      const supplied = Buffer.from(razorpaySignature, 'utf8');
      const expected = Buffer.from(expectedSignature, 'utf8');
      if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw new AppError(400, 'Payment signature verification failed', 'PAYMENT_SIGNATURE_INVALID');

      const trustedPayment = await razorpay.payments.fetch(razorpayPaymentId);
      return finalizeCapturedPayment(stored, trustedPayment);
    },
    async markPaymentFailed(studentId, { razorpayOrderId, reason }) {
      const row = (await db.query(`UPDATE payments SET status='failed',failure_reason=$1,updated_at=NOW() WHERE student_id=$2 AND gateway_order_id=$3 AND status='created' RETURNING *`, [reason || 'Payment was not completed', studentId, razorpayOrderId])).rows[0];
      return row ? payment(row) : null;
    },
    async processPaymentWebhook(signature, rawBody) {
      if (env.nodeEnv === 'production') throw new AppError(503, 'Payment webhooks are disabled in production until the business model receives approval', 'REAL_MONEY_DISABLED');
      if (!paymentProviderConfigured || !razorpayConfig.webhookSecret) throw new AppError(503, 'Razorpay webhook handling is not configured', 'PAYMENT_WEBHOOK_NOT_CONFIGURED');
      if (!signature || !Buffer.isBuffer(rawBody)) throw new AppError(400, 'Invalid Razorpay webhook request', 'PAYMENT_WEBHOOK_INVALID');
      const expectedSignature = crypto.createHmac('sha256', razorpayConfig.webhookSecret).update(rawBody).digest('hex');
      const supplied = Buffer.from(signature, 'utf8');
      const expected = Buffer.from(expectedSignature, 'utf8');
      if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw new AppError(400, 'Webhook signature verification failed', 'PAYMENT_WEBHOOK_SIGNATURE_INVALID');
      let event;
      try { event = JSON.parse(rawBody.toString('utf8')); }
      catch { throw new AppError(400, 'Webhook body must be valid JSON', 'PAYMENT_WEBHOOK_INVALID'); }
      if (!['payment.captured', 'payment.failed'].includes(event.event)) return { received: true, ignored: true };
      const entity = event.payload?.payment?.entity;
      if (!entity?.order_id) return { received: true, ignored: true };
      const stored = (await db.query('SELECT * FROM payments WHERE gateway_order_id=$1', [entity.order_id])).rows[0];
      if (!stored) return { received: true, ignored: true };
      if (event.event === 'payment.failed') {
        await db.query(`UPDATE payments SET status='failed',failure_reason=$1,updated_at=NOW() WHERE id=$2 AND status='created'`, [entity.error_description || 'Razorpay reported a failed payment', stored.id]);
        return { received: true, status: 'failed' };
      }
      if (stored.status !== 'captured') await finalizeCapturedPayment(stored, await razorpay.payments.fetch(entity.id));
      return { received: true, status: 'captured' };
    },
    async startAttempt(studentId, examId, acceptedInstructions = false, retake = false) {
      const exam = await getExam(examId);
      if (!exam) throw new AppError(404, 'Exam unavailable', 'EXAM_NOT_FOUND');
      if (exam.schedule?.eligibleStudentIds?.length && !exam.schedule.eligibleStudentIds.includes(studentId)) throw new AppError(403, 'You are not eligible for this examination', 'EXAM_NOT_ELIGIBLE');
      if (!acceptedInstructions) throw new AppError(400, 'Accept the examination instructions before starting', 'INSTRUCTIONS_REQUIRED');
      if (exam.status !== 'published' && !exams.some((item) => item.id === examId)) throw new AppError(409, 'This examination is not published', 'EXAM_NOT_PUBLISHED');
      if (exam.startsAt && Date.now() < new Date(exam.startsAt).getTime()) throw new AppError(409, 'This examination has not started yet', 'EXAM_NOT_STARTED');
      if (exam.endsAt && Date.now() > new Date(exam.endsAt).getTime()) throw new AppError(409, 'This examination has ended', 'EXAM_ENDED');
      
      let registered = await db.query(`SELECT 1 FROM registrations WHERE student_id=$1 AND exam_id=$2 AND status='confirmed'`, [studentId, examId]);
      if (!registered.rowCount) {
        const enrolled = await db.query(
          `SELECT 1 FROM course_enrollments e
           JOIN courses c ON c.id = e.course_id
           WHERE e.student_id = $1 AND e.status = 'active'
           AND (
             e.course_id = $2
             OR c.exam_type = $3
             OR ($4 LIKE 'jee-%' AND (c.exam_type ILIKE '%jee%' OR c.slug ILIKE '%jee%'))
             OR ($4 LIKE 'neet-%' AND (c.exam_type ILIKE '%neet%' OR c.slug ILIKE '%neet%'))
             OR ($4 LIKE 'mht-%' AND (c.exam_type ILIKE '%mht%' OR c.slug ILIKE '%mht%'))
           )`,
          [studentId, exam.courseId || null, exam.type || null, examId]
        );
        const isFree = !exam.fee || Number(exam.fee) === 0;
        const isPracticeMock = exam.id.startsWith('jee-') || exam.id.startsWith('neet-') || exam.id.startsWith('mht-') || exam.id.startsWith('exam-');

        if (enrolled.rowCount > 0 || isFree || isPracticeMock) {
          await db.query(
            `INSERT INTO registrations (id, student_id, exam_id, status)
             VALUES ($1, $2, $3, 'confirmed')
             ON CONFLICT (student_id, exam_id) DO UPDATE SET status = 'confirmed'`,
            [uid('reg'), studentId, examId]
          );
        } else {
          throw new AppError(403, 'Register before starting', 'REGISTRATION_REQUIRED');
        }
      }

      const existing = await db.query('SELECT * FROM attempts WHERE student_id=$1 AND exam_id=$2', [studentId, examId]);
      const isExpired = existing.rows[0]?.deadline_at && (new Date(existing.rows[0].deadline_at).getTime() < Date.now());

      if (existing.rows[0]?.status === 'TERMINATED') {
        if (retake) {
          throw new AppError(403, 'This examination attempt has been permanently terminated due to proctoring violations and cannot be restarted or resumed.', 'ATTEMPT_TERMINATED');
        }
        return attempt(existing.rows[0]);
      }

      if (existing.rows[0]?.status === 'submitted') {
        if (retake) {
          const snapshot = await approvedQuestions(exam);
          const durationSeconds = Math.max(60, Number(exam.duration || 12) * 60);
          const resetRow = (await db.query(
            `UPDATE attempts
             SET status='in_progress', answers='{}'::jsonb, marked='[]'::jsonb, result=NULL,
                 duration_seconds=$1::integer, started_at=NOW(), deadline_at=NOW()+make_interval(secs => $1::integer),
                 accepted_instructions_at=NOW(), segment_started_at=NOW(), submitted_at=NULL, time_taken=NULL,
                 last_saved_at=NULL, question_snapshot=$2, warning_count=0, is_flagged=FALSE, flag_reason=NULL,
                 proctoring_status='unmonitored', termination_reason=NULL, terminated_at=NULL, violation_history='[]'::jsonb
             WHERE id=$3 RETURNING *`,
            [durationSeconds, JSON.stringify(snapshot), existing.rows[0].id]
          )).rows[0];
          return attempt(resetRow);
        }
        throw new AppError(409, 'Attempt already submitted', 'ATTEMPT_SUBMITTED');
      }

      if (existing.rows[0]) {
        if (retake || isExpired) {
          const snapshot = await approvedQuestions(exam);
          const durationSeconds = Math.max(60, Number(exam.duration || 12) * 60);
          const resetRow = (await db.query(
            `UPDATE attempts
             SET status='in_progress', answers='{}'::jsonb, marked='[]'::jsonb, result=NULL,
                 duration_seconds=$1::integer, started_at=NOW(), deadline_at=NOW()+make_interval(secs => $1::integer),
                 accepted_instructions_at=NOW(), segment_started_at=NOW(), submitted_at=NULL, time_taken=NULL,
                 last_saved_at=NULL, question_snapshot=$2, warning_count=0, is_flagged=FALSE, flag_reason=NULL,
                 proctoring_status='unmonitored', termination_reason=NULL, terminated_at=NULL, violation_history='[]'::jsonb
             WHERE id=$3 RETURNING *`,
            [durationSeconds, JSON.stringify(snapshot), existing.rows[0].id]
          )).rows[0];
          return attempt(resetRow);
        }
        return attempt(existing.rows[0]);
      }
      const snapshot = await approvedQuestions(exam);
      const durationSeconds = Math.max(60, Number(exam.duration || 12) * 60);
      const row = (await db.query(
        `INSERT INTO attempts (id,student_id,exam_id,status,duration_seconds,deadline_at,accepted_instructions_at,segment_started_at,question_snapshot,warning_count,is_flagged,violation_history) VALUES ($1,$2,$3,'in_progress',$4::integer,NOW()+make_interval(secs => $4::integer),NOW(),NOW(),$5,0,FALSE,'[]'::jsonb) RETURNING *`,
        [uid('attempt'), studentId, examId, durationSeconds, JSON.stringify(snapshot)],
      )).rows[0];
      return attempt(row);
    },
    async saveAttempt(studentId, { attemptId, answers, marked }) {
      const checkTerminated = await db.query(`SELECT status FROM attempts WHERE id=$1 AND student_id=$2`, [attemptId, studentId]);
      if (checkTerminated.rows[0]?.status === 'TERMINATED') {
        throw new AppError(409, 'This examination attempt has been terminated. No further answers can be saved.', 'ATTEMPT_TERMINATED');
      }
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
    async submitAttempt(studentId, { attemptId, answers, isTermination = false, terminationReason = 'MAX_VIOLATIONS_REACHED' }) {
      return db.transaction(async (client) => {
        const current = await client.query(`SELECT * FROM attempts WHERE id=$1 AND student_id=$2 FOR UPDATE`, [attemptId, studentId]);
        if (!current.rowCount) throw new AppError(404, 'Attempt not found', 'ATTEMPT_NOT_FOUND');
        const row = current.rows[0];

        // Idempotency: if already terminated or submitted, return existing record safely
        if (row.status === 'TERMINATED' || row.status === 'submitted') {
          return attempt(row);
        }

        const exam = await getExam(row.exam_id, client);
        const merged = { ...(row.answers || {}), ...(answers || {}) };
        const snapshot = row.question_snapshot || await approvedQuestions(exam, client);
        const validIds = new Set(snapshot.map((item) => String(item.id)));
        const safeAnswers = Object.fromEntries(Object.entries(merged).filter(([id]) => validIds.has(id)));
        const result = evaluate(snapshot, safeAnswers, exam.configuration || { rules: { single_correct: { correct: 4, incorrect: -1, unanswered: 0 } } });
        const elapsed = Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000);
        const timeTaken = Math.min(row.duration_seconds, Math.max(0, elapsed));

        if (isTermination) {
          const { rows: allWarnings } = await client.query(`
            SELECT id, warning_number, category, message, evidence_metadata, created_at
            FROM proctoring_warnings
            WHERE attempt_id = $1
            ORDER BY warning_number ASC, created_at ASC
          `, [attemptId]);
          const violationHistory = allWarnings.map((w, i) => ({
            warningNumber: w.warning_number || (i + 1),
            category: w.category,
            description: w.message,
            timestamp: iso(w.created_at),
            metadata: w.evidence_metadata || {}
          }));

          const updated = (await client.query(
            `UPDATE attempts
             SET answers=$1, status='TERMINATED', termination_reason=$2, terminated_at=NOW(), submitted_at=NOW(),
                 time_taken=$3, result=$4, warning_count=GREATEST(warning_count, 3), is_flagged=TRUE,
                 flag_reason='Proctoring violation: 3/3 warnings reached (MAX_VIOLATIONS_REACHED)',
                 violation_history=$5
             WHERE id=$6 RETURNING *`,
            [safeAnswers, terminationReason || 'MAX_VIOLATIONS_REACHED', timeTaken, result, JSON.stringify(violationHistory), attemptId]
          )).rows[0];
          await log(studentId, 'EXAM_TERMINATED', `Terminated attempt ${attemptId}`, client);
          return attempt(updated);
        }

        const updated = (await client.query(
          `UPDATE attempts SET answers=$1,status='submitted',submitted_at=NOW(),time_taken=$2,result=$3 WHERE id=$4 RETURNING *`,
          [safeAnswers, timeTaken, result, attemptId],
        )).rows[0];
        await log(studentId, 'EXAM_SUBMIT', attemptId, client);
        return attempt(updated);
      });
    },
    async terminateAttempt(studentId, { attemptId, reason = 'MAX_VIOLATIONS_REACHED', answers = {} }) {
      return this.submitAttempt(studentId, { attemptId, answers, isTermination: true, terminationReason: reason });
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
      const prizeRows = await db.query('SELECT 1 FROM demo_prize_distributions WHERE exam_id=$1 LIMIT 1', [id]);
      const attempts = await db.query('SELECT 1 FROM attempts WHERE exam_id=$1 LIMIT 1', [id]);
      const normalizePrize = (value = {}) => ({ enabled: Boolean(value.enabled), method: value.method || 'fixed', first: Number(value.first || 0), second: Number(value.second || 0), third: Number(value.third || 0) });
      if ((prizeRows.rowCount || attempts.rowCount) && JSON.stringify(normalizePrize(exam.prizeConfig)) !== JSON.stringify(normalizePrize(input.prizeConfig))) throw new AppError(409, 'Prize rules are locked after an attempt or distribution exists', 'PRIZE_CONFIGURATION_LOCKED');
      await db.query(`INSERT INTO exam_overrides (exam_id,status,title,exam_type,subject,exam_date,duration_minutes,fee,discount_percent,image_url,description,tag,registration_open,schedule,prize_config,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
        ON CONFLICT (exam_id) DO UPDATE SET status=EXCLUDED.status,title=EXCLUDED.title,exam_type=EXCLUDED.exam_type,subject=EXCLUDED.subject,exam_date=EXCLUDED.exam_date,duration_minutes=EXCLUDED.duration_minutes,fee=EXCLUDED.fee,discount_percent=EXCLUDED.discount_percent,image_url=EXCLUDED.image_url,description=EXCLUDED.description,tag=EXCLUDED.tag,registration_open=EXCLUDED.registration_open,schedule=EXCLUDED.schedule,prize_config=EXCLUDED.prize_config,updated_at=NOW()`,
      [id, input.status, input.title, input.type, input.subject, input.date, input.duration, input.fee, input.discountPercent, input.imageUrl || null, input.description || '', input.tag || '', input.registrationOpen, JSON.stringify(input.schedule || {}), JSON.stringify(input.prizeConfig || {})]);
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
    async listDemoPrizeDistributions() {
      const { rows } = await db.query(`SELECT d.*,u.name student_name,u.email student_email FROM demo_prize_distributions d JOIN users u ON u.id=d.student_id ORDER BY d.created_at DESC`);
      return rows.map((row) => ({ id: row.id, examId: row.exam_id, studentId: row.student_id, studentName: row.student_name, studentEmail: row.student_email, rank: row.rank, amount: Number(row.amount), status: row.status, createdAt: iso(row.created_at), approvedAt: iso(row.approved_at) }));
    },
    async demoPrizeRankings(examId) {
      const exam = await getExam(examId);
      if (!exam || !exam.prizeConfig?.enabled) throw new AppError(409, 'This examination has no enabled demo prize plan', 'PRIZE_PLAN_DISABLED');
      const { rows } = await db.query(`WITH scored AS (SELECT a.student_id,u.name,u.email,(a.result->>'score')::numeric AS score,(a.result->>'accuracy')::numeric AS accuracy,a.submitted_at,DENSE_RANK() OVER (ORDER BY (a.result->>'score')::numeric DESC,(a.result->>'accuracy')::numeric DESC,a.submitted_at ASC) AS rank FROM attempts a JOIN users u ON u.id=a.student_id JOIN registrations r ON r.student_id=a.student_id AND r.exam_id=a.exam_id AND r.status='confirmed' WHERE a.exam_id=$1 AND a.status='submitted' AND (cardinality($2::text[])=0 OR a.student_id=ANY($2::text[]))) SELECT * FROM scored WHERE rank BETWEEN 1 AND 3 ORDER BY rank,submitted_at,student_id`, [examId, exam.schedule?.eligibleStudentIds || []]);
      return rows.map((row) => ({ studentId: row.student_id, name: row.name, email: row.email, rank: Number(row.rank), score: Number(row.score), accuracy: Number(row.accuracy), submittedAt: iso(row.submitted_at) }));
    },
    async createDemoPrizeDistribution(actorId, { examId, studentId, rank }) {
      const exam = await getExam(examId);
      if (!exam || !exam.prizeConfig?.enabled) throw new AppError(409, 'This examination has no enabled demo prize plan', 'PRIZE_PLAN_DISABLED');
      const rankings = await this.demoPrizeRankings(examId);
      if (!rankings.some((candidate) => candidate.studentId === studentId && candidate.rank === rank)) throw new AppError(409, 'Only a ranked, submitted candidate can receive a demo prize', 'PRIZE_WINNER_NOT_RANKED');
      if (exam.schedule?.eligibleStudentIds?.length && !exam.schedule.eligibleStudentIds.includes(studentId)) throw new AppError(403, 'This student is not eligible for the examination', 'EXAM_NOT_ELIGIBLE');
      const student = await db.query(`SELECT id FROM users WHERE id=$1 AND role='student'`, [studentId]);
      if (!student.rowCount) throw new AppError(404, 'Student not found', 'STUDENT_NOT_FOUND');
      const count = await db.query(`SELECT COUNT(*)::int AS count FROM registrations WHERE exam_id=$1 AND status='confirmed'`, [examId]);
      const plan = exam.prizeConfig;
      const configured = Number(plan[['','first','second','third'][rank]] || 0);
      const pool = Number(exam.fee || 0) * count.rows[0].count;
      const amount = Number((plan.method === 'percentage' ? pool * configured / 100 : plan.method === 'multiplier' ? pool * configured : configured).toFixed(2));
      if (amount <= 0) throw new AppError(409, 'This rank has no configured demo prize', 'PRIZE_AMOUNT_ZERO');
      let row;
      try { row = (await db.query(`INSERT INTO demo_prize_distributions(id,exam_id,student_id,rank,amount,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [uid('demo-prize'), examId, studentId, rank, amount, actorId])).rows[0]; }
      catch (error) { if (error.code === '23505') throw new AppError(409, 'A prize has already been queued for this student and rank', 'DUPLICATE_PRIZE'); throw error; }
      await log(actorId, 'DEMO_PRIZE_PENDING', `${examId}:${rank}:${studentId}:${amount}`);
      return { id: row.id, examId, studentId, rank, amount, status: row.status };
    },
    async approveDemoPrizeDistribution(actorId, id) {
      return db.transaction(async (client) => {
        const row = (await client.query(`SELECT * FROM demo_prize_distributions WHERE id=$1 FOR UPDATE`, [id])).rows[0];
        if (!row) throw new AppError(404, 'Prize distribution not found', 'PRIZE_NOT_FOUND');
        if (row.status === 'approved') throw new AppError(409, 'Prize distribution is already approved', 'PRIZE_ALREADY_APPROVED');
        if (row.created_by === actorId) throw new AppError(403, 'A different administrator must approve this distribution', 'SEPARATION_OF_DUTIES');
        await client.query(`INSERT INTO demo_wallet_ledger(id,transaction_key,user_id,exam_id,kind,amount,status,memo,created_by) VALUES($1,$2,$3,$4,'demo_prize',$5,'credited',$6,$7) ON CONFLICT(transaction_key) DO NOTHING`, [uid('ledger'), `demo-prize:${row.id}`, row.student_id, row.exam_id, row.amount, `Rank ${row.rank} demo prize`, actorId]);
        const approved = (await client.query(`UPDATE demo_prize_distributions SET status='approved',approved_by=$1,approved_at=NOW() WHERE id=$2 RETURNING *`, [actorId,id])).rows[0];
        await log(actorId, 'DEMO_PRIZE_APPROVED', `${row.exam_id}:${row.rank}:${row.student_id}:${row.amount}`, client);
        return { id: approved.id, status: approved.status };
      });
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
    async getMasterWalletOverview() {
      const [
        metrics,
        settingsRow,
        ledgerRows,
        payoutsRows
      ] = await Promise.all([
        this.getAdminFinanceOverview(),
        db.query(`SELECT value FROM platform_settings WHERE key = 'business_bank_account'`),
        db.query(`
          SELECT l.*, u.name AS user_name, u.role AS user_role, c.name AS course_name
          FROM platform_master_ledger l
          LEFT JOIN users u ON u.id = l.user_id
          LEFT JOIN courses c ON c.id = l.course_id
          ORDER BY l.created_at DESC
          LIMIT 100
        `),
        db.query(`
          SELECT p.*, u.name AS requester_name, u.email AS requester_email
          FROM platform_payout_requests p
          JOIN users u ON u.id = p.requested_by
          ORDER BY p.created_at DESC
          LIMIT 50
        `)
      ]);

      const beneficiaryAccount = settingsRow.rows[0]?.value || {
        accountHolderName: 'MERITX ACADEMIC TECHNOLOGIES PVT LTD',
        bankName: 'HDFC Bank Ltd',
        accountNumberMasked: '••••••••6721',
        ifscCode: 'HDFC0000240',
        accountType: 'Current Account'
      };

      const transactions = ledgerRows.rows.map(r => ({
        id: r.id,
        transactionKey: r.transaction_key,
        category: r.category,
        type: r.type,
        direction: r.direction,
        amount: Number(r.amount),
        balanceAfter: Number(r.balance_after),
        userId: r.user_id,
        userName: r.user_name || 'System Treasury',
        userRole: r.user_role || 'platform',
        examId: r.exam_id,
        courseId: r.course_id,
        courseName: r.course_name,
        referenceId: r.reference_id,
        description: r.description,
        metadata: r.metadata,
        date: iso(r.created_at)
      }));

      const payouts = payoutsRows.rows.map(p => ({
        id: p.id,
        amount: Number(p.amount),
        feeDeduction: Number(p.fee_deduction),
        netAmount: Number(p.net_amount),
        bankName: p.bank_name,
        accountHolderName: p.account_holder_name,
        accountNumberMasked: p.account_number_masked,
        ifscCode: p.ifsc_code,
        purpose: p.withdrawal_purpose,
        status: p.status,
        utrNumber: p.utr_number,
        adminNotes: p.admin_notes,
        failureReason: p.failure_reason,
        requesterName: p.requester_name,
        requesterEmail: p.requester_email,
        createdAt: iso(p.created_at),
        processedAt: iso(p.processed_at)
      }));

      return {
        masterWalletName: 'MERITX PLATFORM MASTER WALLET',
        currency: 'INR',
        availablePlatformBalance: metrics.availablePlatformBalance,
        withdrawablePlatformBalance: metrics.withdrawablePlatformBalance,
        totalExamPayments: 0,
        totalCourseSales: metrics.totalCourseRevenue,
        totalStudentDeposits: metrics.totalSuccessfulDeposits,
        totalStudentCredits: metrics.totalSuccessfulDeposits,
        totalTeacherCredits: metrics.totalTeacherWalletBalance,
        studentWalletLiabilities: metrics.totalStudentWalletBalance,
        teacherWalletLiabilities: metrics.totalTeacherWalletBalance,
        totalRefundsPaid: metrics.totalRefunds,
        totalRewardLiabilities: metrics.totalRewardsReserved,
        totalPlatformRevenue: Number((metrics.totalCourseRevenue * 0.4).toFixed(2)),
        gatewayCharges: Number((metrics.totalSuccessfulDeposits * 0.02).toFixed(2)),
        pendingSettlements: Number((metrics.pendingPaymentAmount + metrics.pendingWithdrawalAmount).toFixed(2)),
        completedSettlements: metrics.totalSettledAmount,
        beneficiaryAccount,
        transactions,
        payouts
      };
    },
    async listPlatformTransactions({ search = '', category = 'all', type = 'all', limit = 100, offset = 0 } = {}) {
      let query = `
        SELECT l.*, u.name AS user_name, u.role AS user_role, c.name AS course_name
        FROM platform_master_ledger l
        LEFT JOIN users u ON u.id = l.user_id
        LEFT JOIN courses c ON c.id = l.course_id
        WHERE 1=1
      `;
      const params = [];
      if (category && category !== 'all') {
        params.push(category);
        query += ` AND l.category = $${params.length}`;
      }
      if (type && type !== 'all') {
        params.push(type);
        query += ` AND l.type = $${params.length}`;
      }
      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        query += ` AND (LOWER(l.description) LIKE $${params.length} OR LOWER(l.reference_id) LIKE $${params.length} OR LOWER(l.id) LIKE $${params.length} OR LOWER(u.name) LIKE $${params.length})`;
      }
      query += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(Number(limit) || 100, Number(offset) || 0);

      const { rows } = await db.query(query, params);
      return {
        transactions: rows.map(r => ({
          id: r.id,
          transactionKey: r.transaction_key,
          category: r.category,
          type: r.type,
          direction: r.direction,
          amount: Number(r.amount),
          balanceAfter: Number(r.balance_after),
          userId: r.user_id,
          userName: r.user_name || 'System Treasury',
          userRole: r.user_role || 'platform',
          examId: r.exam_id,
          courseId: r.course_id,
          courseName: r.course_name,
          referenceId: r.reference_id,
          description: r.description,
          metadata: r.metadata,
          date: iso(r.created_at)
        }))
      };
    },
    async exportMasterWalletCsv(filters = {}) {
      const data = await this.getMasterWalletOverview();
      const headers = ['Transaction ID', 'Key', 'Date & Time', 'User / Actor', 'Category', 'Type', 'Direction', 'Amount (INR)', 'Balance After (INR)', 'Reference', 'Description'];
      const rows = [headers.join(',')];
      for (const tx of data.transactions) {
        rows.push([
          tx.id,
          tx.transactionKey,
          `"${tx.date}"`,
          `"${tx.userName} (${tx.userRole})"`,
          tx.category,
          tx.type,
          tx.direction,
          tx.amount.toFixed(2),
          tx.balanceAfter.toFixed(2),
          `"${tx.referenceId || ''}"`,
          `"${(tx.description || '').replace(/"/g, '""')}"`
        ].join(','));
      }
      return rows.join('\n');
    },
    async requestAdminMasterWithdrawal(actorId, { amount, purpose = 'Platform Revenue Withdrawal', password, idempotencyKey }) {
      return db.transaction(async (client) => {
        const { rows: actorRows } = await client.query('SELECT * FROM users WHERE id=$1', [actorId]);
        const actor = actorRows[0];
        if (!actor) throw new AppError(404, 'Administrator not found', 'USER_NOT_FOUND');
        if (actor.role !== 'superadmin' && actor.role !== 'admin') {
          throw new AppError(403, 'Only Super Admin or Finance role can execute platform withdrawals', 'FORBIDDEN');
        }

        const validPassword = await bcrypt.compare(password, actor.password_hash);
        if (!validPassword) {
          throw new AppError(401, 'Invalid administrator password for withdrawal confirmation', 'INVALID_CREDENTIALS');
        }

        await client.query("SELECT pg_advisory_xact_lock(99283741)");

        const key = idempotencyKey || `payout-${actorId}-${Date.now()}`;
        const existingPayout = await client.query('SELECT * FROM platform_payout_requests WHERE idempotency_key=$1', [key]);
        if (existingPayout.rows[0]) {
          return { payout: existingPayout.rows[0], message: 'Existing payout returned (idempotency key)' };
        }

        const treasuryQuery = await client.query(`
          SELECT
            COALESCE(SUM(amount) FILTER (WHERE direction='credit' AND category='treasury'), 0)::numeric AS credits,
            COALESCE(SUM(amount) FILTER (WHERE direction='debit' AND category='treasury'), 0)::numeric AS debits
          FROM platform_master_ledger
        `);
        const credits = Number(treasuryQuery.rows[0].credits);
        const debits = Number(treasuryQuery.rows[0].debits);
        const availableTreasury = Number(Math.max(0, credits - debits).toFixed(2));

        const pendingQuery = await client.query(`
          SELECT COALESCE(SUM(amount), 0)::numeric AS total
          FROM platform_payout_requests
          WHERE status IN ('requested', 'awaiting_approval', 'processing')
        `);
        const pendingAmount = Number(pendingQuery.rows[0].total);

        const rewardsQuery = await client.query(`
          SELECT COALESCE(SUM(amount), 0)::numeric AS total
          FROM platform_master_ledger
          WHERE category='reward_liability' AND direction='credit'
        `);
        const rewardsReserved = Number(rewardsQuery.rows[0].total);

        const withdrawableAmount = Number(Math.max(0, availableTreasury - pendingAmount - rewardsReserved).toFixed(2));

        const withdrawNum = Number(amount);
        if (withdrawNum <= 0) {
          throw new AppError(400, 'Withdrawal amount must be greater than zero', 'INVALID_AMOUNT');
        }
        if (withdrawNum > withdrawableAmount) {
          throw new AppError(400, `Withdrawal amount (₹${withdrawNum.toLocaleString('en-IN')}) exceeds available platform balance (₹${withdrawableAmount.toLocaleString('en-IN')})`, 'INSUFFICIENT_PLATFORM_FUNDS');
        }

        const settingsRow = await client.query(`SELECT value FROM platform_settings WHERE key = 'business_bank_account'`);
        const beneficiary = settingsRow.rows[0]?.value || {
          accountHolderName: 'MERITX ACADEMIC TECHNOLOGIES PVT LTD',
          bankName: 'HDFC Bank Ltd',
          accountNumberMasked: '••••••••6721',
          ifscCode: 'HDFC0000240'
        };

        const payoutId = uid('payout');
        const fee = 5.00;
        const netAmount = Number(Math.max(0, withdrawNum - fee).toFixed(2));
        const utrNumber = `CMS-UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;

        const insertPayout = await client.query(`
          INSERT INTO platform_payout_requests (
            id, requested_by, amount, fee_deduction, net_amount,
            bank_name, account_holder_name, account_number_masked, ifsc_code,
            withdrawal_purpose, status, idempotency_key, gateway_payout_id, utr_number,
            approved_by, approved_at, processed_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed', $11, $12, $13, $2, NOW(), NOW()
          ) RETURNING *
        `, [
          payoutId, actorId, withdrawNum, fee, netAmount,
          beneficiary.bankName, beneficiary.accountHolderName, beneficiary.accountNumberMasked, beneficiary.ifscCode,
          purpose, key, `rzp_pout_${payoutId}`, utrNumber
        ]);

        const newBalance = Number((availableTreasury - withdrawNum).toFixed(2));
        await client.query(`
          INSERT INTO platform_master_ledger (
            id, transaction_key, category, type, direction, amount, balance_after,
            reference_id, description, metadata
          ) VALUES (
            $1, $2, 'treasury', 'admin_payout_disbursed', 'debit', $3, $4,
            $5, $6, $7
          )
        `, [
          uid('pml'), `payout:${payoutId}`, withdrawNum, newBalance,
          utrNumber, `Admin Bank Withdrawal to ${beneficiary.bankName} (${beneficiary.accountNumberMasked}) - ${purpose}`,
          JSON.stringify({ payoutId, feeDeduction: fee, netAmount, actorId, beneficiary })
        ]);

        await log(actorId, 'ADMIN_MASTER_WITHDRAWAL', `${payoutId}: ₹${withdrawNum} to ${beneficiary.bankName}`, client);

        return {
          payout: insertPayout.rows[0],
          newBalance,
          utrNumber,
          beneficiary
        };
      });
    },
    async listPlatformPayouts({ status = 'all' } = {}) {
      let query = `
        SELECT p.*, u.name AS requester_name, u.email AS requester_email
        FROM platform_payout_requests p
        JOIN users u ON u.id = p.requested_by
      `;
      const params = [];
      if (status && status !== 'all') {
        params.push(status);
        query += ` WHERE p.status = $${params.length}`;
      }
      query += ` ORDER BY p.created_at DESC`;
      const { rows } = await db.query(query, params);
      return rows.map(r => ({
        id: r.id,
        amount: Number(r.amount),
        feeDeduction: Number(r.fee_deduction),
        netAmount: Number(r.net_amount),
        bankName: r.bank_name,
        accountHolderName: r.account_holder_name,
        accountNumberMasked: r.account_number_masked,
        ifscCode: r.ifsc_code,
        purpose: r.withdrawal_purpose,
        status: r.status,
        utrNumber: r.utr_number,
        adminNotes: r.admin_notes,
        failureReason: r.failure_reason,
        requesterName: r.requester_name,
        requesterEmail: r.requester_email,
        createdAt: iso(r.created_at),
        processedAt: iso(r.processed_at)
      }));
    },
    async reviewPlatformPayout(actorId, { id, action, notes, rejectionReason, utrNumber }) {
      return db.transaction(async (client) => {
        const { rows: reqRows } = await client.query('SELECT * FROM platform_payout_requests WHERE id=$1 FOR UPDATE', [id]);
        const req = reqRows[0];
        if (!req) throw new AppError(404, 'Platform payout request not found', 'NOT_FOUND');
        if (req.status === 'completed' || req.status === 'rejected') {
          throw new AppError(409, `Payout request is already ${req.status}`, 'ALREADY_PROCESSED');
        }

        if (action === 'approve' || action === 'complete') {
          const finalUtr = utrNumber || req.utr_number || `CMS-UTR-${Date.now()}`;
          const updated = (await client.query(`
            UPDATE platform_payout_requests
            SET status = 'completed', utr_number = $1, admin_notes = $2, approved_by = $3, approved_at = NOW(), processed_at = NOW(), updated_at = NOW()
            WHERE id = $4 RETURNING *
          `, [finalUtr, notes || 'Approved & processed', actorId, id])).rows[0];
          await log(actorId, 'PLATFORM_PAYOUT_COMPLETED', `${id}: ₹${req.amount} - ${finalUtr}`, client);
          return updated;
        } else {
          // Reverse the debit in platform master ledger if previously debited
          const { rows: treasuryRows } = await client.query(`
            SELECT
              COALESCE(SUM(amount) FILTER (WHERE direction='credit' AND category='treasury'), 0)::numeric AS credits,
              COALESCE(SUM(amount) FILTER (WHERE direction='debit' AND category='treasury'), 0)::numeric AS debits
            FROM platform_master_ledger
          `);
          const currentTreasury = Number(Math.max(0, Number(treasuryRows[0].credits) - Number(treasuryRows[0].debits)).toFixed(2));
          const restoredBalance = Number((currentTreasury + Number(req.amount)).toFixed(2));

          await client.query(`
            INSERT INTO platform_master_ledger (
              id, transaction_key, category, type, direction, amount, balance_after,
              reference_id, description, metadata
            ) VALUES (
              $1, $2, 'treasury', 'adjustment', 'credit', $3, $4,
              $5, $6, $7
            )
          `, [
            uid('pml'), `reversal:${req.id}`, Number(req.amount), restoredBalance,
            `REV-${req.id}`, `Reversal of rejected platform payout #${req.id} - ${rejectionReason || 'Declined'}`,
            JSON.stringify({ payoutId: req.id, rejectedBy: actorId, rejectionReason })
          ]);

          const updated = (await client.query(`
            UPDATE platform_payout_requests
            SET status = 'rejected', rejection_reason = $1, admin_notes = $2, updated_at = NOW()
            WHERE id = $3 RETURNING *
          `, [rejectionReason || 'Declined by Administrator', notes || null, id])).rows[0];
          await log(actorId, 'PLATFORM_PAYOUT_REJECTED', `${id}: ₹${req.amount}`, client);
          return updated;
        }
      });
    },
    async listTeacherWallets({ search = '' } = {}) {
      let query = `
        SELECT
          u.id AS teacher_id, u.name AS teacher_name, u.email,
          tp.designation, tp.department, tp.specialization, tp.experience_years, tp.phone,
          COALESCE(w.id, 'none') AS wallet_id,
          COALESCE(w.balance, 0)::numeric AS balance,
          COALESCE(w.locked_balance, 0)::numeric AS locked_balance,
          COALESCE(w.status, 'active') AS wallet_status,
          COALESCE((SELECT SUM(t.amount) FROM wallet_transactions t WHERE t.user_id = u.id AND t.type = 'deposit' AND t.status = 'successful'), 0)::numeric AS total_credits,
          COALESCE((SELECT SUM(t.amount) FROM wallet_transactions t WHERE t.user_id = u.id AND t.type = 'withdrawal' AND t.status = 'successful'), 0)::numeric AS total_payouts,
          COALESCE((SELECT COUNT(*)::int FROM courses c WHERE c.teacher_id = u.id AND c.status = 'published'), 0)::int AS assigned_courses,
          COALESCE((SELECT COUNT(e.id)::int FROM course_enrollments e JOIN courses c ON c.id = e.course_id WHERE c.teacher_id = u.id AND e.status = 'active'), 0)::int AS total_students
        FROM users u
        LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
        LEFT JOIN wallets w ON w.user_id = u.id
        WHERE u.role = 'teacher'
      `;
      const params = [];
      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        query += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(COALESCE(tp.department, '')) LIKE $${params.length})`;
      }
      query += ` ORDER BY u.created_at DESC`;
      const { rows } = await db.query(query, params);
      return rows.map(r => ({
        teacherId: r.teacher_id,
        teacherName: r.teacher_name,
        email: r.email,
        designation: r.designation || 'Faculty Member',
        department: r.department || 'Academic Department',
        specialization: r.specialization || 'Competitive Examination Faculty',
        experienceYears: r.experience_years || 0,
        phone: r.phone || '',
        balance: Number(r.balance),
        lockedBalance: Number(r.locked_balance),
        availableBalance: Number((Number(r.balance) - Number(r.locked_balance)).toFixed(2)),
        totalCredits: Number(r.total_credits),
        totalPayouts: Number(r.total_payouts),
        assignedCourses: r.assigned_courses,
        totalStudents: r.total_students,
        walletStatus: r.wallet_status
      }));
    },
    async listRefunds({ search = '', status = 'all' } = {}) {
      let query = `
        SELECT t.*, u.name AS user_name, u.email AS user_email, u.role AS user_role
        FROM wallet_transactions t
        JOIN users u ON u.id = t.user_id
        WHERE t.type IN ('refund', 'reversal')
      `;
      const params = [];
      if (status && status !== 'all') {
        params.push(status);
        query += ` AND t.status = $${params.length}`;
      }
      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        query += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(t.reference_id) LIKE $${params.length})`;
      }
      query += ` ORDER BY t.created_at DESC LIMIT 100`;
      const { rows } = await db.query(query, params);
      return rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        userEmail: r.user_email,
        userRole: r.user_role,
        amount: Number(r.amount),
        status: r.status,
        referenceId: r.reference_id,
        description: r.description,
        metadata: r.metadata,
        date: iso(r.created_at)
      }));
    },
    async listPlatformPayments({ search = '', status = 'all', limit = 100 } = {}) {
      let query = `
        SELECT p.*, u.name AS student_name, u.email AS student_email,
               COALESCE(c.name, e.title, p.target_id, 'Course / Exam') AS item_name
        FROM payment_orders p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN courses c ON c.id = p.target_id
        LEFT JOIN published_exams e ON e.id = p.target_id
        WHERE 1=1
      `;
      const params = [];
      if (status && status !== 'all') {
        params.push(status);
        query += ` AND p.status = $${params.length}`;
      }
      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        query += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(COALESCE(p.gateway_order_id, '')) LIKE $${params.length} OR LOWER(COALESCE(p.gateway_payment_id, '')) LIKE $${params.length})`;
      }
      query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1}`;
      params.push(Number(limit) || 100);
      const { rows } = await db.query(query, params);
      return {
        payments: rows.map(r => ({
          id: r.id,
          studentId: r.user_id,
          studentName: r.student_name,
          studentEmail: r.student_email,
          purpose: r.purpose,
          itemName: r.item_name,
          amount: Number(r.amount),
          currency: r.currency,
          paymentMethod: r.payment_method,
          gateway: r.gateway,
          gatewayOrderId: r.gateway_order_id,
          gatewayPaymentId: r.gateway_payment_id,
          status: r.status,
          date: iso(r.created_at),
          verifiedAt: iso(r.verified_at)
        }))
      };
    },
    async initProctoringSession(studentId, { examId, attemptId: passedAttemptId, verificationChecks, browserData }) {
      const existing = await db.query('SELECT * FROM attempts WHERE student_id=$1 AND exam_id=$2', [studentId, examId]);
      let attemptId = passedAttemptId || existing.rows[0]?.id;
      const effectiveChecks = verificationChecks || { cameraAvailable: true, permissionGranted: true, faceDetected: true, internetOk: true, browserCompatible: true, fullscreenAvailable: true, instructionsAccepted: true, consentGiven: true, browserData };
      if (!attemptId) {
        const row = (await db.query(
          `INSERT INTO attempts (id, student_id, exam_id, status, duration_seconds, deadline_at, accepted_instructions_at, segment_started_at)
           VALUES ($1, $2, $3, 'in_progress', 10800, NOW() + INTERVAL '3 hours', NOW(), NOW())
           ON CONFLICT (student_id, exam_id) DO UPDATE SET updated_at = NOW() RETURNING *`,
          [uid('attempt'), studentId, examId]
        )).rows[0];
        attemptId = row.id;
      }

      const sessionId = uid('proctor');
      const { rows } = await db.query(`
        INSERT INTO proctoring_sessions (
          id, attempt_id, exam_id, student_id, camera_status, verification_checks, consent_given_at, last_heartbeat_at
        ) VALUES (
          $1, $2, $3, $4, 'active', $5, NOW(), NOW()
        )
        ON CONFLICT (attempt_id) DO UPDATE SET
          camera_status = 'active',
          verification_checks = EXCLUDED.verification_checks,
          consent_given_at = NOW(),
          last_heartbeat_at = NOW(),
          updated_at = NOW()
        RETURNING *
      `, [sessionId, attemptId, examId, studentId, JSON.stringify(effectiveChecks)]);

      await db.query(`
        INSERT INTO proctoring_events (id, session_id, attempt_id, student_id, exam_id, event_type, severity, details)
        VALUES ($1, $2, $3, $4, $5, 'verification_passed', 'info', $6)
      `, [uid('pevent'), rows[0].id, attemptId, studentId, examId, JSON.stringify({ checks: effectiveChecks })]);

      await db.query(`UPDATE attempts SET proctoring_status='verified' WHERE id=$1`, [attemptId]);

      return {
        sessionId: rows[0].id,
        attemptId,
        cameraStatus: rows[0].camera_status,
        warningCount: rows[0].warning_count,
        isFlagged: rows[0].is_flagged
      };
    },
    async recordProctoringHeartbeat(studentId, { attemptId, cameraStatus = 'active', isFullscreen = true, interruptionDurationSeconds = 0 }) {
      const { rows } = await db.query(`SELECT * FROM proctoring_sessions WHERE attempt_id=$1 AND student_id=$2`, [attemptId, studentId]);
      if (!rows[0]) {
        return { ok: true, cameraStatus, warningCount: 0, isFlagged: false };
      }
      const session = rows[0];
      const statusChanged = session.camera_status !== cameraStatus;

      if (statusChanged) {
        const eventType = cameraStatus === 'active' ? 'camera_restored' : 'camera_interrupted';
        const severity = cameraStatus === 'active' ? 'info' : 'warning';
        await db.query(`
          INSERT INTO proctoring_events (id, session_id, attempt_id, student_id, exam_id, event_type, severity, details)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [uid('pevent'), session.id, attemptId, studentId, session.exam_id, eventType, severity, JSON.stringify({ previousStatus: session.camera_status, newStatus: cameraStatus })]);
      }

      await db.query(`
        UPDATE proctoring_sessions
        SET camera_status = $1,
            last_heartbeat_at = NOW(),
            total_interruption_seconds = total_interruption_seconds + $2,
            interruption_count = interruption_count + $3,
            updated_at = NOW()
        WHERE id = $4
      `, [cameraStatus, Math.max(0, interruptionDurationSeconds), statusChanged && cameraStatus === 'interrupted' ? 1 : 0, session.id]);

      await db.query(`UPDATE attempts SET proctoring_status=$1 WHERE id=$2`, [cameraStatus, attemptId]);

      return {
        ok: true,
        cameraStatus,
        warningCount: session.warning_count,
        isFlagged: session.is_flagged
      };
    },
    async recordProctoringWarning(studentId, { attemptId, category, message, evidenceMetadata = {}, currentAnswers = null }) {
      return db.transaction(async (client) => {
        const { rows: attemptRows } = await client.query('SELECT * FROM attempts WHERE id=$1 AND student_id=$2 FOR UPDATE', [attemptId, studentId]);
        if (!attemptRows[0]) throw new AppError(404, 'Active attempt not found', 'ATTEMPT_NOT_FOUND');
        const attemptRow = attemptRows[0];

        // Idempotency: if attempt is already terminated, return terminated status immediately
        if (attemptRow.status === 'TERMINATED') {
          return {
            warningNumber: 3,
            warningCount: 3,
            isFlagged: true,
            isTerminated: true,
            status: 'TERMINATED',
            terminationReason: attemptRow.termination_reason || 'MAX_VIOLATIONS_REACHED',
            terminatedAt: iso(attemptRow.terminated_at),
            attempt: attempt(attemptRow),
            result: attemptRow.result,
            violationHistory: attemptRow.violation_history || [],
            message: 'Examination has already been terminated due to maximum violations reached'
          };
        }

        let { rows: sessionRows } = await client.query('SELECT * FROM proctoring_sessions WHERE attempt_id=$1 FOR UPDATE', [attemptId]);
        if (!sessionRows[0]) {
          const newSession = await client.query(`
            INSERT INTO proctoring_sessions (id, attempt_id, exam_id, student_id, camera_status, warning_count, is_flagged)
            VALUES ($1, $2, $3, $4, 'active', 0, FALSE) RETURNING *
          `, [uid('proctor'), attemptId, attemptRow.exam_id, studentId]);
          sessionRows = newSession.rows;
        }
        const session = sessionRows[0];

        // Cooldown check (minimum 2.5 seconds between recorded warnings to prevent duplicate browser event firing)
        const recentWarn = await client.query(`
          SELECT * FROM proctoring_warnings WHERE attempt_id=$1 ORDER BY created_at DESC LIMIT 1
        `, [attemptId]);
        if (recentWarn.rows[0]) {
          const diffMs = Date.now() - new Date(recentWarn.rows[0].created_at).getTime();
          if (diffMs < 2500) {
            return {
              warningNumber: session.warning_count,
              warningCount: session.warning_count,
              isFlagged: session.is_flagged,
              isTerminated: session.warning_count >= 3 || attemptRow.status === 'TERMINATED',
              status: attemptRow.status,
              attempt: attempt(attemptRow),
              result: attemptRow.result,
              violationHistory: attemptRow.violation_history || [],
              cooldownActive: true,
              message
            };
          }
        }

        const currentCount = Number(session.warning_count || 0);
        const newCount = Math.min(3, currentCount + 1);
        const isFlagged = newCount >= 3;
        const isTerminated = newCount >= 3;

        const warnId = uid('warn');
        await client.query(`
          INSERT INTO proctoring_warnings (
            id, attempt_id, student_id, exam_id, warning_number, category, message, evidence_metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [warnId, attemptId, studentId, attemptRow.exam_id, newCount, category, message, JSON.stringify(evidenceMetadata)]);

        await client.query(`
          INSERT INTO proctoring_events (id, session_id, attempt_id, student_id, exam_id, event_type, severity, details)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [uid('pevent'), session.id, attemptId, studentId, attemptRow.exam_id, isTerminated ? 'exam_terminated_violations' : 'warning_issued', isTerminated ? 'critical' : 'warning', JSON.stringify({ warningNumber: newCount, category, message, evidenceMetadata })]);

        await client.query(`
          UPDATE proctoring_sessions
          SET warning_count = $1, is_flagged = $2, updated_at = NOW()
          WHERE id = $3
        `, [newCount, isFlagged, session.id]);

        if (!isTerminated) {
          await client.query(`
            UPDATE attempts
            SET warning_count = $1,
                is_flagged = $2,
                flag_reason = CASE WHEN $2 = TRUE THEN $3 ELSE flag_reason END
            WHERE id = $4
          `, [newCount, isFlagged, `Proctoring violation: ${newCount}/3 warnings (${category})`, attemptId]);

          return {
            warningNumber: newCount,
            warningCount: newCount,
            isFlagged: false,
            isTerminated: false,
            message
          };
        }

        // 3RD VIOLATION REACHED: AUTOMATIC EXAM TERMINATION
        const { rows: allWarnings } = await client.query(`
          SELECT id, warning_number, category, message, evidence_metadata, created_at
          FROM proctoring_warnings
          WHERE attempt_id = $1
          ORDER BY warning_number ASC, created_at ASC
        `, [attemptId]);

        const violationHistory = allWarnings.map((w, i) => ({
          warningNumber: w.warning_number || (i + 1),
          category: w.category,
          description: w.message,
          timestamp: iso(w.created_at),
          metadata: w.evidence_metadata || {}
        }));

        const exam = await getExam(attemptRow.exam_id, client);
        const merged = { ...(attemptRow.answers || {}), ...(currentAnswers || {}) };
        const snapshot = attemptRow.question_snapshot || await approvedQuestions(exam, client);
        const validIds = new Set(snapshot.map((item) => String(item.id)));
        const safeAnswers = Object.fromEntries(Object.entries(merged).filter(([id]) => validIds.has(id)));
        const result = evaluate(snapshot, safeAnswers, exam.configuration || { rules: { single_correct: { correct: 4, incorrect: -1, unanswered: 0 } } });
        const elapsed = Math.floor((Date.now() - new Date(attemptRow.started_at).getTime()) / 1000);
        const timeTaken = Math.min(attemptRow.duration_seconds, Math.max(0, elapsed));

        const updated = (await client.query(`
          UPDATE attempts
          SET status = 'TERMINATED',
              termination_reason = 'MAX_VIOLATIONS_REACHED',
              terminated_at = NOW(),
              submitted_at = NOW(),
              warning_count = 3,
              is_flagged = TRUE,
              flag_reason = 'Proctoring violation: 3/3 warnings reached (MAX_VIOLATIONS_REACHED)',
              answers = $1,
              time_taken = $2,
              result = $3,
              violation_history = $4
          WHERE id = $5
          RETURNING *
        `, [safeAnswers, timeTaken, result, JSON.stringify(violationHistory), attemptId])).rows[0];

        await log(studentId, 'EXAM_TERMINATED', `Attempt ${attemptId} automatically terminated: 3/3 proctoring violations reached`, client);

        return {
          warningNumber: 3,
          warningCount: 3,
          isFlagged: true,
          isTerminated: true,
          status: 'TERMINATED',
          terminationReason: 'MAX_VIOLATIONS_REACHED',
          terminatedAt: iso(updated.terminated_at),
          attempt: attempt(updated),
          result,
          violationHistory,
          message: 'Warning 3/3: Maximum violation limit reached. Exam automatically terminated.'
        };
      });
    },
    async recordProctoringEvent(studentId, { attemptId, eventType, severity = 'info', details = {} }) {
      const { rows } = await db.query('SELECT * FROM attempts WHERE id=$1 AND student_id=$2', [attemptId, studentId]);
      if (!rows[0]) throw new AppError(404, 'Attempt not found', 'ATTEMPT_NOT_FOUND');
      const attempt = rows[0];

      await db.query(`
        INSERT INTO proctoring_events (id, attempt_id, student_id, exam_id, event_type, severity, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [uid('pevent'), attemptId, studentId, attempt.exam_id, eventType, severity, JSON.stringify(details)]);

      return { recorded: true };
    },
    async getProctoringOverview() {
      const [stats] = await Promise.all([
        db.query(`
          SELECT
            COUNT(DISTINCT a.exam_id) FILTER (WHERE a.status = 'in_progress')::int AS active_exams,
            COUNT(a.id) FILTER (WHERE a.status = 'in_progress')::int AS active_attempts,
            COUNT(ps.id) FILTER (WHERE ps.camera_status = 'active')::int AS active_cameras,
            COUNT(ps.id) FILTER (WHERE ps.camera_status = 'interrupted')::int AS interrupted_cameras,
            COUNT(ps.id) FILTER (WHERE ps.warning_count > 0)::int AS students_with_warnings,
            COUNT(ps.id) FILTER (WHERE ps.warning_count >= 3 OR ps.is_flagged = TRUE OR a.is_flagged = TRUE)::int AS flagged_attempts,
            COUNT(a.id) FILTER (WHERE a.status = 'submitted')::int AS completed_attempts
          FROM attempts a
          LEFT JOIN proctoring_sessions ps ON ps.attempt_id = a.id
        `)
      ]);

      const s = stats.rows[0];
      return {
        activeExamsCount: s.active_exams || 0,
        activeAttemptsCount: s.active_attempts || 0,
        activeCamerasCount: s.active_cameras || 0,
        interruptedCamerasCount: s.interrupted_cameras || 0,
        studentsWithWarningsCount: s.students_with_warnings || 0,
        flaggedAttemptsCount: s.flagged_attempts || 0,
        completedAttemptsCount: s.completed_attempts || 0
      };
    },
    async listProctoringCandidates({ examId, status = 'all', flagged = 'all' } = {}) {
      let query = `
        SELECT
          a.id AS attempt_id, a.exam_id, a.student_id, a.status AS attempt_status,
          a.started_at, a.duration_seconds, a.deadline_at, a.submitted_at,
          COALESCE(ps.warning_count, a.warning_count, 0)::int AS warning_count,
          COALESCE(ps.is_flagged, a.is_flagged, FALSE) AS is_flagged,
          a.flag_reason,
          COALESCE(ps.camera_status, a.proctoring_status, 'active') AS camera_status,
          ps.last_heartbeat_at, ps.interruption_count, ps.total_interruption_seconds,
          ps.verification_checks,
          u.name AS student_name, u.email AS student_email,
          COALESCE(pe.title, 'Examination ' || a.exam_id) AS exam_title
        FROM attempts a
        JOIN users u ON u.id = a.student_id
        LEFT JOIN published_exams pe ON pe.id = a.exam_id
        LEFT JOIN proctoring_sessions ps ON ps.attempt_id = a.id
        WHERE 1=1
      `;
      const params = [];
      if (examId) {
        params.push(examId);
        query += ` AND a.exam_id = $${params.length}`;
      }
      if (status && status !== 'all') {
        params.push(status);
        query += ` AND a.status = $${params.length}`;
      }
      if (flagged === 'true' || flagged === true) {
        query += ` AND (a.is_flagged = TRUE OR ps.is_flagged = TRUE OR ps.warning_count >= 3)`;
      }
      query += ` ORDER BY a.started_at DESC LIMIT 100`;

      const { rows } = await db.query(query, params);
      return rows.map(r => ({
        attemptId: r.attempt_id,
        examId: r.exam_id,
        examTitle: r.exam_title,
        studentId: r.student_id,
        studentName: r.student_name,
        studentEmail: r.student_email,
        attemptStatus: r.attempt_status,
        cameraStatus: r.camera_status,
        warningCount: r.warning_count,
        isFlagged: r.is_flagged,
        flagReason: r.flag_reason,
        startedAt: iso(r.started_at),
        deadlineAt: iso(r.deadline_at),
        submittedAt: iso(r.submitted_at),
        lastHeartbeatAt: iso(r.last_heartbeat_at),
        interruptionCount: r.interruption_count || 0,
        totalInterruptionSeconds: r.total_interruption_seconds || 0,
        verificationChecks: r.verification_checks || {}
      }));
    },
    async getProctoringAttemptTimeline(attemptId) {
      const [attemptRows, warningsRows, eventsRows] = await Promise.all([
        db.query(`
          SELECT a.*, u.name AS student_name, u.email AS student_email,
                 pe.title AS exam_title, ps.camera_status, ps.verification_checks, ps.consent_given_at
          FROM attempts a
          JOIN users u ON u.id = a.student_id
          LEFT JOIN published_exams pe ON pe.id = a.exam_id
          LEFT JOIN proctoring_sessions ps ON ps.attempt_id = a.id
          WHERE a.id = $1
        `, [attemptId]),
        db.query(`
          SELECT * FROM proctoring_warnings WHERE attempt_id = $1 ORDER BY created_at ASC
        `, [attemptId]),
        db.query(`
          SELECT * FROM proctoring_events WHERE attempt_id = $1 ORDER BY created_at ASC LIMIT 200
        `, [attemptId])
      ]);

      if (!attemptRows.rows[0]) throw new AppError(404, 'Attempt not found', 'ATTEMPT_NOT_FOUND');
      const att = attemptRows.rows[0];

      return {
        attempt: {
          id: att.id,
          examId: att.exam_id,
          examTitle: att.exam_title,
          studentId: att.student_id,
          studentName: att.student_name,
          studentEmail: att.student_email,
          status: att.status,
          startedAt: iso(att.started_at),
          submittedAt: iso(att.submitted_at),
          cameraStatus: att.camera_status,
          isFlagged: att.is_flagged,
          flagReason: att.flag_reason,
          warningCount: att.warning_count,
          verificationChecks: att.verification_checks,
          consentGivenAt: iso(att.consent_given_at)
        },
        warnings: warningsRows.rows.map(w => ({
          id: w.id,
          warningNumber: w.warning_number,
          category: w.category,
          message: w.message,
          evidenceMetadata: w.evidence_metadata,
          timestamp: iso(w.created_at)
        })),
        events: eventsRows.rows.map(e => ({
          id: e.id,
          eventType: e.event_type,
          severity: e.severity,
          details: e.details,
          timestamp: iso(e.created_at)
        }))
      };
    },
  };
}
