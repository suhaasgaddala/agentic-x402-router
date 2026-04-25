import { HttpError } from "../errors/httpError.js";
import type {
  MarketSignalData,
  MarketSignalInput,
  MarketSignalProvider,
  MarketSignalResult,
  PoolActivity,
  SupportedChain,
  SupportedSignal
} from "./types.js";

type DexScreenerWindow = "m5" | "h1" | "h6" | "h24";

interface DexScreenerPair {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  liquidity?: {
    usd?: number | null;
  } | null;
  volume?: Partial<Record<DexScreenerWindow, number | null>>;
  priceChange?: Partial<Record<DexScreenerWindow, number | null>>;
  txns?: Partial<Record<DexScreenerWindow, { buys?: number | null; sells?: number | null }>>;
}

interface DexScreenerPairResponse {
  pairs?: DexScreenerPair[] | null;
}

export interface DexScreenerMarketSignalProviderOptions {
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

const chainMap: Record<SupportedChain, string> = {
  base: "base",
  ethereum: "ethereum",
  solana: "solana",
  arbitrum: "arbitrum",
  optimism: "optimism",
  polygon: "polygon"
};

const timeframeMap: Record<MarketSignalInput["timeframe"], DexScreenerWindow> = {
  "5m": "m5",
  "15m": "h1",
  "1h": "h1",
  "4h": "h6",
  "24h": "h24"
};

const signalKeys: Record<SupportedSignal, (keyof MarketSignalData)[]> = {
  liquidity: ["liquidity_usd"],
  volume: ["volume_usd", "volume_change_pct"],
  price_change: ["price_change_pct"],
  price_impact: ["price_impact_estimate_pct"],
  pool_activity: ["pool_activity"],
  wallet_flows: ["wallet_flow"]
};

function roundNumber(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function selectHighestLiquidityPair(pairs: DexScreenerPair[]): DexScreenerPair | undefined {
  return pairs
    .filter((pair) => pair != null)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

function estimatePriceImpactFromLiquidity(liquidityUsd: number | null): number | null {
  if (!liquidityUsd || liquidityUsd <= 0) {
    return null;
  }

  const estimate = Math.min(5, (1_000 / liquidityUsd) * 100);
  return roundNumber(Math.max(0.01, estimate), 2);
}

function derivePoolActivity(pair: DexScreenerPair, window: DexScreenerWindow): PoolActivity | null {
  const txns = pair.txns?.[window];
  const total = (txns?.buys ?? 0) + (txns?.sells ?? 0);

  if (!Number.isFinite(total)) {
    return null;
  }

  if (total < 10) return "low";
  if (total < 50) return "moderate";
  if (total < 200) return "elevated";
  return "high";
}

function buildAllSignals(pair: DexScreenerPair, window: DexScreenerWindow): MarketSignalData {
  const liquidityUsd = getNumber(pair.liquidity?.usd);

  return {
    liquidity_usd: liquidityUsd,
    volume_usd: getNumber(pair.volume?.[window]),
    volume_change_pct: null,
    price_change_pct: getNumber(pair.priceChange?.[window]),
    price_impact_estimate_pct: estimatePriceImpactFromLiquidity(liquidityUsd),
    pool_activity: derivePoolActivity(pair, window),
    wallet_flow: "neutral"
  };
}

function filterSignals(
  all: MarketSignalData,
  requested: SupportedSignal[]
): Partial<MarketSignalData> {
  const out: Partial<MarketSignalData> = {};
  for (const signal of requested) {
    for (const key of signalKeys[signal]) {
      out[key] = all[key] as never;
    }
  }
  return out;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function buildSummary(signals: Partial<MarketSignalData>, timeframe: string): string {
  const parts: string[] = [];

  if (signals.liquidity_usd != null) {
    parts.push(`liquidity at ${formatUsd(signals.liquidity_usd)}`);
  }

  if (signals.volume_usd != null) {
    parts.push(`volume at ${formatUsd(signals.volume_usd)} over the ${timeframe} window`);
  }

  if (signals.price_change_pct != null) {
    const direction = signals.price_change_pct >= 0 ? "increased" : "decreased";
    parts.push(`price ${direction} ${Math.abs(signals.price_change_pct)}% over the window`);
  }

  if (signals.price_impact_estimate_pct != null) {
    parts.push(`estimated price impact from liquidity is ~${signals.price_impact_estimate_pct}%`);
  }

  if (signals.pool_activity != null) {
    parts.push(`pool activity ${signals.pool_activity}`);
  }

  if (signals.wallet_flow != null) {
    parts.push("wallet flow unavailable from this data source");
  }

  return parts.length > 0 ? `${parts.join("; ")}.` : "no requested fields available from the data source.";
}

export class DexScreenerMarketSignalProvider implements MarketSignalProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DexScreenerMarketSignalProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  canHandle(chain: SupportedChain): boolean {
    return chain in chainMap;
  }

  async fetchSignals(input: MarketSignalInput): Promise<MarketSignalResult> {
    const chainId = chainMap[input.chain];
    const window = timeframeMap[input.timeframe];
    const pair = input.pool
      ? await this.fetchExplicitPair(chainId, input.pool)
      : await this.fetchBestTokenPair(chainId, input.token);

    const allSignals = buildAllSignals(pair, window);
    const signals = filterSignals(allSignals, input.signals);

    return {
      dataSource: "dexscreener",
      signals,
      summary: buildSummary(signals, input.timeframe)
    };
  }

  private async fetchExplicitPair(chainId: string, pairId: string): Promise<DexScreenerPair> {
    const response = await this.fetchJson<DexScreenerPairResponse>(
      `/latest/dex/pairs/${encodeURIComponent(chainId)}/${encodeURIComponent(pairId)}`
    );
    const pair = selectHighestLiquidityPair(response.pairs ?? []);
    if (!pair) {
      throw new HttpError({
        statusCode: 502,
        code: "PROVIDER_ERROR",
        message: "DexScreener returned no pairs for the requested pool."
      });
    }

    return pair;
  }

  private async fetchBestTokenPair(chainId: string, token: string): Promise<DexScreenerPair> {
    const pairs = await this.fetchJson<DexScreenerPair[]>(
      `/token-pairs/v1/${encodeURIComponent(chainId)}/${encodeURIComponent(token)}`
    );
    const pair = selectHighestLiquidityPair(Array.isArray(pairs) ? pairs : []);
    if (!pair) {
      throw new HttpError({
        statusCode: 502,
        code: "PROVIDER_ERROR",
        message: "DexScreener returned no pairs for the requested token."
      });
    }

    return pair;
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new HttpError({
          statusCode: 502,
          code: "PROVIDER_ERROR",
          message: `DexScreener request failed with status ${response.status}.`
        });
      }

      return (await response.json()) as T;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new HttpError({
          statusCode: 504,
          code: "PROVIDER_TIMEOUT",
          message: "DexScreener request timed out."
        });
      }

      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError({
        statusCode: 502,
        code: "PROVIDER_ERROR",
        message: "DexScreener request failed.",
        cause: error
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
