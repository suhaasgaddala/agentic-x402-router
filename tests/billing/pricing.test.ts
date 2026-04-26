import { describe, expect, it } from "vitest";
import { createPriceConfig, getPriceForModel } from "../../src/billing/pricing.js";

describe("pricing", () => {
  it("returns default prices", () => {
    const config = createPriceConfig({});

    // 0.001 is the discovery-phase price for Agentic.Market volume testing (1000 USDC base units).
    // Anthropic Sonnet provider cost can exceed this for larger outputs.
    expect(getPriceForModel("claude-haiku", config)).toBe(0.001);
    expect(getPriceForModel("claude-sonnet", config)).toBe(0.001);
    expect(getPriceForModel("claude-opus", config)).toBe(0.2);
    expect(getPriceForModel("mock-fast", config)).toBe(0.001);
  });

  it("supports env overrides", () => {
    const config = createPriceConfig({
      PRICE_CLAUDE_SONNET_USD: "0.1234567"
    });

    expect(getPriceForModel("claude-sonnet", config)).toBe(0.123457);
  });
});
