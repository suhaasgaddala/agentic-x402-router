import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createX402Middleware } from "../../src/x402/middleware.js";

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
});
