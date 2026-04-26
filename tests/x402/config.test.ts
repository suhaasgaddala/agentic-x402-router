import { describe, expect, it } from "vitest";
import type { RouteConfig } from "@x402/core/server";
import { loadConfig } from "../../src/config.js";
import {
  MODEL_CALL_ROUTE_KEY,
  createX402RoutesConfig,
  formatX402UsdPrice,
  getX402FacilitatorMode,
  getModelCallResourceUrl,
  isCdpFacilitatorUrl,
  normalizeCdpApiKeySecret,
  normalizeX402Network
} from "../../src/x402/config.js";

describe("x402 config", () => {
  it("normalizes common network aliases", () => {
    expect(normalizeX402Network("base-sepolia")).toBe("eip155:84532");
    expect(normalizeX402Network("base")).toBe("eip155:8453");
    expect(normalizeX402Network("eip155:84532")).toBe("eip155:84532");
  });

  it("formats fixed USD prices", () => {
    expect(formatX402UsdPrice(0.05)).toBe("$0.050000");
  });

  it("formats discovery-range prices correctly for 6-decimal USDC", () => {
    // 0.001 USD = 1000 USDC base units (6-decimal USDC like on Base).
    // The x402 price string must encode all six decimal places so the
    // on-chain amount resolves to exactly 1000 and not 0 or 10.
    expect(formatX402UsdPrice(0.001)).toBe("$0.001000");
    expect(formatX402UsdPrice(0.0009)).toBe("$0.000900");
  });

  it("requires x402 env when enabled", () => {
    expect(() => loadConfig({ NODE_ENV: "test", X402_ENABLED: "true" })).toThrow(
      /X402_ENABLED=true requires/
    );
  });

  it("allows x402 enabled with required env", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      X402_ENABLED: "true",
      X402_PAY_TO: "0x0000000000000000000000000000000000000000",
      X402_FACILITATOR_URL: "https://x402.org/facilitator"
    });

    expect(config.x402.enabled).toBe(true);
    expect(getX402FacilitatorMode(config)).toBe("url");
  });

  it("sets current Anthropic model defaults and provider timeout", () => {
    const config = loadConfig({ NODE_ENV: "test" });

    expect(config.anthropic.models).toEqual({
      "claude-haiku": "claude-haiku-4-5",
      "claude-sonnet": "claude-sonnet-4-6",
      "claude-opus": "claude-opus-4-7"
    });
    expect(config.anthropic.timeoutMs).toBe(60_000);
  });

  it("detects CDP facilitator URLs", () => {
    expect(isCdpFacilitatorUrl("https://api.cdp.coinbase.com/platform/v2/x402")).toBe(true);
    expect(isCdpFacilitatorUrl("https://x402.org/facilitator")).toBe(false);
  });

  it("requires CDP keys for CDP facilitator mode", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "test",
        X402_ENABLED: "true",
        X402_PAY_TO: "0x0000000000000000000000000000000000000000",
        X402_FACILITATOR_URL: "https://api.cdp.coinbase.com/platform/v2/x402"
      })
    ).toThrow(/CDP facilitator requires CDP_API_KEY_ID and CDP_API_KEY_SECRET \(or CDP_API_KEY_SECRET_B64\)/);
  });

  it("allows CDP facilitator mode with CDP_API_KEY_SECRET", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      X402_ENABLED: "true",
      X402_PAY_TO: "0x0000000000000000000000000000000000000000",
      X402_FACILITATOR_URL: "https://api.cdp.coinbase.com/platform/v2/x402",
      CDP_API_KEY_ID: "key-id",
      CDP_API_KEY_SECRET: "key-secret"
    });

    expect(getX402FacilitatorMode(config)).toBe("cdp");
    expect(config.x402.cdp.apiKeyId).toBe("key-id");
    expect(config.x402.cdp.apiKeySecret).toBe("key-secret");
  });

  it("decodes CDP_API_KEY_SECRET_B64 from base64 and uses it as the secret", () => {
    const pem = "-----BEGIN EC PRIVATE KEY-----\nabc123\n-----END EC PRIVATE KEY-----";
    const b64 = Buffer.from(pem).toString("base64");

    const config = loadConfig({
      NODE_ENV: "test",
      X402_ENABLED: "true",
      X402_PAY_TO: "0x0000000000000000000000000000000000000000",
      X402_FACILITATOR_URL: "https://api.cdp.coinbase.com/platform/v2/x402",
      CDP_API_KEY_ID: "key-id",
      CDP_API_KEY_SECRET_B64: b64
    });

    expect(config.x402.cdp.apiKeySecret).toBe(pem);
  });

  it("prefers CDP_API_KEY_SECRET_B64 over CDP_API_KEY_SECRET when both are set", () => {
    const pem = "-----BEGIN EC PRIVATE KEY-----\nfromB64\n-----END EC PRIVATE KEY-----";
    const b64 = Buffer.from(pem).toString("base64");

    const config = loadConfig({
      NODE_ENV: "test",
      X402_ENABLED: "true",
      X402_PAY_TO: "0x0000000000000000000000000000000000000000",
      X402_FACILITATOR_URL: "https://api.cdp.coinbase.com/platform/v2/x402",
      CDP_API_KEY_ID: "key-id",
      CDP_API_KEY_SECRET: "plain-text-secret",
      CDP_API_KEY_SECRET_B64: b64
    });

    expect(config.x402.cdp.apiKeySecret).toBe(pem);
  });

  it("allows CDP mode with only CDP_API_KEY_SECRET_B64 (no plain-text secret)", () => {
    const pem = "-----BEGIN EC PRIVATE KEY-----\nonly-b64\n-----END EC PRIVATE KEY-----";
    const b64 = Buffer.from(pem).toString("base64");

    const config = loadConfig({
      NODE_ENV: "test",
      X402_ENABLED: "true",
      X402_PAY_TO: "0x0000000000000000000000000000000000000000",
      X402_FACILITATOR_URL: "https://api.cdp.coinbase.com/platform/v2/x402",
      CDP_API_KEY_ID: "key-id",
      CDP_API_KEY_SECRET_B64: b64
    });

    expect(getX402FacilitatorMode(config)).toBe("cdp");
    expect(config.x402.cdp.apiKeySecret).toBe(pem);
  });

  it("normalizes escaped newline sequences in CDP API key secrets", () => {
    expect(normalizeCdpApiKeySecret("-----BEGIN-----\\nabc\\n-----END-----")).toBe(
      "-----BEGIN-----\nabc\n-----END-----"
    );
  });

  it("builds model call route config with bazaar extension", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      X402_ENABLED: "true",
      X402_PAY_TO: "0x0000000000000000000000000000000000000000",
      X402_FACILITATOR_URL: "https://x402.org/facilitator",
      X402_RESOURCE_BASE_URL: "https://gateway.example"
    });
    const routes = createX402RoutesConfig(config) as Record<string, RouteConfig>;
    const route = routes[MODEL_CALL_ROUTE_KEY];

    expect(route).toBeDefined();
    expect(getModelCallResourceUrl(config)).toBe("https://gateway.example/v1/model-call");
    expect(route).toMatchObject({
      resource: "https://gateway.example/v1/model-call",
      mimeType: "application/json",
      accepts: expect.objectContaining({
        // 0.001 USD = 1000 USDC base units (6-decimal); encoded as $0.001000
        price: "$0.001000"
      })
    });
    expect(route.extensions).toHaveProperty("bazaar");
    expect(route.unpaidResponseBody?.({} as never)).toEqual({
      contentType: "application/json",
      body: {
        ok: false,
        error: {
          code: "PAYMENT_REQUIRED",
          message: "Payment required for POST /v1/model-call."
        }
      }
    });
  });
});
