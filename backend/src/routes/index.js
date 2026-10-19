import { Router } from "express";
import { createAuthMiddleware } from "../middleware/auth.js";
import { validateBody } from "../middleware/validateRequest.js";
import { createSubmissionLimiter } from "../middleware/rateLimiter.js";
import { schemas } from "../utils/validators.js";

export function createApiRouter({ controller, service, env }) {
  const router = Router();
  const { authenticate, authorize } = createAuthMiddleware({ env, service });
  const submissions = createSubmissionLimiter(env);

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
  router.patch(
    "/admin/exam",
    authenticate,
    authorize("admin", "superadmin"),
    validateBody(schemas.examStatus),
    controller.updateExam,
  );
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
