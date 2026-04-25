import { describe, expect, it } from "vitest";
import { MockMarketSignalProvider } from "../../src/market/mock.js";
import { MARKET_SIGNAL_DISCLAIMER } from "../../src/routes/marketSignal.js";
import type { SupportedChain, SupportedSignal, SupportedTimeframe } from "../../src/market/types.js";

const BANNED_WORDS =
  /\b(buy|sell|bullish|bearish|entry|exit|alpha|ape|long|short|profit|guaranteed|financial\s+advice)\b/i;

const BASE_INPUT = {
  requestId: "req_test",
  chain: "base" as SupportedChain,
  token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  timeframe: "1h" as SupportedTimeframe,
  signals: ["liquidity", "volume", "price_change", "price_impact", "pool_activity", "wallet_flows"] as SupportedSignal[]
};

describe("MockMarketSignalProvider", () => {
  const provider = new MockMarketSignalProvider();

  it("handles all supported chains", () => {
    const chains: SupportedChain[] = ["base", "ethereum", "solana", "arbitrum", "optimism", "polygon"];
    for (const chain of chains) {
      expect(provider.canHandle(chain)).toBe(true);
    }
  });

  it("returns deterministic output for the same input", async () => {
    const a = await provider.fetchSignals(BASE_INPUT);
    const b = await provider.fetchSignals(BASE_INPUT);

    expect(a.signals).toEqual(b.signals);
    expect(a.summary).toBe(b.summary);
    expect(a.dataSource).toBe("mock");
  });

  it("produces different values for different tokens", async () => {
    const a = await provider.fetchSignals(BASE_INPUT);
    const b = await provider.fetchSignals({
      ...BASE_INPUT,
      token: "0xaAaAaAaaAaAaAaaAaAaAaaAaAaAaaAaAaAaaAa00"
    });

    expect(a.signals).not.toEqual(b.signals);
  });

  it("only populates signal keys that were requested", async () => {
    const result = await provider.fetchSignals({
      ...BASE_INPUT,
      signals: ["liquidity", "wallet_flows"]
    });

    expect(result.signals).toHaveProperty("liquidity_usd");
    expect(result.signals).toHaveProperty("wallet_flow");
    expect(result.signals).not.toHaveProperty("volume_usd");
    expect(result.signals).not.toHaveProperty("price_change_pct");
    expect(result.signals).not.toHaveProperty("price_impact_estimate_pct");
    expect(result.signals).not.toHaveProperty("pool_activity");
  });

  it("populates both volume keys when volume signal is requested", async () => {
    const result = await provider.fetchSignals({ ...BASE_INPUT, signals: ["volume"] });

    expect(result.signals).toHaveProperty("volume_usd");
    expect(result.signals).toHaveProperty("volume_change_pct");
    expect(typeof result.signals.volume_usd).toBe("number");
    expect(typeof result.signals.volume_change_pct).toBe("number");
  });

  it("summary is a non-empty string", async () => {
    const result = await provider.fetchSignals(BASE_INPUT);
    expect(typeof result.summary).toBe("string");
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("summary contains no buy/sell/advice language", async () => {
    const signals: SupportedSignal[][] = [
      ["liquidity"],
      ["volume"],
      ["price_change"],
      ["price_impact"],
      ["pool_activity"],
      ["wallet_flows"],
      ["liquidity", "volume", "price_change", "price_impact", "pool_activity", "wallet_flows"]
    ];

    for (const sigs of signals) {
      const result = await provider.fetchSignals({ ...BASE_INPUT, signals: sigs });
      expect(BANNED_WORDS.test(result.summary)).toBe(false);
    }
  });

  it("data_source is always 'mock'", async () => {
    const result = await provider.fetchSignals(BASE_INPUT);
    expect(result.dataSource).toBe("mock");
  });

  it("disclaimer constant contains the required text", () => {
    expect(MARKET_SIGNAL_DISCLAIMER).toContain("informational only");
    expect(MARKET_SIGNAL_DISCLAIMER).toContain("do not constitute financial advice");
  });
});
