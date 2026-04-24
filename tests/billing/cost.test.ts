import { describe, expect, it } from "vitest";
import {
  createCostConfig,
  estimateMarginUsd,
  estimateProviderCostUsd,
  estimateTokensFromText
} from "../../src/billing/cost.js";

describe("cost estimation", () => {
  it("estimates tokens from text", () => {
    expect(estimateTokensFromText("12345678")).toBe(2);
  });

  it("calculates provider cost from token usage", () => {
    const config = createCostConfig({});
    const cost = estimateProviderCostUsd(
      "claude-sonnet",
      {
        inputTokens: 1_000_000,
        outputTokens: 500_000
      },
      config
    );

    expect(cost).toBe(10.5);
  });

  it("returns zero provider cost for mock-fast", () => {
    expect(estimateProviderCostUsd("mock-fast", { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(0);
  });

  it("calculates margin", () => {
    expect(estimateMarginUsd(0.05, 0.010542)).toBe(0.039458);
  });
});
