import type { SupportedChain, SupportedSignal, SupportedTimeframe } from "../schemas/marketSignal.js";

export type { SupportedChain, SupportedSignal, SupportedTimeframe };

export interface MarketSignalInput {
  requestId: string;
  chain: SupportedChain;
  token: string;
  timeframe: SupportedTimeframe;
  signals: SupportedSignal[];
  pool?: string;
}

export type PoolActivity = "low" | "moderate" | "elevated" | "high";
export type WalletFlow = "net_inflow" | "net_outflow" | "neutral";

export interface MarketSignalData {
  liquidity_usd: number | null;
  volume_usd: number | null;
  volume_change_pct: number | null;
  price_change_pct: number | null;
  price_impact_estimate_pct: number | null;
  pool_activity: PoolActivity | null;
  wallet_flow: WalletFlow | null;
}

export interface MarketSignalResult {
  dataSource: string;
  signals: Partial<MarketSignalData>;
  summary: string;
}

export interface MarketSignalProvider {
  canHandle(chain: SupportedChain): boolean;
  fetchSignals(input: MarketSignalInput): Promise<MarketSignalResult>;
}
