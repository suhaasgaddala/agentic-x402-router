import { Router } from "express";
import type { AppConfig } from "../config.js";
import { getPriceForModel } from "../billing/pricing.js";

export function createRootRouter(config: AppConfig): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const modelProvider = config.anthropic.apiKey ? "anthropic" : "mock";
    const modelCallPrice = getPriceForModel("claude-sonnet", config.pricing);

    res.status(200).json({
      ok: true,
      service: "agentic-x402-router",
      status: "live",
      description: "x402-paid AI/agent infrastructure gateway",
      public_base_url: config.publicBaseUrl ?? null,
      endpoints: {
        "POST /v1/model-call": {
          description: "x402-paid Claude/model-call API for agents",
          price_usd: modelCallPrice,
          provider: modelProvider,
          discovery: "Bazaar indexed"
        },
        "POST /v1/market-signal": {
          description: "x402-paid DexScreener onchain market-signal API",
          price_usd: config.marketSignal.priceUsd,
          provider: config.marketSignal.provider,
          discovery: "Bazaar indexed"
        }
      },
      health_url: "/health",
      models_url: "/v1/models",
      capabilities_url: "/v1/capabilities"
    });
  });

  return router;
}
