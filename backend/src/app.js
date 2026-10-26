import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createGeneralLimiter } from "./middleware/rateLimiter.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { AppError } from "./utils/errors.js";
import { createPlatformController } from "./controllers/platform.controller.js";
import { createApiRouter } from "./routes/index.js";

export function createApp({ service, emailService, env }) {
  const app = express();
  const controller = createPlatformController({ service, emailService, env });
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.frontendOrigins.includes(origin.replace(/\/$/, "")))
          return callback(null, true);
        return callback(
          new AppError(403, "Origin is not allowed by CORS", "CORS_REJECTED"),
        );
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86_400,
    }),
  );
  app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '256kb' }), controller.paymentWebhook);
  // A course can carry both a card image and a banner. Each is browser-optimized
  // and validator-limited, so the JSON envelope must safely fit both values.
  app.use(express.json({ limit: "4mb" }));
  app.use('/api/exams', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api/courses', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api/landing-content', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api/admin/courses', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api/admin/exams', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use("/api", createGeneralLimiter(env));
  app.use("/api", createApiRouter({ controller, service, env }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
