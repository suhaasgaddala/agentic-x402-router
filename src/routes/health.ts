import { Router } from "express";

export function createHealthRouter(): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "agentic-x402-router",
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
