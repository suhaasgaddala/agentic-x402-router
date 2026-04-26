import type { ModelAlias } from "../providers/types.js";
import { formatUsdNumber, parseUsdEnv } from "./money.js";

export interface PriceConfig {
  defaultPriceUsd: number;
  perModelUsd: Record<ModelAlias, number>;
}

export function createPriceConfig(env: NodeJS.ProcessEnv = process.env): PriceConfig {
  // 0.0009 is an aggressive discovery/volume price for Agentic.Market positioning.
  // Raw Anthropic Sonnet provider cost can exceed this for larger outputs — keep
  // max_tokens small during testing and switch to cheaper models or cloud credits
  // before scaling to production traffic.
  const defaultPriceUsd = parseUsdEnv(env.DEFAULT_PRICE_USD, 0.0009);

  return {
    defaultPriceUsd,
    perModelUsd: {
      "claude-haiku": parseUsdEnv(env.PRICE_CLAUDE_HAIKU_USD, 0.0009),
      "claude-sonnet": parseUsdEnv(env.PRICE_CLAUDE_SONNET_USD, 0.0009),
      "claude-opus": parseUsdEnv(env.PRICE_CLAUDE_OPUS_USD, 0.2),
      "mock-fast": parseUsdEnv(env.PRICE_MOCK_FAST_USD, 0.001)
    }
  };
}

export function getPriceForModel(model: ModelAlias, config = createPriceConfig()): number {
  return formatUsdNumber(config.perModelUsd[model] ?? config.defaultPriceUsd);
}
