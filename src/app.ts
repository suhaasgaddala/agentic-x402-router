import express from "express";
import type { AppConfig } from "./config.js";
import { HttpError } from "./errors/httpError.js";
import { errorHandler } from "./errors/errorHandler.js";
import { createHealthRouter } from "./routes/health.js";
import { createModelCallRouter } from "./routes/modelCall.js";
import { createModelsRouter } from "./routes/models.js";
import { requestIdMiddleware } from "./telemetry/requestId.js";

export function createApp(config: AppConfig) {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(createHealthRouter());
  app.use(createModelsRouter(config));
  app.use(createModelCallRouter(config));
  app.use((req, _res, next) => {
    next(
      new HttpError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: `Route ${req.method} ${req.path} not found.`
      })
    );
  });
  app.use(errorHandler);

  return app;
}
