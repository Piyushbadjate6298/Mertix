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
  // Course/exam artwork is compressed in the browser before it is saved as a
  // data URL. Keep the limit deliberately small enough to reject original
  // camera files while allowing the optimized admin upload.
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", createGeneralLimiter(env));
  const controller = createPlatformController({ service, emailService, env });
  app.use("/api", createApiRouter({ controller, service, env }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
