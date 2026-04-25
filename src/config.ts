import "dotenv/config";
import { z } from "zod";
import { createCostConfig } from "./billing/cost.js";
import { createPriceConfig } from "./billing/pricing.js";
import { isCdpFacilitatorUrl } from "./x402/config.js";

const optionalNonEmptyString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const booleanFromEnv = z
  .union([z.boolean(), z.string()])
  .optional()
  .default("false")
  .transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }

    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  });

const numberFromEnv = (fallback: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .default(String(fallback))
    .transform((value, ctx) => {
      const parsed = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Expected a finite number, received ${String(value)}`
        });
        return z.NEVER;
      }

      return parsed;
    });

const positiveIntegerFromEnv = (fallback: number) =>
  numberFromEnv(fallback).pipe(z.number().int().positive());

const marketSignalProviderSchema = z
  .enum(["mock", "dexscreener"])
  .optional()
  .default("mock");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: positiveIntegerFromEnv(3000),
  PUBLIC_BASE_URL: optionalNonEmptyString,

  X402_ENABLED: booleanFromEnv,
  X402_PAY_TO: optionalNonEmptyString,
  X402_NETWORK: z.string().trim().default("base-sepolia"),
  X402_FACILITATOR_URL: optionalNonEmptyString,
  X402_DEFAULT_PRICE_USD: numberFromEnv(0.05).pipe(z.number().nonnegative()),
  X402_RESOURCE_BASE_URL: optionalNonEmptyString,
  X402_SERVICE_NAME: z.string().trim().default("x402-model-gateway"),
  X402_SERVICE_DESCRIPTION: z
    .string()
    .trim()
    .default("x402-paid model gateway for agent-discoverable LLM inference"),
  CDP_API_KEY_ID: optionalNonEmptyString,
  CDP_API_KEY_SECRET: optionalNonEmptyString,

  ANTHROPIC_API_KEY: optionalNonEmptyString,

  MAX_INPUT_CHARS: positiveIntegerFromEnv(50_000),
  MAX_OUTPUT_TOKENS: positiveIntegerFromEnv(2_000),
  JSON_BODY_LIMIT: z.string().trim().default("1mb"),

  PRICE_MARKET_SIGNAL_USD: numberFromEnv(0.02).pipe(z.number().nonnegative()),
  COST_MARKET_SIGNAL_PROVIDER_USD: numberFromEnv(0.005).pipe(z.number().nonnegative()),
  MARKET_SIGNAL_PROVIDER: marketSignalProviderSchema,
  DEXSCREENER_BASE_URL: z.string().trim().default("https://api.dexscreener.com"),
  MARKET_SIGNAL_PROVIDER_TIMEOUT_MS: positiveIntegerFromEnv(5_000),
  COST_MARKET_SIGNAL_DEXSCREENER_USD: numberFromEnv(0).pipe(z.number().nonnegative())
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration: ${details.join("; ")}`);
  }

  const value = parsed.data;

  if (value.X402_ENABLED) {
    const missing = [
      ["X402_PAY_TO", value.X402_PAY_TO],
      ["X402_FACILITATOR_URL", value.X402_FACILITATOR_URL]
    ]
      .filter(([, envValue]) => !envValue)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`X402_ENABLED=true requires: ${missing.join(", ")}`);
    }

    if (isCdpFacilitatorUrl(value.X402_FACILITATOR_URL)) {
      const missingCdp = [
        ["CDP_API_KEY_ID", value.CDP_API_KEY_ID],
        ["CDP_API_KEY_SECRET", value.CDP_API_KEY_SECRET]
      ]
        .filter(([, envValue]) => !envValue)
        .map(([name]) => name);

      if (missingCdp.length > 0) {
        throw new Error(
          `CDP facilitator requires CDP_API_KEY_ID and CDP_API_KEY_SECRET. Missing: ${missingCdp.join(", ")}`
        );
      }
    }
  }

  return {
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    publicBaseUrl: value.PUBLIC_BASE_URL,
    anthropic: {
      apiKey: value.ANTHROPIC_API_KEY
    },
    maxInputChars: value.MAX_INPUT_CHARS,
    maxOutputTokens: value.MAX_OUTPUT_TOKENS,
    jsonBodyLimit: value.JSON_BODY_LIMIT,
    x402: {
      enabled: value.X402_ENABLED,
      payTo: value.X402_PAY_TO,
      network: value.X402_NETWORK,
      facilitatorUrl: value.X402_FACILITATOR_URL,
      defaultPriceUsd: value.X402_DEFAULT_PRICE_USD,
      resourceBaseUrl: value.X402_RESOURCE_BASE_URL ?? value.PUBLIC_BASE_URL,
      serviceName: value.X402_SERVICE_NAME,
      serviceDescription: value.X402_SERVICE_DESCRIPTION,
      cdp: {
        apiKeyId: value.CDP_API_KEY_ID,
        apiKeySecret: value.CDP_API_KEY_SECRET
      }
    },
    pricing: createPriceConfig(env),
    cost: createCostConfig(env),
    marketSignal: {
      priceUsd: value.PRICE_MARKET_SIGNAL_USD,
      providerCostUsd: value.COST_MARKET_SIGNAL_PROVIDER_USD,
      provider: value.MARKET_SIGNAL_PROVIDER,
      providerTimeoutMs: value.MARKET_SIGNAL_PROVIDER_TIMEOUT_MS,
      dexscreener: {
        baseUrl: value.DEXSCREENER_BASE_URL,
        providerCostUsd: value.COST_MARKET_SIGNAL_DEXSCREENER_USD
      }
    }
  };
}

export const config = loadConfig();
