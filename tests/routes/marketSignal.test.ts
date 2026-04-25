import request from "supertest";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createApp } from "../../src/app.js";
import { MARKET_SIGNAL_DISCLAIMER } from "../../src/routes/marketSignal.js";
import { withFakeFacilitator } from "../helpers/fakeFacilitator.js";

const VALID_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const VALID_BODY = {
  chain: "base",
  token: VALID_TOKEN,
  timeframe: "1h",
  signals: ["liquidity", "volume"]
};

function mockApp() {
  return createApp(
    loadConfig({
      NODE_ENV: "test",
      X402_ENABLED: "false"
    })
  );
}

describe("POST /v1/market-signal", () => {
  it("returns 200 with all required fields in local mock mode", async () => {
    await request(mockApp())
      .post("/v1/market-signal")
      .send(VALID_BODY)
      .expect(200)
      .expect((res) => {
        expect(res.body.ok).toBe(true);
        expect(typeof res.body.id).toBe("string");
        expect(res.body.chain).toBe("base");
        expect(res.body.token).toBe(VALID_TOKEN);
        expect(res.body.timeframe).toBe("1h");
        expect(res.body.data_source).toBe("mock");
        expect(typeof res.body.summary).toBe("string");
        expect(res.body.disclaimer).toBe(MARKET_SIGNAL_DISCLAIMER);
      });
  });

  it("response only includes requested signal keys", async () => {
    await request(mockApp())
      .post("/v1/market-signal")
      .send({ token: VALID_TOKEN, signals: ["liquidity"] })
      .expect(200)
      .expect((res) => {
        expect(res.body.signals).toHaveProperty("liquidity_usd");
        expect(res.body.signals).not.toHaveProperty("volume_usd");
        expect(res.body.signals).not.toHaveProperty("price_change_pct");
      });
  });

  it("usage shape matches the model-call pattern", async () => {
    await request(mockApp())
      .post("/v1/market-signal")
      .send(VALID_BODY)
      .expect(200)
      .expect((res) => {
        expect(res.body.usage).toHaveProperty("charged_usd");
        expect(res.body.usage).toHaveProperty("estimated_provider_cost_usd");
        expect(res.body.usage).toHaveProperty("estimated_margin_usd");
        expect(res.body.timing).toHaveProperty("latency_ms");
      });
  });

  it("disclaimer is present in every successful response", async () => {
    const signals = ["liquidity", "volume", "price_change", "price_impact", "pool_activity", "wallet_flows"];

    await request(mockApp())
      .post("/v1/market-signal")
      .send({ token: VALID_TOKEN, signals })
      .expect(200)
      .expect((res) => {
        expect(res.body.disclaimer).toBe(MARKET_SIGNAL_DISCLAIMER);
      });
  });

  it("applies default chain and timeframe", async () => {
    await request(mockApp())
      .post("/v1/market-signal")
      .send({ token: VALID_TOKEN, signals: ["liquidity"] })
      .expect(200)
      .expect((res) => {
        expect(res.body.chain).toBe("base");
        expect(res.body.timeframe).toBe("1h");
      });
  });

  it("returns 400 for missing token", async () => {
    await request(mockApp())
      .post("/v1/market-signal")
      .send({ signals: ["liquidity"] })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  it("returns 400 for invalid token format", async () => {
    await request(mockApp())
      .post("/v1/market-signal")
      .send({ token: "not-an-address", signals: ["liquidity"] })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  it("returns 400 for empty signals array", async () => {
    await request(mockApp())
      .post("/v1/market-signal")
      .send({ token: VALID_TOKEN, signals: [] })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  it("returns 400 for unsupported chain", async () => {
    await request(mockApp())
      .post("/v1/market-signal")
      .send({ chain: "tron", token: VALID_TOKEN, signals: ["liquidity"] })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  it("returns 402 before business validation for unpaid x402 requests (no body)", async () => {
    await withFakeFacilitator(async (facilitatorUrl) => {
      const app = createApp(
        loadConfig({
          NODE_ENV: "test",
          X402_ENABLED: "true",
          X402_PAY_TO: "0x0000000000000000000000000000000000000000",
          X402_FACILITATOR_URL: facilitatorUrl
        })
      );

      await request(app)
        .post("/v1/market-signal")
        .set("Accept", "application/json")
        .expect(402)
        .expect((res) => {
          expect(res.body.error.code).toBe("PAYMENT_REQUIRED");
          expect(res.body.error.code).not.toBe("VALIDATION_ERROR");
        });
    });
  });

  it("returns 402 before business validation for unpaid x402 requests ({} body)", async () => {
    await withFakeFacilitator(async (facilitatorUrl) => {
      const app = createApp(
        loadConfig({
          NODE_ENV: "test",
          X402_ENABLED: "true",
          X402_PAY_TO: "0x0000000000000000000000000000000000000000",
          X402_FACILITATOR_URL: facilitatorUrl
        })
      );

      await request(app)
        .post("/v1/market-signal")
        .set("Accept", "application/json")
        .send({})
        .expect(402)
        .expect((res) => {
          expect(res.body.error.code).toBe("PAYMENT_REQUIRED");
          expect(res.body.error.code).not.toBe("VALIDATION_ERROR");
        });
    });
  });
});
