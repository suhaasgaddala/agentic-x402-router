import { Router } from "express";
import type { AppConfig } from "../config.js";
import { getPriceForModel } from "../billing/pricing.js";
import type { ModelAlias } from "../providers/types.js";

interface ModelInfo {
  id: ModelAlias;
  provider: "anthropic" | "mock";
  description: string;
}

const modelInfo: ModelInfo[] = [
  {
    id: "claude-haiku",
    provider: "anthropic",
    description: "Fast Claude-family model alias. In phase 1 this resolves to the local mock provider."
  },
  {
    id: "claude-sonnet",
    provider: "anthropic",
    description: "Balanced Claude-family model alias. In phase 1 this resolves to the local mock provider."
  },
  {
    id: "claude-opus",
    provider: "anthropic",
    description: "High-capability Claude-family model alias. In phase 1 this resolves to the local mock provider."
  },
  {
    id: "mock-fast",
    provider: "mock",
    description: "Deterministic local mock model for development and tests."
  }
];

export function createModelsRouter(config: AppConfig): Router {
  const router = Router();

  router.get("/v1/models", (_req, res) => {
    res.status(200).json({
      ok: true,
      models: modelInfo.map((model) => ({
        id: model.id,
        provider: model.provider,
        description: model.description,
        max_input_chars: config.maxInputChars,
        max_output_tokens: config.maxOutputTokens,
        default_price_usd: getPriceForModel(model.id, config.pricing)
      }))
    });
  });

  return router;
}
