import { Router } from "express";
import multer from "multer";
import { createAuthMiddleware } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateRequest.js";
import { createSubmissionLimiter } from "../middleware/rateLimiter.js";
import { schemas } from "../utils/validators.js";

export function createApiRouter({ controller, service, env }) {
  const router = Router();
  const { authenticate, authorize } = createAuthMiddleware({ env, service });
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
  router.get("/auth/me", authenticate, controller.me);
  router.get("/exams", controller.exams);
  router.get('/courses', controller.publicCourses);
  router.get('/landing-content', controller.landingContent);
  router.get('/payments/configuration', controller.paymentConfiguration);
  router.get("/questions", authenticate, controller.questions);
  router.get(
    "/me/dashboard",
    authenticate,
    authorize("student"),
    controller.dashboard,
  );
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
  router.get('/exam-patterns', authenticate, authorize('teacher', 'admin', 'superadmin'), controller.patterns);
  router.get(
    "/admin/overview",
    authenticate,
    authorize("admin", "superadmin"),
    controller.overview,
  );
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
