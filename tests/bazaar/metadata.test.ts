import { describe, expect, it } from "vitest";
import {
  bazaarMetadata,
  bazaarModelAliases,
  bazaarTags,
  createBazaarExtensions,
  createMarketSignalBazaarExtensions,
  marketSignalInputSchema,
  marketSignalMetadata,
  marketSignalOutputSchema,
  marketSignalTags,
  modelCallInputSchema,
  modelCallOutputSchema
} from "../../src/bazaar/metadata.js";

describe("bazaar metadata", () => {
  it("contains discovery tags", () => {
    expect(bazaarTags).toEqual(
      expect.arrayContaining([
        "llm",
        "inference",
        "model access",
        "claude",
        "anthropic",
        "chat completion",
        "text generation",
        "summarization",
        "code",
        "reasoning",
        "agent tools"
      ])
    );
  });

  it("includes model list and examples", () => {
    expect(bazaarModelAliases).toEqual(["claude-haiku", "claude-sonnet", "claude-opus", "mock-fast"]);
    expect(bazaarMetadata.examples).toHaveLength(3);
  });

  it("exposes input and output schemas", () => {
    expect(modelCallInputSchema.properties).toHaveProperty("messages");
    expect(modelCallOutputSchema.properties).toHaveProperty("usage");
  });

  it("creates a Bazaar discovery extension", () => {
    expect(createBazaarExtensions()).toHaveProperty("bazaar");
  });
});

describe("market signal bazaar metadata", () => {
  it("contains required discovery tags", () => {
    expect(marketSignalTags).toEqual(
      expect.arrayContaining([
        "onchain data",
        "trading",
        "market data",
        "token data",
        "base",
        "dex",
        "liquidity",
        "volume",
        "price impact",
        "wallet flows",
        "trading bot",
        "agent",
        "x402",
        "crypto",
        "defi",
        "market signals"
      ])
    );
  });

  it("metadata has service name, description, and at least two examples", () => {
    expect(marketSignalMetadata.serviceName).toBe("x402 Onchain Market Signals");
    expect(typeof marketSignalMetadata.description).toBe("string");
    expect(marketSignalMetadata.examples.length).toBeGreaterThanOrEqual(1);
  });

  it("input schema has required token and signals fields", () => {
    expect(marketSignalInputSchema.properties).toHaveProperty("token");
    expect(marketSignalInputSchema.properties).toHaveProperty("signals");
    expect(marketSignalInputSchema.required).toContain("token");
    expect(marketSignalInputSchema.required).toContain("signals");
  });

  it("output schema has all required envelope fields", () => {
    expect(marketSignalOutputSchema.properties).toHaveProperty("ok");
    expect(marketSignalOutputSchema.properties).toHaveProperty("signals");
    expect(marketSignalOutputSchema.properties).toHaveProperty("disclaimer");
    expect(marketSignalOutputSchema.required).toContain("disclaimer");
  });

  it("creates a Bazaar discovery extension for market signal", () => {
    expect(createMarketSignalBazaarExtensions()).toHaveProperty("bazaar");
  });
});
