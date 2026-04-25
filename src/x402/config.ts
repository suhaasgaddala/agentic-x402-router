import type { RoutesConfig } from "@x402/core/server";
import type { AppConfig } from "../config.js";
import {
  bazaarMetadata,
  createBazaarExtensions,
  createMarketSignalBazaarExtensions
} from "../bazaar/metadata.js";
import { getPriceForModel } from "../billing/pricing.js";

export const MODEL_CALL_ROUTE_KEY = "POST /v1/model-call";
export const MARKET_SIGNAL_ROUTE_KEY = "POST /v1/market-signal";

export function normalizeX402Network(network: string): `${string}:${string}` {
  const normalized = network.trim();
  if (normalized === "base-sepolia") {
    return "eip155:84532";
  }

  if (normalized === "base") {
    return "eip155:8453";
  }

  if (!normalized.includes(":")) {
    throw new Error(
      `X402_NETWORK must be a CAIP-2 network id, received "${network}". Use "base-sepolia" or "eip155:84532" for Base Sepolia.`
    );
  }

  return normalized as `${string}:${string}`;
}

export function formatX402UsdPrice(value: number): `$${string}` {
  return `$${value.toFixed(6)}`;
}

export function getFixedX402PriceUsd(config: AppConfig): number {
  return config.x402.defaultPriceUsd || getPriceForModel("claude-sonnet", config.pricing);
}

export function getModelCallResourceUrl(config: AppConfig): string {
  const baseUrl = config.x402.resourceBaseUrl?.replace(/\/$/, "");
  return baseUrl ? `${baseUrl}/v1/model-call` : "/v1/model-call";
}

export function getMarketSignalResourceUrl(config: AppConfig): string {
  const baseUrl = config.x402.resourceBaseUrl?.replace(/\/$/, "");
  return baseUrl ? `${baseUrl}/v1/market-signal` : "/v1/market-signal";
}

export function createX402RoutesConfig(config: AppConfig): RoutesConfig {
  return {
    [MODEL_CALL_ROUTE_KEY]: {
      accepts: {
        scheme: "exact",
        price: formatX402UsdPrice(getFixedX402PriceUsd(config)),
        network: normalizeX402Network(config.x402.network),
        payTo: config.x402.payTo ?? "",
        maxTimeoutSeconds: 60
      },
      resource: getModelCallResourceUrl(config),
      description: config.x402.serviceDescription,
      mimeType: bazaarMetadata.mimeType,
      unpaidResponseBody: () => ({
        contentType: "application/json",
        body: {
          ok: false,
          error: {
            code: "PAYMENT_REQUIRED",
            message: "Payment required for POST /v1/model-call."
          }
        }
      }),
      extensions: createBazaarExtensions()
    },
    [MARKET_SIGNAL_ROUTE_KEY]: {
      accepts: {
        scheme: "exact",
        price: formatX402UsdPrice(config.marketSignal.priceUsd),
        network: normalizeX402Network(config.x402.network),
        payTo: config.x402.payTo ?? "",
        maxTimeoutSeconds: 30
      },
      resource: getMarketSignalResourceUrl(config),
      description:
        "Pay-per-call onchain market data and market signal endpoint for agents and trading bots.",
      mimeType: "application/json",
      unpaidResponseBody: () => ({
        contentType: "application/json",
        body: {
          ok: false,
          error: {
            code: "PAYMENT_REQUIRED",
            message: "Payment required for POST /v1/market-signal."
          }
        }
      }),
      extensions: createMarketSignalBazaarExtensions()
    }
  };
}
