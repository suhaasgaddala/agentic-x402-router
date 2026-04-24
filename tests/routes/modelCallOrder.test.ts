import type { RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createApp } from "../../src/app.js";
import { createModelCallRouter } from "../../src/routes/modelCall.js";
import express from "express";
import { requestIdMiddleware } from "../../src/telemetry/requestId.js";
import { errorHandler } from "../../src/errors/errorHandler.js";

describe("model-call route ordering", () => {
  it("runs payment middleware before JSON parsing and Zod validation", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      X402_ENABLED: "false"
    });
    const fakePayment: RequestHandler = (_req, res) => {
      res.status(402).json({
        ok: false,
        error: { code: "PAYMENT_REQUIRED", message: "test payment required" }
      });
    };
    const app = express();

    app.use(requestIdMiddleware);
    app.use(createModelCallRouter(config, fakePayment));
    app.use(errorHandler);

    await request(app)
      .post("/v1/model-call")
      .send({})
      .expect(402)
      .expect((response) => {
        expect(response.body.error.code).toBe("PAYMENT_REQUIRED");
      });
  });

  it("keeps local mock mode working when x402 is disabled", async () => {
    const app = createApp(
      loadConfig({
        NODE_ENV: "test",
        X402_ENABLED: "false"
      })
    );

    await request(app)
      .post("/v1/model-call")
      .send({
        model: "mock-fast",
        messages: [{ role: "user", content: "hello" }]
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.ok).toBe(true);
        expect(response.body.usage).toHaveProperty("charged_usd");
        expect(response.body.usage).toHaveProperty("estimated_provider_cost_usd");
        expect(response.body.usage).toHaveProperty("estimated_margin_usd");
      });
  });
});
