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
    adminExams: async (_req, res) => success(res, { exams: await service.listExams() }),
    questions: async (req, res) => {
      const examId = String(req.query.examId || '').trim();
      if (!examId) throw new AppError(400, 'examId is required', 'VALIDATION_ERROR');
      return success(res, { questions: await service.listQuestions(examId, req.user.role) });
    },
    dashboard: async (req, res) => success(res, await service.studentDashboard(req.user.id)),
    registerExam: async (req, res) => success(res, await service.registerExam(req.user.id, req.validatedBody.examId), 201),
    startAttempt: async (req, res) => success(res, { attempt: await service.startAttempt(req.user.id, req.validatedBody.examId, req.validatedBody.acceptedInstructions) }),
    saveAttempt: async (req, res) => success(res, { saved: true, attempt: await service.saveAttempt(req.user.id, req.validatedBody) }),
    submitAttempt: async (req, res) => success(res, { attempt: await service.submitAttempt(req.user.id, req.validatedBody) }),
    papers: async (_req, res) => success(res, { papers: await service.listPapers() }),
    createPaper: async (req, res) => success(res, { paper: await service.createPaper(req.user.id, req.validatedBody) }, 201),
    questionBanks: async (req, res) => success(res, { banks: await service.listQuestionBanks(req.user) }),
    questionBank: async (req, res) => success(res, { bank: await service.getQuestionBank(req.user, req.params.id) }),
    importQuestionBank: async (req, res) => success(res, { bank: await service.importQuestionBank(req.user.id, req.file, { title: req.body?.title, subject: req.body?.subject, importMode: req.body?.importMode, patternCode: req.body?.patternCode }) }, 201),
    updateQuestionBank: async (req, res) => success(res, { bank: await service.updateQuestionBank(req.user, req.params.id, req.validatedBody) }),
    submitQuestionBank: async (req, res) => success(res, { bank: await service.submitQuestionBank(req.user, req.validatedBody.id) }),
    patterns: async (_req, res) => success(res, { patterns: await service.listPatterns() }),
    createPattern: async (req, res) => success(res, { pattern: await service.createPattern(req.user.id, req.validatedBody) }, 201),
    publicCourses: async (_req, res) => success(res, { courses: await service.listCourses({ publicOnly: true }) }),
    adminCourses: async (_req, res) => success(res, { courses: await service.listCourses({ excludeArchived: true }) }),
    createCourse: async (req, res) => success(res, { course: await service.saveCourse(req.user.id, req.validatedBody) }, 201),
    updateCourse: async (req, res) => success(res, { course: await service.saveCourse(req.user.id, req.validatedBody, req.params.id) }),
    archiveCourse: async (req, res) => success(res, { course: await service.archiveCourse(req.user.id, req.params.id) }),
    landingContent: async (_req, res) => success(res, { content: await service.getLandingContent() }),
    updateLandingContent: async (req, res) => success(res, await service.updateLandingContent(req.user.id, req.params.key, req.validatedBody)),
    overview: async (_req, res) => success(res, await service.adminOverview()),
    approvePaper: async (req, res) => success(res, { paper: await service.approvePaper(req.user.id, req.validatedBody.id) }),
    approveQuestionBank: async (req, res) => success(res, { bank: await service.approveQuestionBank(req.user.id, req.validatedBody) }),
    rejectQuestionBank: async (req, res) => success(res, { bank: await service.rejectQuestionBank(req.user.id, req.validatedBody) }),
    publishQuestionBank: async (req, res) => success(res, await service.publishQuestionBank(req.user.id, req.validatedBody), 201),
    updateExam: async (req, res) => success(res, { exam: await service.updateExamStatus(req.user.id, req.validatedBody) }),
    updateExamCatalog: async (req, res) => success(res, { exam: await service.updateExamCatalog(req.user.id, req.params.id, req.validatedBody) }),
    deleteExamCatalog: async (req, res) => success(res, await service.deleteExamCatalog(req.user.id, req.params.id)),
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
