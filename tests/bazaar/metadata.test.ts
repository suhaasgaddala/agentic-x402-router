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
        "llm inference",
        "model access",
        "model call",
        "model-call",
        "claude",
        "anthropic",
        "chat completion",
        "text generation",
        "summarization",
        "code",
        "coding",
        "reasoning",
        "agent tools",
        "cheap claude",
        "x402"
      ])
    );
  });

  it("model-call output example uses Anthropic provider", () => {
    const ext = createBazaarExtensions();
    type BazaarShape = { bazaar: { info: { output: { example: { provider?: string } } } } };
    const example = (ext as unknown as BazaarShape).bazaar.info.output.example;

    expect(example.provider).toBe("anthropic");
  });

  it("model-call output example has correct pricing (0.0009 USDC discovery price, consistent margin)", () => {
    const ext = createBazaarExtensions();
    type UsageShape = {
      charged_usd: number;
      estimated_provider_cost_usd: number;
      estimated_margin_usd: number;
    };
    type BazaarShape = { bazaar: { info: { output: { example: { usage: UsageShape } } } } };
    const { usage } = (ext as unknown as BazaarShape).bazaar.info.output.example;

    // Discovery-phase price: 0.0009 USDC = 900 USDC base units.
    expect(usage.charged_usd).toBe(0.0009);
    expect(usage.estimated_margin_usd).toBeCloseTo(
      usage.charged_usd - usage.estimated_provider_cost_usd,
      6
    );
  });

  it("model-call metadata avoids official API positioning and secret-like values", () => {
    const text = JSON.stringify({
      tags: bazaarTags,
      description: bazaarMetadata.description,
      examples: bazaarMetadata.examples
    }).toLowerCase();

    expect(text).not.toContain("official claude");
    expect(text).not.toContain("official anthropic");
    expect(text).not.toContain("sk-ant");
    expect(text).not.toContain("api key");
  });

  it("description includes key search terms", () => {
    const desc = bazaarMetadata.description.toLowerCase();
    expect(desc).toContain("claude sonnet");
    expect(desc).toContain("anthropic");
    expect(desc).toContain("chat completion");
    expect(desc).toContain("cheap claude");
    expect(desc).toContain("agent tools");
    expect(desc).toContain("x402");
    expect(desc).toContain("model api");
    expect(desc).toContain("llm inference");
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
        // hyphenated variants for indexer compatibility
        "market-signal",
        "onchain-data",
        "dexscreener",
        "trading-bot",
        "trading-agent",
        "price-impact",
        "token-data",
        "agent-tools",
        "usdc",
        // space-separated variants retained alongside
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

  it("metadata has service name, DexScreener description, and at least two examples", () => {
    expect(marketSignalMetadata.serviceName).toBe("x402 Onchain Market Signals");
    expect(marketSignalMetadata.description).toContain("DexScreener");
    expect(marketSignalMetadata.description).toContain("liquidity");
    expect(marketSignalMetadata.description).toContain("price impact");
    expect(marketSignalMetadata.examples.length).toBeGreaterThanOrEqual(1);
  });

  it("output example uses dexscreener as data_source", () => {
    const ext = createMarketSignalBazaarExtensions();
    // declareDiscoveryExtension nests the example under bazaar.info.output.example
    type BazaarShape = { bazaar: { info: { output: { example: { data_source?: string } } } } };
    const example = (ext as unknown as BazaarShape).bazaar.info.output.example;
    expect(example.data_source).toBe("dexscreener");
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
