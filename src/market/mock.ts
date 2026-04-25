import type {
  MarketSignalData,
  MarketSignalInput,
  MarketSignalProvider,
  MarketSignalResult,
  PoolActivity,
  SupportedChain,
  SupportedSignal,
  WalletFlow
} from "./types.js";

// Deterministic hash — same input always produces the same seed, no randomness.
function simpleHash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash;
}

function deriveFloat(seed: number, min: number, max: number, decimals: number): number {
  const raw = min + ((seed % 10_000) / 10_000) * (max - min);
  const factor = Math.pow(10, decimals);
  return Math.round(raw * factor) / factor;
}

function deriveChoice<T>(seed: number, choices: readonly T[]): T {
  return choices[seed % choices.length];
}

function generateAllData(chain: string, token: string, timeframe: string): MarketSignalData {
  const base = `${chain}:${token}:${timeframe}`;
  const h = (suffix: string) => simpleHash(base + suffix);

  return {
    liquidity_usd: deriveFloat(h(":liq"), 50_000, 10_000_000, 0),
    volume_usd: deriveFloat(h(":vol"), 10_000, 2_000_000, 0),
    volume_change_pct: deriveFloat(h(":volchg"), -60, 150, 1),
    price_change_pct: deriveFloat(h(":pxchg"), -15, 25, 2),
    price_impact_estimate_pct: deriveFloat(h(":impact"), 0.05, 3.5, 2),
    pool_activity: deriveChoice<PoolActivity>(h(":pool"), ["low", "moderate", "elevated", "high"]),
    wallet_flow: deriveChoice<WalletFlow>(h(":flow"), ["net_inflow", "net_outflow", "neutral"])
  };
}

// Maps each requested signal name to the data keys it populates in the response.
const SIGNAL_TO_KEYS: Record<SupportedSignal, (keyof MarketSignalData)[]> = {
  liquidity: ["liquidity_usd"],
  volume: ["volume_usd", "volume_change_pct"],
  price_change: ["price_change_pct"],
  price_impact: ["price_impact_estimate_pct"],
  pool_activity: ["pool_activity"],
  wallet_flows: ["wallet_flow"]
};

function buildFilteredSignals(
  all: MarketSignalData,
  requested: SupportedSignal[]
): Partial<MarketSignalData> {
  const out: Partial<MarketSignalData> = {};
  for (const signal of requested) {
    for (const key of SIGNAL_TO_KEYS[signal]) {
      (out as Record<string, unknown>)[key] = all[key];
    }
  }
  return out;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// Builds a plain-English observation string from the signal values.
// Keep the language observational and avoid recommendations or projected outcomes.
function buildSummary(signals: Partial<MarketSignalData>, timeframe: string): string {
  const parts: string[] = [];

  if (signals.liquidity_usd != null) {
    parts.push(`liquidity at ${formatUsd(signals.liquidity_usd)}`);
  }

  if (signals.volume_usd != null) {
    const vol = formatUsd(signals.volume_usd);
    if (signals.volume_change_pct != null) {
      const dir = signals.volume_change_pct >= 0 ? "up" : "down";
      parts.push(
        `volume ${vol} (${dir} ${Math.abs(signals.volume_change_pct)}% over the ${timeframe} window)`
      );
    } else {
      parts.push(`volume at ${vol}`);
    }
  }

  if (signals.price_change_pct != null) {
    const dir = signals.price_change_pct >= 0 ? "up" : "down";
    parts.push(`price moved ${dir} ${Math.abs(signals.price_change_pct)}% over the window`);
  }

  if (signals.price_impact_estimate_pct != null) {
    const pct = signals.price_impact_estimate_pct;
    const level = pct < 0.5 ? "low" : pct < 1.5 ? "moderate" : "elevated";
    parts.push(`estimated price impact ${level} at ~${pct}%`);
  }

  if (signals.pool_activity != null) {
    parts.push(`pool activity ${signals.pool_activity}`);
  }

  if (signals.wallet_flow != null) {
    const desc: Record<string, string> = {
      net_inflow: "net wallet inflow observed",
      net_outflow: "net wallet outflow observed",
      neutral: "wallet flows neutral"
    };
    parts.push(desc[signals.wallet_flow] ?? signals.wallet_flow);
  }

  return parts.length > 0 ? parts.join("; ") + "." : "no signals requested.";
}

export class MockMarketSignalProvider implements MarketSignalProvider {
  canHandle(_chain: SupportedChain): boolean {
    return true;
  }

  async fetchSignals(input: MarketSignalInput): Promise<MarketSignalResult> {
    const all = generateAllData(input.chain, input.token, input.timeframe);
    const signals = buildFilteredSignals(all, input.signals);
    const summary = buildSummary(signals, input.timeframe);

    return {
      dataSource: "mock",
      signals,
      summary
    };
  }
}
