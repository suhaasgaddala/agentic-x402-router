import request from "supertest";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createApp } from "../../src/app.js";
import { withFakeFacilitator } from "../helpers/fakeFacilitator.js";

const TIGHT_CAPS = {
  NODE_ENV: "test",
  X402_ENABLED: "false",
  MODEL_CALL_MAX_OUTPUT_TOKENS: "10",
  MODEL_CALL_MAX_INPUT_CHARS: "50"
} as const;

describe("model-call safety caps", () => {
  const app = createApp(loadConfig(TIGHT_CAPS));

  it("rejects max_tokens above cap with 400 VALIDATION_ERROR", async () => {
    await request(app)
      .post("/v1/model-call")
      .send({
        model: "mock-fast",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 11
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  it("rejects total input chars above cap with 400 VALIDATION_ERROR", async () => {
    await request(app)
      .post("/v1/model-call")
      .send({
        model: "mock-fast",
        messages: [{ role: "user", content: "x".repeat(51) }]
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  it("accepts a valid request within caps", async () => {
    await request(app)
      .post("/v1/model-call")
      .send({
        model: "mock-fast",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 10
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.ok).toBe(true);
      });
  });

  it("accepts a request using default max_tokens (capped default)", async () => {
    await request(app)
      .post("/v1/model-call")
      .send({
        model: "mock-fast",
        messages: [{ role: "user", content: "hi" }]
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.ok).toBe(true);
      });
  });

  it("unpaid oversized request returns 402 before validation with x402 enabled", async () => {
    await withFakeFacilitator(async (facilitatorUrl) => {
      const x402App = createApp(
        loadConfig({
          NODE_ENV: "test",
          X402_ENABLED: "true",
          X402_PAY_TO: "0x0000000000000000000000000000000000000000",
          X402_FACILITATOR_URL: facilitatorUrl,
          MODEL_CALL_MAX_OUTPUT_TOKENS: "10"
        })
      );

      // Oversized max_tokens — should hit 402, not 400 validation
      await request(x402App)
        .post("/v1/model-call")
        .send({
          model: "mock-fast",
          messages: [{ role: "user", content: "hello" }],
          max_tokens: 9999
        })
        .expect(402)
        .expect((res) => {
          expect(res.body.error.code).toBe("PAYMENT_REQUIRED");
          expect(res.body.error.code).not.toBe("VALIDATION_ERROR");
        });
    });
  });

  it("unpaid no-body request still returns 402, not validation error", async () => {
    await withFakeFacilitator(async (facilitatorUrl) => {
      const x402App = createApp(
        loadConfig({
          NODE_ENV: "test",
          X402_ENABLED: "true",
          X402_PAY_TO: "0x0000000000000000000000000000000000000000",
          X402_FACILITATOR_URL: facilitatorUrl,
          MODEL_CALL_MAX_OUTPUT_TOKENS: "10",
          MODEL_CALL_MAX_INPUT_CHARS: "50"
        })
      );

      await request(x402App)
        .post("/v1/model-call")
        .expect(402)
        .expect((res) => {
          expect(res.body.error.code).toBe("PAYMENT_REQUIRED");
        });
    });
  });
});
