import express from "express";
import type { AppConfig } from "./config.js";
import { HttpError } from "./errors/httpError.js";
import { errorHandler } from "./errors/errorHandler.js";
import { createCapabilitiesRouter } from "./routes/capabilities.js";
import { createHealthRouter } from "./routes/health.js";
import { createMarketSignalRouter } from "./routes/marketSignal.js";
import { createModelCallRouter } from "./routes/modelCall.js";
import { createModelsRouter } from "./routes/models.js";
import { createRootRouter } from "./routes/root.js";
import { requestIdMiddleware } from "./telemetry/requestId.js";
import { createX402Middleware } from "./x402/middleware.js";

export function createApp(config: AppConfig) {
  const app = express();

  // Single shared x402 middleware instance covers all paid routes in RoutesConfig.
  const paymentMiddleware = createX402Middleware(config);

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(createRootRouter(config));
  app.use(createHealthRouter());
  app.use(createModelsRouter(config));
  app.use(createCapabilitiesRouter(config));
  app.use(createModelCallRouter(config, paymentMiddleware));
  app.use(createMarketSignalRouter(config, paymentMiddleware));
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
