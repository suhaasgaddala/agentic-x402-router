import { Router, json } from "express";
import type { RequestHandler } from "express";
import type { AppConfig } from "../config.js";
import { estimateMarginUsd, estimateProviderCostUsd, estimateTokensFromText } from "../billing/cost.js";
import { getPriceForModel } from "../billing/pricing.js";
import { formatUsdNumber } from "../billing/money.js";
import { createProviderRegistry } from "../providers/index.js";
import { createModelCallSchema } from "../schemas/modelCall.js";
import { logger } from "../telemetry/logger.js";
import { getFixedX402PriceUsd } from "../x402/config.js";
import { createX402Middleware } from "../x402/middleware.js";

export function createModelCallRouter(
  config: AppConfig,
  paymentMiddleware: RequestHandler = createX402Middleware(config)
): Router {
  const router = Router();
  const schema = createModelCallSchema({
    maxInputChars: config.maxInputChars,
    maxOutputTokens: config.maxOutputTokens
  });
  const providers = createProviderRegistry(config);

  router.post(
    "/v1/model-call",
    paymentMiddleware,
    json({ limit: config.jsonBodyLimit }),
    async (req, res, next) => {
      const startedAt = process.hrtime.bigint();

      try {
        const parsed = schema.parse(req.body);
        const provider = providers.getProviderForModel(parsed.model);
        const result = await provider.call({
          requestId: req.requestId,
          model: parsed.model,
          messages: parsed.messages,
          maxTokens: parsed.max_tokens,
          temperature: parsed.temperature,
          metadata: parsed.metadata
        });
        const inputText = parsed.messages.map((message) => message.content).join("\n");
        const inputTokens = result.usage.inputTokens ?? estimateTokensFromText(inputText);
        const outputTokens = result.usage.outputTokens ?? estimateTokensFromText(result.text);
        const chargedUsd = config.x402.enabled
          ? getFixedX402PriceUsd(config)
          : getPriceForModel(parsed.model, config.pricing);
        const estimatedProviderCostUsd = estimateProviderCostUsd(
          parsed.model,
          {
            inputTokens,
            outputTokens,
            inputText,
            outputText: result.text
          },
          config.cost
        );
        const estimatedMarginUsd = estimateMarginUsd(chargedUsd, estimatedProviderCostUsd);
        const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

        logger.info({
          request_id: req.requestId,
          route: "/v1/model-call",
          model: parsed.model,
          provider: result.provider,
          success: true,
          latency_ms: formatUsdNumber(latencyMs),
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          charged_usd: chargedUsd,
          estimated_provider_cost_usd: estimatedProviderCostUsd,
          estimated_margin_usd: estimatedMarginUsd
        });

        res.status(200).json({
          ok: true,
          id: req.requestId,
          model: parsed.model,
          provider: result.provider,
          text: result.text,
          usage: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            estimated_provider_cost_usd: estimatedProviderCostUsd,
            charged_usd: chargedUsd,
            estimated_margin_usd: estimatedMarginUsd
          },
          timing: {
            latency_ms: Math.round(latencyMs)
          }
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
