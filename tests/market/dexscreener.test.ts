import { describe, expect, it } from "vitest";
import { HttpError } from "../../src/errors/httpError.js";
import { DexScreenerMarketSignalProvider } from "../../src/market/dexscreener.js";
import type { MarketSignalInput } from "../../src/market/types.js";

const TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_INPUT: MarketSignalInput = {
  requestId: "req_test",
  chain: "base",
  token: TOKEN,
  timeframe: "1h",
  signals: ["liquidity", "volume", "price_change", "price_impact", "pool_activity", "wallet_flows"]
};

const BANNED_WORDS =
  /\b(buy|sell|bullish|bearish|entry|exit|alpha|ape|long|short|profit|edge|guaranteed|financial\s+advice)\b/i;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function createProvider(fetchImpl: typeof fetch) {
  return new DexScreenerMarketSignalProvider({
    baseUrl: "https://api.dexscreener.test",
    timeoutMs: 5,
    fetchImpl
  });
}

describe("DexScreenerMarketSignalProvider", () => {
  it("selects the highest-liquidity pair when no pool is supplied", async () => {
    const fetchImpl = async () =>
      jsonResponse([
        { pairAddress: "low", liquidity: { usd: 100 }, volume: { h1: 10 } },
        { pairAddress: "high", liquidity: { usd: 5000 }, volume: { h1: 50 } }
      ]);
    const result = await createProvider(fetchImpl as typeof fetch).fetchSignals({
      ...BASE_INPUT,
      signals: ["liquidity", "volume"]
    });

    expect(result.dataSource).toBe("dexscreener");
    expect(result.signals.liquidity_usd).toBe(5000);
    expect(result.signals.volume_usd).toBe(50);
  });

  it("uses the explicit pool endpoint when pool is supplied", async () => {
    const urls: string[] = [];
    const fetchImpl = async (url: string | URL | Request) => {
      urls.push(String(url));
      return jsonResponse({
        pairs: [{ pairAddress: "pool", liquidity: { usd: 2500 }, priceChange: { h1: 1.5 } }]
      });
    };
    const result = await createProvider(fetchImpl as typeof fetch).fetchSignals({
      ...BASE_INPUT,
      pool: "0x1111111111111111111111111111111111111111",
      signals: ["liquidity", "price_change"]
    });

    expect(urls[0]).toContain("/latest/dex/pairs/base/0x1111111111111111111111111111111111111111");
    expect(result.signals.liquidity_usd).toBe(2500);
    expect(result.signals.price_change_pct).toBe(1.5);
  });

  it("maps liquidity, volume, price change, price impact, and pool activity", async () => {
    const fetchImpl = async () =>
      jsonResponse([
        {
          liquidity: { usd: 200_000 },
          volume: { h1: 42_000 },
          priceChange: { h1: -2.25 },
          txns: { h1: { buys: 70, sells: 60 } }
        }
      ]);
    const result = await createProvider(fetchImpl as typeof fetch).fetchSignals(BASE_INPUT);

    expect(result.signals).toMatchObject({
      liquidity_usd: 200_000,
      volume_usd: 42_000,
      volume_change_pct: null,
      price_change_pct: -2.25,
      price_impact_estimate_pct: 0.5,
      pool_activity: "elevated",
      wallet_flow: "neutral"
    });
  });

  it("preserves requested signal filtering", async () => {
    const fetchImpl = async () =>
      jsonResponse([{ liquidity: { usd: 200_000 }, volume: { h1: 42_000 }, priceChange: { h1: 1 } }]);
    const result = await createProvider(fetchImpl as typeof fetch).fetchSignals({
      ...BASE_INPUT,
      signals: ["liquidity"]
    });

    expect(result.signals).toEqual({ liquidity_usd: 200_000 });
  });

  it("summary avoids recommendation language", async () => {
    const fetchImpl = async () =>
      jsonResponse([
        {
          liquidity: { usd: 200_000 },
          volume: { h1: 42_000 },
          priceChange: { h1: 2.25 },
          txns: { h1: { buys: 20, sells: 10 } }
        }
      ]);
    const result = await createProvider(fetchImpl as typeof fetch).fetchSignals(BASE_INPUT);

    expect(result.summary).toBeTruthy();
    expect(BANNED_WORDS.test(result.summary)).toBe(false);
  });

  it("handles empty pairs cleanly", async () => {
    const fetchImpl = async () => jsonResponse([]);

    await expect(createProvider(fetchImpl as typeof fetch).fetchSignals(BASE_INPUT)).rejects.toMatchObject({
      code: "PROVIDER_ERROR"
    });
  });

  it("handles timeout cleanly", async () => {
    const fetchImpl = ((_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      })) as typeof fetch;

    await expect(createProvider(fetchImpl).fetchSignals(BASE_INPUT)).rejects.toMatchObject({
      code: "PROVIDER_TIMEOUT"
    });
  });

  it("handles non-2xx responses cleanly", async () => {
    const fetchImpl = async () => jsonResponse({ error: "nope" }, 429);

    await expect(createProvider(fetchImpl as typeof fetch).fetchSignals(BASE_INPUT)).rejects.toBeInstanceOf(
      HttpError
    );
    await expect(createProvider(fetchImpl as typeof fetch).fetchSignals(BASE_INPUT)).rejects.toMatchObject({
      code: "PROVIDER_ERROR"
    });
  });
});
