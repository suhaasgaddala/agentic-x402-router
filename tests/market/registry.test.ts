import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { loadConfig } from "../../src/config.js";
import { createApp } from "../../src/app.js";
import { createMarketSignalRegistry } from "../../src/market/index.js";
import { MockMarketSignalProvider } from "../../src/market/mock.js";

const TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("market signal registry", () => {
  it("defaults to mock", () => {
    const registry = createMarketSignalRegistry(loadConfig({ NODE_ENV: "test", X402_ENABLED: "false" }));

    expect(registry.getProviderForChain("base")).toBeInstanceOf(MockMarketSignalProvider);
  });

  it("selects DexScreener when configured", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([{ liquidity: { usd: 10_000 } }]));
    vi.stubGlobal("fetch", fetchMock);
    const registry = createMarketSignalRegistry(
      loadConfig({
        NODE_ENV: "test",
        X402_ENABLED: "false",
        MARKET_SIGNAL_PROVIDER: "dexscreener"
      })
    );
    const result = await registry.getProviderForChain("base").fetchSignals({
      requestId: "req_test",
      chain: "base",
      token: TOKEN,
      timeframe: "1h",
      signals: ["liquidity"]
    });

    expect(result.dataSource).toBe("dexscreener");
  });

  it("falls back to mock when DexScreener config is invalid", () => {
    const registry = createMarketSignalRegistry(
      loadConfig({
        NODE_ENV: "test",
        X402_ENABLED: "false",
        MARKET_SIGNAL_PROVIDER: "dexscreener",
        DEXSCREENER_BASE_URL: "ftp://invalid.example"
      })
    );

    expect(registry.getProviderForChain("base")).toBeInstanceOf(MockMarketSignalProvider);
  });

  it("falls back to mock when DexScreener returns no pairs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([])));
    const registry = createMarketSignalRegistry(
      loadConfig({
        NODE_ENV: "test",
        X402_ENABLED: "false",
        MARKET_SIGNAL_PROVIDER: "dexscreener"
      })
    );
    const result = await registry.getProviderForChain("base").fetchSignals({
      requestId: "req_test",
      chain: "base",
      token: TOKEN,
      timeframe: "1h",
      signals: ["liquidity"]
    });

    expect(result.dataSource).toBe("mock");
  });

  it("DexScreener provider cost appears in route usage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([{ liquidity: { usd: 10_000 } }])));
    const app = createApp(
      loadConfig({
        NODE_ENV: "test",
        X402_ENABLED: "false",
        MARKET_SIGNAL_PROVIDER: "dexscreener",
        COST_MARKET_SIGNAL_DEXSCREENER_USD: "0.004"
      })
    );

    await request(app)
      .post("/v1/market-signal")
      .send({ token: TOKEN, signals: ["liquidity"] })
      .expect(200)
      .expect((response) => {
        expect(response.body.data_source).toBe("dexscreener");
        expect(response.body.usage.estimated_provider_cost_usd).toBe(0.004);
      });
  });
});
