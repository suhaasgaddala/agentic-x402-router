import { describe, expect, it } from "vitest";
import { createMarketSignalSchema } from "../../src/schemas/marketSignal.js";

const schema = createMarketSignalSchema();

const VALID_EVM_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const VALID_SOL_TOKEN = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

describe("marketSignal schema", () => {
  it("accepts a fully specified valid request", () => {
    const parsed = schema.parse({
      chain: "base",
      token: VALID_EVM_TOKEN,
      timeframe: "1h",
      signals: ["liquidity", "volume"]
    });

    expect(parsed.chain).toBe("base");
    expect(parsed.token).toBe(VALID_EVM_TOKEN);
    expect(parsed.timeframe).toBe("1h");
    expect(parsed.signals).toEqual(["liquidity", "volume"]);
  });

  it("applies default chain and timeframe when omitted", () => {
    const parsed = schema.parse({
      token: VALID_EVM_TOKEN,
      signals: ["liquidity"]
    });

    expect(parsed.chain).toBe("base");
    expect(parsed.timeframe).toBe("1h");
  });

  it("deduplicates signals", () => {
    const parsed = schema.parse({
      token: VALID_EVM_TOKEN,
      signals: ["liquidity", "volume", "liquidity", "volume"]
    });

    expect(parsed.signals).toEqual(["liquidity", "volume"]);
  });

  it("accepts a Solana pubkey token", () => {
    const parsed = schema.parse({
      chain: "solana",
      token: VALID_SOL_TOKEN,
      timeframe: "4h",
      signals: ["price_change"]
    });

    expect(parsed.token).toBe(VALID_SOL_TOKEN);
    expect(parsed.chain).toBe("solana");
  });

  it("accepts an optional pool address", () => {
    const parsed = schema.parse({
      token: VALID_EVM_TOKEN,
      signals: ["liquidity"],
      pool: "0xaAaAaAaaAaAaAaaAaAaAaaAaAaAaaAaAaAaaAa00"
    });

    expect(parsed.pool).toBe("0xaAaAaAaaAaAaAaaAaAaAaaAaAaAaaAaAaAaaAa00");
  });

  it("rejects unsupported chain", () => {
    const result = schema.safeParse({
      chain: "tron",
      token: VALID_EVM_TOKEN,
      signals: ["liquidity"]
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported timeframe", () => {
    const result = schema.safeParse({
      token: VALID_EVM_TOKEN,
      timeframe: "7d",
      signals: ["liquidity"]
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported signal", () => {
    const result = schema.safeParse({
      token: VALID_EVM_TOKEN,
      signals: ["liquidity", "fake_signal"]
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid token format", () => {
    const result = schema.safeParse({
      token: "not-an-address",
      signals: ["liquidity"]
    });

    expect(result.success).toBe(false);
  });

  it("rejects a token that is too short to be EVM or Solana", () => {
    const result = schema.safeParse({
      token: "0xABCD",
      signals: ["liquidity"]
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty signals array", () => {
    const result = schema.safeParse({
      token: VALID_EVM_TOKEN,
      signals: []
    });

    expect(result.success).toBe(false);
  });

  it("rejects more than 6 signals", () => {
    const result = schema.safeParse({
      token: VALID_EVM_TOKEN,
      signals: ["liquidity", "volume", "price_change", "price_impact", "pool_activity", "wallet_flows", "liquidity"]
    });

    expect(result.success).toBe(false);
  });

  it("rejects requests with extra unknown fields (strict)", () => {
    const result = schema.safeParse({
      token: VALID_EVM_TOKEN,
      signals: ["liquidity"],
      unknownField: true
    });

    expect(result.success).toBe(false);
  });
});
