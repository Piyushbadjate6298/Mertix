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
    googleLogin: async (req, res) => {
      if (!env.googleClientId) throw new AppError(503, 'Google sign-in is not configured', 'GOOGLE_AUTH_NOT_CONFIGURED');
      const infoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(req.validatedBody.credential)}`);
      if (!infoResponse.ok) throw new AppError(401, 'Google identity could not be verified', 'GOOGLE_IDENTITY_INVALID');
      const identity = await infoResponse.json();
      if (identity.aud !== env.googleClientId || !['accounts.google.com', 'https://accounts.google.com'].includes(identity.iss) || Number(identity.exp) * 1000 <= Date.now() || identity.email_verified !== 'true' || !identity.sub || !identity.email) throw new AppError(401, 'Google identity is invalid or not verified', 'GOOGLE_IDENTITY_INVALID');
      const user = await service.authenticateGoogle({ subject: identity.sub, email: identity.email, name: identity.name || identity.email.split('@')[0], target: req.validatedBody.target });
      const token = jwt.sign({ role: user.role }, env.jwtSecret, { subject: user.id, expiresIn: env.jwtExpiresIn, issuer: 'meritx-api', audience: 'meritx-web' });
      return success(res, { token, user });
    },
    me: async (req, res) => success(res, { user: req.user }),
    exams: async (req, res) => success(res, { exams: await service.listExams(undefined, { authenticated: Boolean(req.user) }) }),
    examById: async (req, res) => {
      const exam = await service.getExam(req.params.id, undefined, { authenticated: Boolean(req.user) });
      if (!exam) throw new AppError(404, 'Examination not found', 'EXAM_NOT_FOUND');
      return success(res, { exam });
    },
    adminExams: async (_req, res) => success(res, { exams: await service.listExams() }),
    questions: async (req, res) => {
      const examId = String(req.query.examId || '').trim();
      if (!examId) throw new AppError(400, 'examId is required', 'VALIDATION_ERROR');
      return success(res, { questions: await service.listQuestions(examId, req.user.role) });
    },
    dashboard: async (req, res) => success(res, await service.studentDashboard(req.user.id)),
    wallet: async (req, res) => {
      if (service.getStudentWallet) {
        const w = await service.getStudentWallet(req.user.id);
        return success(res, { wallet: w, ...w });
      }
      return success(res, await service.demoWallet(req.user.id));
    },
    createDepositOrder: async (req, res) => success(res, await service.createDepositOrder(req.user.id, req.validatedBody), 201),
    verifyDepositOrder: async (req, res) => success(res, await service.verifyDepositOrder(req.user.id, req.validatedBody)),
    requestWithdrawal: async (req, res) => success(res, await service.requestWithdrawal(req.user.id, req.validatedBody), 201),
    studentWithdrawals: async (req, res) => success(res, { withdrawals: await service.listStudentWithdrawals(req.user.id) }),
    enrollCourse: async (req, res) => success(res, await service.enrollCourse(req.user.id, req.params.id || req.validatedBody.courseId), 201),
    studentCourses: async (req, res) => success(res, { courses: await service.listStudentCourses(req.user.id) }),
    getStudentProfile: async (req, res) => success(res, { profile: await service.getStudentProfile(req.user.id) }),
    updateStudentProfile: async (req, res) => success(res, { profile: await service.updateStudentProfile(req.user.id, req.validatedBody) }),
    teacherDashboard: async (req, res) => success(res, await service.getTeacherDashboard(req.user.id)),
    getTeacherProfile: async (req, res) => success(res, { profile: await service.getTeacherProfile(req.user.id) }),
    updateTeacherProfile: async (req, res) => success(res, { profile: await service.updateTeacherProfile(req.user.id, req.validatedBody) }),
    registerExam: async (req, res) => success(res, await service.registerExam(req.user.id, req.validatedBody.examId), 201),
    paymentConfiguration: async (_req, res) => success(res, service.paymentConfiguration()),
    createPaymentOrder: async (req, res) => {
      const order = await service.createPaymentOrder(req.user.id, req.validatedBody.examId);
      if (order.free) return success(res, { ...order, ...(await service.registerExam(req.user.id, req.validatedBody.examId)) }, 201);
      return success(res, order, 201);
    },
    verifyPayment: async (req, res) => success(res, await service.verifyPayment(req.user.id, req.validatedBody)),
    markPaymentFailed: async (req, res) => success(res, { payment: await service.markPaymentFailed(req.user.id, req.validatedBody) }),
    paymentWebhook: async (req, res) => success(res, await service.processPaymentWebhook(req.get('x-razorpay-signature'), req.body)),
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
    publicCourses: async (req, res) => success(res, { courses: await service.listCourses({ publicOnly: true, authenticated: Boolean(req.user) }) }),
    adminCourses: async (_req, res) => success(res, { courses: await service.listCourses({ excludeArchived: true }) }),
    createCourse: async (req, res) => success(res, { course: await service.saveCourse(req.user.id, req.validatedBody) }, 201),
    updateCourse: async (req, res) => success(res, { course: await service.saveCourse(req.user.id, req.validatedBody, req.params.id) }),
    archiveCourse: async (req, res) => success(res, { course: await service.archiveCourse(req.user.id, req.params.id) }),
    landingContent: async (_req, res) => success(res, { content: await service.getLandingContent() }),
    updateLandingContent: async (req, res) => success(res, await service.updateLandingContent(req.user.id, req.params.key, req.validatedBody)),
    overview: async (_req, res) => success(res, await service.adminOverview()),
    adminFinanceOverview: async (_req, res) => success(res, await service.getAdminFinanceOverview()),
    adminWallets: async (req, res) => success(res, { wallets: await service.listStudentWallets({ search: req.query.search, status: req.query.status }) }),
    adminStudentWalletDetails: async (req, res) => success(res, await service.getStudentWalletDetails(req.params.studentId)),
    adminWithdrawals: async (req, res) => success(res, { withdrawals: await service.listAdminWithdrawals({ status: req.query.status }) }),
    reviewWithdrawal: async (req, res) => success(res, { withdrawal: await service.reviewWithdrawal(req.user.id, { id: req.params.id || req.validatedBody.id, ...req.validatedBody }) }),
    adminFinancialReports: async (req, res) => success(res, await service.getFinancialReports(req.query)),
    exportFinancialCsv: async (req, res) => {
      const csv = await service.exportFinancialCsv(req.query);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="meritx-financial-report.csv"');
      return res.send(csv);
    },
    approvePaper: async (req, res) => success(res, { paper: await service.approvePaper(req.user.id, req.validatedBody.id) }),
    approveQuestionBank: async (req, res) => success(res, { bank: await service.approveQuestionBank(req.user.id, req.validatedBody) }),
    rejectQuestionBank: async (req, res) => success(res, { bank: await service.rejectQuestionBank(req.user.id, req.validatedBody) }),
    publishQuestionBank: async (req, res) => success(res, await service.publishQuestionBank(req.user.id, req.validatedBody), 201),
    updateExam: async (req, res) => success(res, { exam: await service.updateExamStatus(req.user.id, req.validatedBody) }),
    updateExamCatalog: async (req, res) => success(res, { exam: await service.updateExamCatalog(req.user.id, req.params.id, req.validatedBody) }),
    deleteExamCatalog: async (req, res) => success(res, await service.deleteExamCatalog(req.user.id, req.params.id)),
    demoPrizeDistributions: async (_req, res) => success(res, { distributions: await service.listDemoPrizeDistributions() }),
    demoPrizeRankings: async (req, res) => success(res, { rankings: await service.demoPrizeRankings(String(req.query.examId || '')) }),
    createDemoPrizeDistribution: async (req, res) => success(res, { distribution: await service.createDemoPrizeDistribution(req.user.id, req.validatedBody) }, 201),
    approveDemoPrizeDistribution: async (req, res) => success(res, { distribution: await service.approveDemoPrizeDistribution(req.user.id, req.params.id) }),
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
