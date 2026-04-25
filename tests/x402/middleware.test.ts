import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/config.js";
import { logger } from "../../src/telemetry/logger.js";
import { createFacilitatorClient, createX402Middleware } from "../../src/x402/middleware.js";

describe("x402 middleware", () => {
  it("is a no-op when x402 is disabled", () => {
    const middleware = createX402Middleware(
      loadConfig({
        NODE_ENV: "test",
        X402_ENABLED: "false"
      })
    );
    const next = vi.fn();

    middleware({} as never, {} as never, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("uses URL facilitator mode without Coinbase helper for x402.org", () => {
    const coinbaseFactory = vi.fn();
    const client = createFacilitatorClient(
      loadConfig({
        NODE_ENV: "test",
        X402_ENABLED: "true",
        X402_PAY_TO: "0x0000000000000000000000000000000000000000",
        X402_FACILITATOR_URL: "https://x402.org/facilitator"
      }),
      coinbaseFactory
    );

    expect(client.url).toBe("https://x402.org/facilitator");
    expect(coinbaseFactory).not.toHaveBeenCalled();
  });

  it("uses Coinbase helper with normalized secret for CDP mode", () => {
    const coinbaseFactory = vi.fn(() => ({
      url: "https://api.cdp.coinbase.com/platform/v2/x402",
      createAuthHeaders: async () => ({
        verify: {},
        settle: {},
        supported: {}
      })
    }));
    const client = createFacilitatorClient(
      loadConfig({
        NODE_ENV: "test",
        X402_ENABLED: "true",
        X402_PAY_TO: "0x0000000000000000000000000000000000000000",
        X402_FACILITATOR_URL: "https://api.cdp.coinbase.com/platform/v2/x402",
        CDP_API_KEY_ID: "key-id",
        CDP_API_KEY_SECRET: "line1\\nline2"
      }),
      coinbaseFactory
    );

    expect(client.url).toBe("https://api.cdp.coinbase.com/platform/v2/x402");
    expect(coinbaseFactory).toHaveBeenCalledWith("key-id", "line1\nline2");
  });

  it("does not log CDP secret material when facilitator construction fails", () => {
    const loggerError = vi.spyOn(logger, "error");
    const secret = "super-secret-line1\\nsuper-secret-line2";
    const coinbaseFactory = vi.fn(() => {
      throw new Error("factory failed");
    });

    expect(() =>
      createFacilitatorClient(
        loadConfig({
          NODE_ENV: "test",
          X402_ENABLED: "true",
          X402_PAY_TO: "0x0000000000000000000000000000000000000000",
          X402_FACILITATOR_URL: "https://api.cdp.coinbase.com/platform/v2/x402",
          CDP_API_KEY_ID: "key-id",
          CDP_API_KEY_SECRET: secret
        }),
        coinbaseFactory
      )
    ).toThrow("factory failed");

    expect(loggerError).not.toHaveBeenCalled();
    loggerError.mockRestore();
  });
});
