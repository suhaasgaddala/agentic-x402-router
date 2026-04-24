import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import type { ModelAlias } from "../providers/types.js";

export const bazaarTags = [
  "llm",
  "inference",
  "model access",
  "claude",
  "anthropic",
  "chat completion",
  "text generation",
  "summarization",
  "code",
  "reasoning",
  "agent tools",
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
    "Pay-per-call x402 model gateway for agent-accessible LLM inference. Supports Claude-oriented chat/text generation aliases through a simple JSON messages API. Useful for summarization, coding help, planning, reasoning, extraction, and general text generation.",
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
        provider: "mock",
        text: "Concise model output appears here.",
        usage: {
          input_tokens: 1234,
          output_tokens: 456,
          estimated_provider_cost_usd: 0.010542,
          charged_usd: 0.05,
          estimated_margin_usd: 0.039458
        },
        timing: { latency_ms: 1234 }
      }
    }
  });
}
