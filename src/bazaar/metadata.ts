// Keep all Bazaar x402 package coupling centralized in this metadata module.
// Every endpoint's discovery metadata, input/output schemas, and Bazaar extension
// factory functions live here so Bazaar-related changes have one place to land.
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import type { ModelAlias } from "../providers/types.js";
import {
  SUPPORTED_CHAINS,
  SUPPORTED_SIGNALS,
  SUPPORTED_TIMEFRAMES
} from "../schemas/marketSignal.js";

export const bazaarTags = [
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
] as const;

export const bazaarModelAliases: ModelAlias[] = [
  "claude-haiku",
  "claude-sonnet",
  "claude-opus",
  "mock-fast"
];

export const modelCallInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    model: {
      type: "string",
      enum: bazaarModelAliases,
      default: "claude-sonnet"
    },
    messages: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          role: { type: "string", enum: ["system", "user", "assistant"] },
          content: { type: "string", minLength: 1 }
        },
        required: ["role", "content"]
      }
    },
    max_tokens: { type: "integer", minimum: 1, default: 1000 },
    temperature: { type: "number", minimum: 0, maximum: 1, default: 0.2 },
    metadata: { type: "object", additionalProperties: true }
  },
  required: ["messages"]
} as const;

export const modelCallOutputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ok: { type: "boolean", const: true },
    id: { type: "string" },
    model: { type: "string", enum: bazaarModelAliases },
    provider: { type: "string" },
    text: { type: "string" },
    usage: {
      type: "object",
      properties: {
        input_tokens: { type: "number" },
        output_tokens: { type: "number" },
        estimated_provider_cost_usd: { type: "number" },
        charged_usd: { type: "number" },
        estimated_margin_usd: { type: "number" }
      },
      required: [
        "input_tokens",
        "output_tokens",
        "estimated_provider_cost_usd",
        "charged_usd",
        "estimated_margin_usd"
      ]
    },
    timing: {
      type: "object",
      properties: {
        latency_ms: { type: "number" }
      },
      required: ["latency_ms"]
    }
  },
  required: ["ok", "id", "model", "provider", "text", "usage", "timing"]
} as const;

export const bazaarMetadata = {
  serviceName: "x402 Model Gateway",
  route: "POST /v1/model-call",
  category: "inference",
  mimeType: "application/json",
  tags: bazaarTags,
  description:
    "Pay-per-call x402 model gateway for agent-accessible Claude-backed LLM inference. Supports Anthropic Claude Sonnet, Haiku, and Opus through a simple model API and JSON messages interface. Useful for chat completion, text generation, summarization, coding help, planning, reasoning, extraction, agent tools, and cheap Claude model access through x402.",
  models: bazaarModelAliases,
  pricing: {
    type: "fixed",
    currency: "USD",
    unit: "call"
  },
  examples: [
    {
      name: "summarize",
      input: {
        model: "claude-sonnet",
        messages: [{ role: "user", content: "Summarize this launch note in five bullets: ..." }],
        max_tokens: 500,
        temperature: 0.2,
        metadata: { task: "summarization" }
      }
    },
    {
      name: "code",
      input: {
        model: "claude-sonnet",
        messages: [{ role: "user", content: "Review this TypeScript diff for correctness risks: ..." }],
        max_tokens: 800,
        temperature: 0.1,
        metadata: { task: "code-review" }
      }
    },
    {
      name: "reasoning",
      input: {
        model: "claude-haiku",
        messages: [{ role: "user", content: "Compare these two rollout plans and recommend one: ..." }],
        max_tokens: 700,
        temperature: 0.2,
        metadata: { task: "planning" }
      }
    }
  ]
} as const;

export function createBazaarExtensions() {
  return declareDiscoveryExtension({
    bodyType: "json",
    input: bazaarMetadata.examples[0].input,
    inputSchema: modelCallInputSchema,
    output: {
      schema: modelCallOutputSchema,
      example: {
        ok: true,
        id: "req_example",
        model: "claude-sonnet",
        provider: "anthropic",
        text: "Concise model output appears here.",
        usage: {
          input_tokens: 1234,
          output_tokens: 456,
          estimated_provider_cost_usd: 0.010542,
          charged_usd: 0.04,
          estimated_margin_usd: 0.029458
        },
        timing: { latency_ms: 1234 }
      }
    }
  });
}

// ─── Market Signal endpoint ────────────────────────────────────────────────

export const marketSignalTags = [
  "market-signal",
  "onchain-data",
  "dexscreener",
  "trading-bot",
  "trading-agent",
  "price-impact",
  "token-data",
  "agent-tools",
  "usdc",
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
] as const;

export const marketSignalInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    chain: {
      type: "string",
      enum: [...SUPPORTED_CHAINS],
      default: "base"
    },
    token: {
      type: "string",
      description: "EVM address (0x + 40 hex chars) or Solana pubkey (32–44 base58 chars)"
    },
    timeframe: {
      type: "string",
      enum: [...SUPPORTED_TIMEFRAMES],
      default: "1h"
    },
    signals: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", enum: [...SUPPORTED_SIGNALS] }
    },
    pool: {
      type: "string",
      description: "Optional specific DEX pool address (same format as token)"
    },
    metadata: { type: "object", additionalProperties: true }
  },
  required: ["token", "signals"]
} as const;

export const marketSignalOutputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ok: { type: "boolean", const: true },
    id: { type: "string" },
    chain: { type: "string" },
    token: { type: "string" },
    timeframe: { type: "string" },
    data_source: { type: "string" },
    summary: { type: "string" },
    signals: {
      type: "object",
      properties: {
        liquidity_usd: { type: ["number", "null"] },
        volume_usd: { type: ["number", "null"] },
        volume_change_pct: { type: ["number", "null"] },
        price_change_pct: { type: ["number", "null"] },
        price_impact_estimate_pct: { type: ["number", "null"] },
        pool_activity: { type: ["string", "null"], enum: ["low", "moderate", "elevated", "high", null] },
        wallet_flow: { type: ["string", "null"], enum: ["net_inflow", "net_outflow", "neutral", null] }
      }
    },
    usage: {
      type: "object",
      properties: {
        charged_usd: { type: "number" },
        estimated_provider_cost_usd: { type: "number" },
        estimated_margin_usd: { type: "number" }
      },
      required: ["charged_usd", "estimated_provider_cost_usd", "estimated_margin_usd"]
    },
    timing: {
      type: "object",
      properties: { latency_ms: { type: "number" } },
      required: ["latency_ms"]
    },
    disclaimer: { type: "string" }
  },
  required: [
    "ok",
    "id",
    "chain",
    "token",
    "timeframe",
    "data_source",
    "summary",
    "signals",
    "usage",
    "timing",
    "disclaimer"
  ]
} as const;

export const marketSignalMetadata = {
  serviceName: "x402 Onchain Market Signals",
  route: "POST /v1/market-signal",
  category: "market-data",
  mimeType: "application/json",
  tags: marketSignalTags,
  description:
    "Pay-per-call DexScreener-powered onchain market signal API for agents and trading bots. " +
    "Returns token liquidity, volume, price impact estimates, pool activity, and market context.",
  pricing: {
    type: "fixed",
    currency: "USD",
    unit: "call"
  },
  examples: [
    {
      name: "base-token-1h",
      input: {
        chain: "base",
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        timeframe: "1h",
        signals: ["liquidity", "volume", "price_impact", "wallet_flows"]
      }
    },
    {
      name: "ethereum-full-24h",
      input: {
        chain: "ethereum",
        token: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        timeframe: "24h",
        signals: ["liquidity", "volume", "price_change", "price_impact", "pool_activity", "wallet_flows"]
      }
    }
  ]
} as const;

export function createMarketSignalBazaarExtensions() {
  return declareDiscoveryExtension({
    bodyType: "json",
    input: marketSignalMetadata.examples[0].input,
    inputSchema: marketSignalInputSchema,
    output: {
      schema: marketSignalOutputSchema,
      example: {
        ok: true,
        id: "req_example",
        chain: "base",
        token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        timeframe: "1h",
        data_source: "dexscreener",
        summary:
          "liquidity at $1.2M; volume $450K (up 42.5% over the 1h window); estimated price impact moderate at ~0.8%; net wallet inflow observed.",
        signals: {
          liquidity_usd: 1200000,
          volume_usd: 450000,
          volume_change_pct: 42.5,
          price_impact_estimate_pct: 0.8,
          wallet_flow: "net_inflow"
        },
        usage: {
          charged_usd: 0.02,
          estimated_provider_cost_usd: 0.005,
          estimated_margin_usd: 0.015
        },
        timing: { latency_ms: 12 },
        disclaimer:
          "Market signals are informational only and do not constitute financial advice."
      }
    }
  });
}
