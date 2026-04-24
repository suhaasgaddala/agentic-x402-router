import { describe, expect, it } from "vitest";
import type { RouteConfig } from "@x402/core/server";
import { loadConfig } from "../../src/config.js";
import {
  MODEL_CALL_ROUTE_KEY,
  createX402RoutesConfig,
  formatX402UsdPrice,
  getModelCallResourceUrl,
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
      mimeType: "application/json"
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
