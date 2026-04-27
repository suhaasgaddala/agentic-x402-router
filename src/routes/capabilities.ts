import { Router } from "express";
import type { AppConfig } from "../config.js";
import { getPriceForModel } from "../billing/pricing.js";

export function createCapabilitiesRouter(config: AppConfig): Router {
  const router = Router();

  router.get("/v1/capabilities", (_req, res) => {
    const modelProvider = config.anthropic.apiKey ? "anthropic" : "mock";
    const modelCallPrice = getPriceForModel("claude-sonnet", config.pricing);

    res.status(200).json({
      ok: true,
      service: "agentic-x402-router",
      x402_enabled: config.x402.enabled,
      network: config.x402.network,
      public_base_url: config.publicBaseUrl ?? null,
      capabilities: [
        {
          id: "model-call",
          method: "POST",
          route: "/v1/model-call",
          price_usd: modelCallPrice,
          provider: modelProvider,
          payment: "x402",
          description: "paid model-call API for agents"
        },
        {
          id: "market-signal",
          method: "POST",
          route: "/v1/market-signal",
          price_usd: config.marketSignal.priceUsd,
          provider: config.marketSignal.provider,
          payment: "x402",
          description: "paid onchain market-signal API"
        }
      ]
    });
  });

  return router;
}
