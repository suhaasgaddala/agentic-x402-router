import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { config } from "../config.js";
import { logger } from "../telemetry/logger.js";
import { isHttpError } from "./httpError.js";

function zodDetails(error: ZodError): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  };
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = req.requestId;

  if (error instanceof SyntaxError && "status" in error) {
    logger.warn({ request_id: requestId, route: req.path, error_code: "INVALID_JSON" });
    res.status(400).json({
      ok: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON."
      }
    });
    return;
  }

  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
    logger.warn({ request_id: requestId, route: req.path, error_code: "PAYLOAD_TOO_LARGE" });
    res.status(413).json({
      ok: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body is too large."
      }
    });
    return;
  }

  if (error instanceof ZodError) {
    logger.warn({ request_id: requestId, route: req.path, error_code: "VALIDATION_ERROR" });
    res.status(400).json({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: zodDetails(error)
      }
    });
    return;
  }

  if (isHttpError(error)) {
    logger.warn({
      request_id: requestId,
      route: req.path,
      error_code: error.code,
      status_code: error.statusCode
    });
    res.status(error.statusCode).json({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      }
    });
    return;
  }

  const message =
    error instanceof Error && config.nodeEnv !== "production"
      ? error.message
      : "Unexpected server error.";

  logger.error({ err: error, request_id: requestId, route: req.path, error_code: "INTERNAL_ERROR" });
  res.status(500).json({
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message
    }
  });
};
