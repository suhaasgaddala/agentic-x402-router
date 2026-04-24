import "dotenv/config";
import { z } from "zod";
import { createCostConfig } from "./billing/cost.js";
import { createPriceConfig } from "./billing/pricing.js";

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

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: positiveIntegerFromEnv(3000),
  PUBLIC_BASE_URL: optionalNonEmptyString,

  X402_ENABLED: booleanFromEnv,
  X402_PAY_TO: optionalNonEmptyString,
  X402_NETWORK: z.string().trim().default("base-sepolia"),
  X402_FACILITATOR_URL: optionalNonEmptyString,
  X402_DEFAULT_PRICE_USD: numberFromEnv(0.05).pipe(z.number().nonnegative()),

  ANTHROPIC_API_KEY: optionalNonEmptyString,

  MAX_INPUT_CHARS: positiveIntegerFromEnv(50_000),
  MAX_OUTPUT_TOKENS: positiveIntegerFromEnv(2_000),
  JSON_BODY_LIMIT: z.string().trim().default("1mb"),
  LOG_PROMPTS: booleanFromEnv
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
    throw new Error("X402_ENABLED=true is deferred to phase 2; phase 1 only supports local mock mode.");
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
    logPrompts: value.LOG_PROMPTS,
    x402: {
      enabled: value.X402_ENABLED,
      payTo: value.X402_PAY_TO,
      network: value.X402_NETWORK,
      facilitatorUrl: value.X402_FACILITATOR_URL,
      defaultPriceUsd: value.X402_DEFAULT_PRICE_USD
    },
    pricing: createPriceConfig(env),
    cost: createCostConfig(env)
  };
}

export const config = loadConfig();
