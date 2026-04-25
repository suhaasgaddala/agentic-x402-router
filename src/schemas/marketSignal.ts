import { z } from "zod";

export const SUPPORTED_CHAINS = [
  "base",
  "ethereum",
  "solana",
  "arbitrum",
  "optimism",
  "polygon"
] as const;

export const SUPPORTED_TIMEFRAMES = ["5m", "15m", "1h", "4h", "24h"] as const;

export const SUPPORTED_SIGNALS = [
  "liquidity",
  "volume",
  "price_change",
  "price_impact",
  "pool_activity",
  "wallet_flows"
] as const;

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];
export type SupportedTimeframe = (typeof SUPPORTED_TIMEFRAMES)[number];
export type SupportedSignal = (typeof SUPPORTED_SIGNALS)[number];

// Accepts EVM hex address OR Solana base58 pubkey — format-validated only, not resolved on-chain.
const tokenAddressSchema = z.string().refine(
  (val) =>
    /^0x[0-9a-fA-F]{40}$/.test(val) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val),
  {
    message:
      "token must be a valid EVM address (0x + 40 hex chars) or Solana pubkey (32–44 base58 chars)"
  }
);

export function createMarketSignalSchema() {
  return z
    .object({
      chain: z.enum(SUPPORTED_CHAINS).default("base"),
      token: tokenAddressSchema,
      timeframe: z.enum(SUPPORTED_TIMEFRAMES).default("1h"),
      signals: z
        .array(z.enum(SUPPORTED_SIGNALS))
        .min(1, "at least one signal is required")
        .max(6, "at most 6 signals are allowed")
        .transform((arr) => [...new Set(arr)] as SupportedSignal[]),
      pool: tokenAddressSchema.optional(),
      metadata: z.record(z.unknown()).optional()
    })
    .strict();
}

export type ParsedMarketSignalRequest = z.infer<ReturnType<typeof createMarketSignalSchema>>;
