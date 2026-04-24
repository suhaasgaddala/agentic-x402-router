import type { ModelAlias } from "../providers/types.js";
import { formatUsdNumber, parseUsdEnv } from "./money.js";

export interface CostConfig {
  perMillionTokensUsd: Record<
    Exclude<ModelAlias, "mock-fast">,
    {
      input: number;
      output: number;
    }
  >;
}

export interface CostUsage {
  inputTokens?: number;
  outputTokens?: number;
  inputText?: string;
  outputText?: string;
}

export function createCostConfig(env: NodeJS.ProcessEnv = process.env): CostConfig {
  return {
    perMillionTokensUsd: {
      "claude-haiku": {
        input: parseUsdEnv(env.COST_CLAUDE_HAIKU_INPUT_PER_MTOK_USD, 1),
        output: parseUsdEnv(env.COST_CLAUDE_HAIKU_OUTPUT_PER_MTOK_USD, 5)
      },
      "claude-sonnet": {
        input: parseUsdEnv(env.COST_CLAUDE_SONNET_INPUT_PER_MTOK_USD, 3),
        output: parseUsdEnv(env.COST_CLAUDE_SONNET_OUTPUT_PER_MTOK_USD, 15)
      },
      "claude-opus": {
        input: parseUsdEnv(env.COST_CLAUDE_OPUS_INPUT_PER_MTOK_USD, 15),
        output: parseUsdEnv(env.COST_CLAUDE_OPUS_OUTPUT_PER_MTOK_USD, 75)
      }
    }
  };
}

export function estimateTokensFromText(text: string | undefined): number {
  if (!text) {
    return 0;
  }

  return Math.ceil(text.length / 4);
}

export function estimateProviderCostUsd(
  model: ModelAlias,
  usage: CostUsage,
  config = createCostConfig()
): number {
  if (model === "mock-fast") {
    return 0;
  }

  const rates = config.perMillionTokensUsd[model];
  const inputTokens = usage.inputTokens ?? estimateTokensFromText(usage.inputText);
  const outputTokens = usage.outputTokens ?? estimateTokensFromText(usage.outputText);
  const cost =
    (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;

  return formatUsdNumber(cost);
}

export function estimateMarginUsd(chargedUsd: number, estimatedProviderCostUsd: number): number {
  return formatUsdNumber(chargedUsd - estimatedProviderCostUsd);
}
