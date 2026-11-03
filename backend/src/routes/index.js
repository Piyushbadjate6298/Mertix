import { Router } from "express";
import multer from "multer";
import { createAuthMiddleware } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateRequest.js";
import { createSubmissionLimiter } from "../middleware/rateLimiter.js";
import { schemas } from "../utils/validators.js";

export function createApiRouter({ controller, service, env }) {
  const router = Router();
  const { authenticate, optionalAuthenticate, authorize } = createAuthMiddleware({ env, service });
  const submissions = createSubmissionLimiter(env);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1 } });

  router.get("/health", controller.health);
  router.post(
    "/auth/register",
    submissions,
    validateBody(schemas.register),
    controller.register,
  );
  router.post(
    "/auth/login",
    submissions,
    validateBody(schemas.login),
    controller.login,
  );
  router.post('/auth/google', submissions, validateBody(schemas.googleCredential), controller.googleLogin);
  router.get("/auth/me", authenticate, controller.me);
  router.get("/exams", optionalAuthenticate, controller.exams);
  router.get("/exams/:id", optionalAuthenticate, controller.examById);
  router.get('/courses', optionalAuthenticate, controller.publicCourses);
  router.get('/landing-content', controller.landingContent);
  router.get('/payments/configuration', controller.paymentConfiguration);
  router.get("/questions", authenticate, controller.questions);
  router.get(
    "/me/dashboard",
    authenticate,
    authorize("student"),
    controller.dashboard,
  );
  router.get('/me/wallet', authenticate, authorize('student'), controller.wallet);
  router.get('/me/courses', authenticate, authorize('student'), controller.studentCourses);
  router.get('/me/profile', authenticate, authorize('student'), controller.getStudentProfile);
  router.put('/me/profile', authenticate, authorize('student'), validateBody(schemas.studentProfileUpdate), controller.updateStudentProfile);
  router.post('/wallet/deposit/order', submissions, authenticate, authorize('student'), validateBody(schemas.walletDepositOrder), controller.createDepositOrder);
  router.post('/me/wallet/deposit/order', submissions, authenticate, authorize('student'), validateBody(schemas.walletDepositOrder), controller.createDepositOrder);
  router.post('/wallet/deposit/verify', submissions, authenticate, authorize('student'), validateBody(schemas.walletDepositVerify), controller.verifyDepositOrder);
  router.post('/me/wallet/deposit/verify', submissions, authenticate, authorize('student'), validateBody(schemas.walletDepositVerify), controller.verifyDepositOrder);
  router.post('/wallet/withdraw', submissions, authenticate, authorize('student'), validateBody(schemas.walletWithdrawalRequest), controller.requestWithdrawal);
  router.post('/me/wallet/withdraw', submissions, authenticate, authorize('student'), validateBody(schemas.walletWithdrawalRequest), controller.requestWithdrawal);
  router.get('/wallet/withdrawals', authenticate, authorize('student'), controller.studentWithdrawals);
  router.get('/me/wallet/withdrawals', authenticate, authorize('student'), controller.studentWithdrawals);
  router.post('/courses/:id/enroll', submissions, authenticate, authorize('student'), controller.enrollCourse);
  router.post('/me/courses/enroll', submissions, authenticate, authorize('student'), validateBody(schemas.courseEnrollment), controller.enrollCourse);
  router.post(
    "/exams/register",
    submissions,
    authenticate,
    authorize("student"),
    validateBody(schemas.examRegistration),
    controller.registerExam,
  );
  router.post('/payments/orders', submissions, authenticate, authorize('student'), validateBody(schemas.paymentOrder), controller.createPaymentOrder);
  router.post('/payments/verify', submissions, authenticate, authorize('student'), validateBody(schemas.paymentVerification), controller.verifyPayment);
  router.post('/payments/failure', submissions, authenticate, authorize('student'), validateBody(schemas.paymentFailure), controller.markPaymentFailed);
  router.post(
    "/attempts/start",
    authenticate,
    authorize("student"),
    validateBody(schemas.attemptStart),
    controller.startAttempt,
  );
  router.post(
    "/attempts/save",
    authenticate,
    authorize("student"),
    validateBody(schemas.attemptSave),
    controller.saveAttempt,
  );
  router.post(
    "/attempts/submit",
    authenticate,
    authorize("student"),
    validateBody(schemas.attemptSubmit),
    controller.submitAttempt,
  );
  router.post(
    "/attempts/terminate",
    authenticate,
    authorize("student"),
    validateBody(schemas.attemptTerminate),
    controller.terminateAttempt,
  );
  router.post('/proctoring/session/init', authenticate, authorize('student'), validateBody(schemas.proctoringSessionInit), controller.proctoringInit);
  router.post('/proctoring/heartbeat', authenticate, authorize('student'), validateBody(schemas.proctoringHeartbeat), controller.proctoringHeartbeat);
  router.post('/proctoring/warning', authenticate, authorize('student'), validateBody(schemas.proctoringWarning), controller.proctoringWarning);
  router.post('/proctoring/event', authenticate, authorize('student'), validateBody(schemas.proctoringEvent), controller.proctoringEvent);
  router.get(
    "/teacher/papers",
    authenticate,
    authorize("teacher", "admin", "superadmin"),
    controller.papers,
  );
  router.post(
    "/teacher/papers",
    submissions,
    authenticate,
    authorize("teacher", "admin", "superadmin"),
    validateBody(schemas.paper),
    controller.createPaper,
  );
  router.get('/teacher/question-banks', authenticate, authorize('teacher', 'admin', 'superadmin'), controller.questionBanks);
  router.get('/teacher/question-banks/:id', authenticate, authorize('teacher', 'admin', 'superadmin'), controller.questionBank);
  router.post('/teacher/question-banks/import', submissions, authenticate, authorize('teacher', 'admin', 'superadmin'), upload.single('file'), controller.importQuestionBank);
  router.put('/teacher/question-banks/:id', authenticate, authorize('teacher', 'admin', 'superadmin'), validateBody(schemas.questionBankUpdate), controller.updateQuestionBank);
  router.post('/teacher/question-banks/submit', submissions, authenticate, authorize('teacher', 'admin', 'superadmin'), validateBody(schemas.questionBankAction), controller.submitQuestionBank);
  router.get('/teacher/dashboard', authenticate, authorize('teacher', 'admin', 'superadmin'), controller.teacherDashboard);
  router.get('/teacher/profile', authenticate, authorize('teacher', 'admin', 'superadmin'), controller.getTeacherProfile);
  router.put('/teacher/profile', authenticate, authorize('teacher', 'admin', 'superadmin'), validateBody(schemas.teacherProfileUpdate), controller.updateTeacherProfile);
  router.get('/exam-patterns', authenticate, authorize('teacher', 'admin', 'superadmin'), controller.patterns);
  router.get(
    "/admin/overview",
    authenticate,
    authorize("admin", "superadmin"),
    controller.overview,
  );
  router.get('/admin/finance/overview', authenticate, authorize('admin', 'superadmin'), controller.adminFinanceOverview);
  router.get('/admin/finance/master-wallet', authenticate, authorize('admin', 'superadmin'), controller.adminMasterWallet);
  router.get('/admin/finance/master-wallet/transactions', authenticate, authorize('admin', 'superadmin'), controller.adminMasterWalletTransactions);
  router.get('/admin/finance/master-wallet/export', authenticate, authorize('admin', 'superadmin'), controller.adminExportMasterWalletCsv);
  router.post('/admin/finance/master-wallet/withdraw', submissions, authenticate, authorize('admin', 'superadmin'), validateBody(schemas.adminMasterWithdrawal), controller.adminMasterWithdraw);
  router.get('/admin/finance/master-wallet/payouts', authenticate, authorize('admin', 'superadmin'), controller.adminPlatformPayouts);
  router.post('/admin/finance/master-wallet/payouts/:id/review', submissions, authenticate, authorize('superadmin'), validateBody(schemas.adminPayoutReview), controller.adminReviewPlatformPayout);
  router.get('/admin/finance/teachers', authenticate, authorize('admin', 'superadmin'), controller.adminTeacherWallets);
  router.get('/admin/finance/refunds', authenticate, authorize('admin', 'superadmin'), controller.adminRefunds);
  router.get('/admin/finance/payments', authenticate, authorize('admin', 'superadmin'), controller.adminPlatformPayments);
  router.get('/admin/wallets', authenticate, authorize('admin', 'superadmin'), controller.adminWallets);
  router.get('/admin/finance/wallets', authenticate, authorize('admin', 'superadmin'), controller.adminWallets);
  router.get('/admin/wallets/:studentId', authenticate, authorize('admin', 'superadmin'), controller.adminStudentWalletDetails);
  router.get('/admin/finance/wallets/:studentId', authenticate, authorize('admin', 'superadmin'), controller.adminStudentWalletDetails);
  router.get('/admin/withdrawals', authenticate, authorize('admin', 'superadmin'), controller.adminWithdrawals);
  router.get('/admin/finance/withdrawals', authenticate, authorize('admin', 'superadmin'), controller.adminWithdrawals);
  router.post('/admin/withdrawals/:id/review', submissions, authenticate, authorize('admin', 'superadmin'), validateBody(schemas.adminWithdrawalAction), controller.reviewWithdrawal);
  router.post('/admin/finance/withdrawals/:id/review', submissions, authenticate, authorize('admin', 'superadmin'), validateBody(schemas.adminWithdrawalAction), controller.reviewWithdrawal);
  router.post('/admin/finance/withdrawals/:id', submissions, authenticate, authorize('admin', 'superadmin'), validateBody(schemas.adminWithdrawalAction), controller.reviewWithdrawal);
  router.get('/admin/finance/reports', authenticate, authorize('admin', 'superadmin'), controller.adminFinancialReports);
  router.get('/admin/finance/reports/export-csv', authenticate, authorize('admin', 'superadmin'), controller.exportFinancialCsv);
  router.get('/admin/proctoring/overview', authenticate, authorize('admin', 'superadmin'), controller.adminProctoringOverview);
  router.get('/admin/proctoring/candidates', authenticate, authorize('admin', 'superadmin'), controller.adminProctoringCandidates);
  router.get('/admin/proctoring/attempts/:attemptId/timeline', authenticate, authorize('admin', 'superadmin'), controller.adminProctoringTimeline);
  router.post(
    "/admin/papers/approve",
    authenticate,
    authorize("admin", "superadmin"),
    validateBody(schemas.paperApproval),
    controller.approvePaper,
  );
  router.post('/admin/question-banks/approve', authenticate, authorize('admin', 'superadmin'), validateBody(schemas.questionBankApproval), controller.approveQuestionBank);
  router.post('/admin/question-banks/reject', submissions, authenticate, authorize('admin', 'superadmin'), validateBody(schemas.questionBankReject), controller.rejectQuestionBank);
  router.post('/admin/question-banks/publish', submissions, authenticate, authorize('admin', 'superadmin'), validateBody(schemas.questionBankPublish), controller.publishQuestionBank);
  router.post('/admin/exam-patterns', authenticate, authorize('admin', 'superadmin'), validateBody(schemas.examPattern), controller.createPattern);
  router.get('/admin/courses', authenticate, authorize('admin', 'superadmin'), controller.adminCourses);
  router.get('/admin/exams', authenticate, authorize('admin', 'superadmin'), controller.adminExams);
  router.post('/admin/courses', authenticate, authorize('admin', 'superadmin'), validateBody(schemas.course), controller.createCourse);
  router.put('/admin/courses/:id', authenticate, authorize('admin', 'superadmin'), validateBody(schemas.course), controller.updateCourse);
  router.delete('/admin/courses/:id', authenticate, authorize('admin', 'superadmin'), controller.archiveCourse);
  router.put('/admin/landing-content/:key', authenticate, authorize('admin', 'superadmin'), validateBody(schemas.landingContent), controller.updateLandingContent);
  router.patch(
    "/admin/exam",
    authenticate,
    authorize("admin", "superadmin"),
    validateBody(schemas.examStatus),
    controller.updateExam,
  );
  router.put('/admin/exams/:id', authenticate, authorize('admin', 'superadmin'), validateBody(schemas.examCatalog), controller.updateExamCatalog);
  router.delete('/admin/exams/:id', authenticate, authorize('admin', 'superadmin'), controller.deleteExamCatalog);
  router.get('/admin/prize-distributions', authenticate, authorize('admin', 'superadmin'), controller.demoPrizeDistributions);
  router.get('/admin/prize-rankings', authenticate, authorize('admin', 'superadmin'), controller.demoPrizeRankings);
  router.post('/admin/prize-distributions', submissions, authenticate, authorize('admin', 'superadmin'), validateBody(schemas.demoPrizeDistribution), controller.createDemoPrizeDistribution);
  router.post('/admin/prize-distributions/:id/approve', submissions, authenticate, authorize('superadmin'), controller.approveDemoPrizeDistribution);
  router.post(
    "/support",
    submissions,
    authenticate,
    validateBody(schemas.support),
    controller.support,
  );
  router.get(
    "/admin/tickets",
    authenticate,
    authorize("admin", "superadmin"),
    controller.tickets,
  );
  return router;
}
