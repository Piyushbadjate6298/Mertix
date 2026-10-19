import jwt from 'jsonwebtoken';
import { success } from '../utils/apiResponse.js';
import { AppError } from '../utils/errors.js';

export function createPlatformController({ service, emailService, env }) {
  return {
    health: async (_req, res) => success(res, { ok: true, product: 'MERITX API', time: new Date().toISOString(), ...(await service.health()) }),
    register: async (req, res) => success(res, { message: 'Student registered. Please log in.', user: await service.registerUser(req.validatedBody) }, 201),
    login: async (req, res) => {
      const user = await service.login(req.validatedBody);
      const token = jwt.sign({ role: user.role }, env.jwtSecret, { subject: user.id, expiresIn: env.jwtExpiresIn, issuer: 'meritx-api', audience: 'meritx-web' });
      return success(res, { token, user });
    },
    me: async (req, res) => success(res, { user: req.user }),
    exams: async (_req, res) => success(res, { exams: await service.listExams() }),
    questions: async (req, res) => {
      const examId = String(req.query.examId || '').trim();
      if (!examId) throw new AppError(400, 'examId is required', 'VALIDATION_ERROR');
      return success(res, { questions: await service.listQuestions(examId, req.user.role) });
    },
    dashboard: async (req, res) => success(res, await service.studentDashboard(req.user.id)),
    registerExam: async (req, res) => success(res, await service.registerExam(req.user.id, req.validatedBody.examId), 201),
    startAttempt: async (req, res) => success(res, { attempt: await service.startAttempt(req.user.id, req.validatedBody.examId) }),
    saveAttempt: async (req, res) => success(res, { saved: true, attempt: await service.saveAttempt(req.user.id, req.validatedBody) }),
    submitAttempt: async (req, res) => success(res, { attempt: await service.submitAttempt(req.user.id, req.validatedBody) }),
    papers: async (_req, res) => success(res, { papers: await service.listPapers() }),
    createPaper: async (req, res) => success(res, { paper: await service.createPaper(req.user.id, req.validatedBody) }, 201),
    overview: async (_req, res) => success(res, await service.adminOverview()),
    approvePaper: async (req, res) => success(res, { paper: await service.approvePaper(req.user.id, req.validatedBody.id) }),
    updateExam: async (req, res) => success(res, { exam: await service.updateExamStatus(req.user.id, req.validatedBody) }),
    support: async (req, res) => {
      const ticket = await service.createSupportTicket(req.user.id, req.validatedBody);
      let emailNotification = 'skipped';
      try { emailNotification = (await emailService.sendSupportNotification({ ticket, user: req.user })).status; }
      catch (error) { console.error('Support notification failed after ticket was saved:', error.message); emailNotification = 'failed'; }
      return success(res, { ticket, emailNotification }, 201);
    },
    tickets: async (_req, res) => success(res, { tickets: await service.listSupportTickets() }),
  };
}
