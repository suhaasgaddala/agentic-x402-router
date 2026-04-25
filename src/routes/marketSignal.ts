import { Router, json } from "express";
import type { RequestHandler } from "express";
import type { AppConfig } from "../config.js";
import { formatUsdNumber } from "../billing/money.js";
import { createMarketSignalRegistry } from "../market/index.js";
import { createMarketSignalSchema } from "../schemas/marketSignal.js";
import { logger } from "../telemetry/logger.js";
import { createX402Middleware } from "../x402/middleware.js";

export const MARKET_SIGNAL_DISCLAIMER =
  "Market signals are informational only and do not constitute financial advice.";

export function createMarketSignalRouter(
  config: AppConfig,
  paymentMiddleware: RequestHandler = createX402Middleware(config)
): Router {
  const router = Router();
  const schema = createMarketSignalSchema();
  const registry = createMarketSignalRegistry(config);

  router.post(
    "/v1/market-signal",
    paymentMiddleware,
    json({ limit: config.jsonBodyLimit }),
    async (req, res, next) => {
      const startedAt = process.hrtime.bigint();

      try {
        const parsed = schema.parse(req.body);
        const provider = registry.getProviderForChain(parsed.chain);
        const result = await provider.fetchSignals({
          requestId: req.requestId,
          chain: parsed.chain,
          token: parsed.token,
          timeframe: parsed.timeframe,
          signals: parsed.signals,
          pool: parsed.pool
        });

        const chargedUsd = config.marketSignal.priceUsd;
        const estimatedProviderCostUsd = registry.getProviderCostUsd(result.dataSource);
        const estimatedMarginUsd = formatUsdNumber(chargedUsd - estimatedProviderCostUsd);
        const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

        logger.info({
          request_id: req.requestId,
          route: "/v1/market-signal",
          chain: parsed.chain,
          timeframe: parsed.timeframe,
          signals: parsed.signals,
          data_source: result.dataSource,
          success: true,
          latency_ms: formatUsdNumber(latencyMs),
          charged_usd: chargedUsd,
          estimated_provider_cost_usd: estimatedProviderCostUsd,
          estimated_margin_usd: estimatedMarginUsd
        });

        res.status(200).json({
          ok: true,
          id: req.requestId,
          chain: parsed.chain,
          token: parsed.token,
          timeframe: parsed.timeframe,
          data_source: result.dataSource,
          summary: result.summary,
          signals: result.signals,
          usage: {
            charged_usd: chargedUsd,
            estimated_provider_cost_usd: estimatedProviderCostUsd,
            estimated_margin_usd: estimatedMarginUsd
          },
          timing: {
            latency_ms: Math.round(latencyMs)
          },
          disclaimer: MARKET_SIGNAL_DISCLAIMER
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
