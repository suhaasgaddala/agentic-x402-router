import type { ModelAlias } from "../providers/types.js";
import { formatUsdNumber, parseUsdEnv } from "./money.js";

export interface PriceConfig {
  defaultPriceUsd: number;
  perModelUsd: Record<ModelAlias, number>;
}

export function createPriceConfig(env: NodeJS.ProcessEnv = process.env): PriceConfig {
  const defaultPriceUsd = parseUsdEnv(env.DEFAULT_PRICE_USD, 0.04);

  return {
    defaultPriceUsd,
    perModelUsd: {
      "claude-haiku": parseUsdEnv(env.PRICE_CLAUDE_HAIKU_USD, 0.02),
      "claude-sonnet": parseUsdEnv(env.PRICE_CLAUDE_SONNET_USD, 0.04),
      "claude-opus": parseUsdEnv(env.PRICE_CLAUDE_OPUS_USD, 0.2),
      "mock-fast": parseUsdEnv(env.PRICE_MOCK_FAST_USD, 0.001)
    }
  };
}

export function getPriceForModel(model: ModelAlias, config = createPriceConfig()): number {
  return formatUsdNumber(config.perModelUsd[model] ?? config.defaultPriceUsd);
}
