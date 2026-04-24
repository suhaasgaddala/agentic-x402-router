import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

function sanitizeRequestId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) {
    return undefined;
  }

  const safe = trimmed.replace(/[^a-zA-Z0-9_.:-]/g, "");
  return safe || undefined;
}

export function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 12)}`;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req.requestId = sanitizeRequestId(req.header("x-request-id")) ?? createRequestId();
  res.setHeader("x-request-id", req.requestId);
  next();
}
