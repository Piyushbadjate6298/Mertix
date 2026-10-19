import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { exams, questionsForExam } from '../data/platform.js';
import { evaluate } from '../utils/evaluation.js';
import { AppError } from '../utils/errors.js';

const uid = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
const iso = (value) => value ? new Date(value).toISOString() : null;
const publicUser = (row) => row && ({ id: row.id, name: row.name, email: row.email, role: row.role, target: row.target, city: row.city, year: row.academic_year, createdAt: iso(row.created_at) });
const registration = (row) => ({ id: row.id, studentId: row.student_id, examId: row.exam_id, paymentId: row.payment_id, status: row.status, date: iso(row.created_at) });
const payment = (row) => ({ id: row.id, studentId: row.student_id, examId: row.exam_id, amount: Number(row.amount), status: row.status, gateway: row.gateway, date: iso(row.created_at) });
const paper = (row) => ({ id: row.id, title: row.title, subject: row.subject, questions: row.question_count, status: row.status, createdBy: row.created_by, date: iso(row.created_at) });
const ticket = (row) => ({ id: row.id, userId: row.user_id, subject: row.subject, message: row.message, status: row.status, createdAt: iso(row.created_at) });
const attempt = (row) => ({ id: row.id, studentId: row.student_id, examId: row.exam_id, status: row.status, answers: row.answers || {}, marked: row.marked || [], result: row.result, durationSeconds: row.duration_seconds, startedAt: iso(row.started_at), lastSavedAt: iso(row.last_saved_at), submittedAt: iso(row.submitted_at), timeTaken: row.time_taken });

export function createPlatformService(db) {
  async function log(actorId, action, detail, client = db) {
    await client.query('INSERT INTO audit_log (id, actor_id, action, detail) VALUES ($1,$2,$3,$4)', [uid('audit'), actorId, action, String(detail || '').slice(0, 500)]);
  }

  async function listExams(client = db) {
    const { rows } = await client.query('SELECT exam_id, status FROM exam_overrides');
    const overrides = Object.fromEntries(rows.map((row) => [row.exam_id, row.status]));
    return exams.map((item) => ({ ...item, status: overrides[item.id] || item.status }));
  }

  async function getExam(examId, client = db) {
    return (await listExams(client)).find((item) => item.id === examId) || null;
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
    async listQuestions(examId, role) {
      const exam = await getExam(examId);
      if (!exam) throw new AppError(404, 'Exam not found', 'EXAM_NOT_FOUND');
      const paperQuestions = questionsForExam(exam);
      return role === 'student' ? paperQuestions.map(({ answer, explanation, ...question }) => question) : structuredClone(paperQuestions);
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
        const exists = await client.query('SELECT 1 FROM registrations WHERE student_id=$1 AND exam_id=$2', [studentId, examId]);
        if (exists.rowCount) throw new AppError(409, 'Already registered', 'ALREADY_REGISTERED');
        const paymentRow = (await client.query(
          `INSERT INTO payments (id,student_id,exam_id,amount,status) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [uid('pay'), studentId, examId, exam.fee, exam.fee ? 'demo-only' : 'free'],
        )).rows[0];
        const registrationRow = (await client.query(
          `INSERT INTO registrations (id,student_id,exam_id,payment_id,status) VALUES ($1,$2,$3,$4,'confirmed') RETURNING *`,
          [uid('reg'), studentId, examId, paymentRow.id],
        )).rows[0];
        await log(studentId, 'EXAM_REGISTER', examId, client);
        return { registration: registration(registrationRow), payment: payment(paymentRow) };
      });
    },
    async startAttempt(studentId, examId) {
      const exam = await getExam(examId);
      if (!exam) throw new AppError(404, 'Exam unavailable', 'EXAM_NOT_FOUND');
      const registered = await db.query(`SELECT 1 FROM registrations WHERE student_id=$1 AND exam_id=$2 AND status='confirmed'`, [studentId, examId]);
      if (!registered.rowCount) throw new AppError(403, 'Register before starting', 'REGISTRATION_REQUIRED');
      const existing = await db.query('SELECT * FROM attempts WHERE student_id=$1 AND exam_id=$2', [studentId, examId]);
      if (existing.rows[0]?.status === 'submitted') throw new AppError(409, 'Attempt already submitted', 'ATTEMPT_SUBMITTED');
      if (existing.rows[0]) return attempt(existing.rows[0]);
      const row = (await db.query(
        `INSERT INTO attempts (id,student_id,exam_id,status,duration_seconds) VALUES ($1,$2,$3,'in_progress',720) RETURNING *`,
        [uid('attempt'), studentId, examId],
      )).rows[0];
      return attempt(row);
    },
    async saveAttempt(studentId, { attemptId, answers, marked }) {
      const current = await db.query(`SELECT * FROM attempts WHERE id=$1 AND student_id=$2 AND status='in_progress'`, [attemptId, studentId]);
      if (!current.rowCount) throw new AppError(404, 'Active attempt not found', 'ATTEMPT_NOT_FOUND');
      const row = current.rows[0];
      if (Date.now() > new Date(row.started_at).getTime() + row.duration_seconds * 1000 + 5000) throw new AppError(409, 'Time expired. Submit your attempt.', 'ATTEMPT_EXPIRED');
      const exam = await getExam(row.exam_id);
      const ids = new Set(questionsForExam(exam).map((item) => String(item.id)));
      const safeAnswers = Object.fromEntries(Object.entries(answers).filter(([key]) => ids.has(key)));
      const safeMarked = marked.map(String).filter((id) => ids.has(id));
      const updated = (await db.query(`UPDATE attempts SET answers=$1, marked=$2, last_saved_at=NOW() WHERE id=$3 RETURNING *`, [safeAnswers, safeMarked, attemptId])).rows[0];
      return attempt(updated);
    },
    async submitAttempt(studentId, { attemptId, answers }) {
      return db.transaction(async (client) => {
        const current = await client.query(`SELECT * FROM attempts WHERE id=$1 AND student_id=$2 AND status='in_progress' FOR UPDATE`, [attemptId, studentId]);
        if (!current.rowCount) throw new AppError(404, 'Active attempt not found', 'ATTEMPT_NOT_FOUND');
        const row = current.rows[0];
        const exam = await getExam(row.exam_id, client);
        const merged = { ...(row.answers || {}), ...answers };
        const result = evaluate(questionsForExam(exam), merged);
        const elapsed = Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000);
        const updated = (await client.query(
          `UPDATE attempts SET answers=$1,status='submitted',submitted_at=NOW(),time_taken=$2,result=$3 WHERE id=$4 RETURNING *`,
          [merged, Math.min(row.duration_seconds, Math.max(0, elapsed)), result, attemptId],
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
