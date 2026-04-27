import request from "supertest";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createApp } from "../../src/app.js";

describe("GET /", () => {
  const app = createApp(
    loadConfig({
      NODE_ENV: "test",
      X402_ENABLED: "false"
    })
  );

  it("returns 200 with JSON body", async () => {
    await request(app).get("/").expect(200).expect("content-type", /json/);
  });

  it("includes required top-level fields", async () => {
    const res = await request(app).get("/").expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("agentic-x402-router");
    expect(res.body.status).toBe("live");
    expect(res.body.description).toMatch(/x402/i);
  });

  it("includes endpoint entries for both paid routes", async () => {
    const res = await request(app).get("/").expect(200);
    expect(res.body.endpoints).toHaveProperty("POST /v1/model-call");
    expect(res.body.endpoints).toHaveProperty("POST /v1/market-signal");
    expect(res.body.endpoints["POST /v1/model-call"].price_usd).toBeTypeOf("number");
    expect(res.body.endpoints["POST /v1/market-signal"].price_usd).toBeTypeOf("number");
  });

  it("includes navigation urls", async () => {
    const res = await request(app).get("/").expect(200);
    expect(res.body.health_url).toBe("/health");
    expect(res.body.models_url).toBe("/v1/models");
    expect(res.body.capabilities_url).toBe("/v1/capabilities");
  });

  it("shows mock provider when no ANTHROPIC_API_KEY", async () => {
    const res = await request(app).get("/").expect(200);
    expect(res.body.endpoints["POST /v1/model-call"].provider).toBe("mock");
  });

  it("shows anthropic provider when ANTHROPIC_API_KEY is set", async () => {
    const appWithKey = createApp(
      loadConfig({
        NODE_ENV: "test",
        X402_ENABLED: "false",
        ANTHROPIC_API_KEY: "sk-ant-fake-key-for-test"
      })
    );
    const res = await request(appWithKey).get("/").expect(200);
    expect(res.body.endpoints["POST /v1/model-call"].provider).toBe("anthropic");
  });

  it("does not expose secrets in the response", async () => {
    const appWithSecrets = createApp(
      loadConfig({
        NODE_ENV: "test",
        X402_ENABLED: "false",
        ANTHROPIC_API_KEY: "sk-ant-super-secret",
        CDP_API_KEY_ID: "cdp-key-id-secret"
      })
    );
    const res = await request(appWithSecrets).get("/").expect(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("sk-ant-super-secret");
    expect(body).not.toContain("cdp-key-id-secret");
    expect(body).not.toContain("apiKey");
    expect(body).not.toContain("private");
  });
});
