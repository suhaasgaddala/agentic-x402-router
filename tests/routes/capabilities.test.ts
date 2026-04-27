import request from "supertest";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createApp } from "../../src/app.js";

describe("GET /v1/capabilities", () => {
  const app = createApp(
    loadConfig({
      NODE_ENV: "test",
      X402_ENABLED: "false"
    })
  );

  it("returns 200 with JSON body", async () => {
    await request(app).get("/v1/capabilities").expect(200).expect("content-type", /json/);
  });

  it("includes required top-level fields", async () => {
    const res = await request(app).get("/v1/capabilities").expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("agentic-x402-router");
    expect(typeof res.body.x402_enabled).toBe("boolean");
    expect(typeof res.body.network).toBe("string");
  });

  it("returns two capabilities", async () => {
    const res = await request(app).get("/v1/capabilities").expect(200);
    expect(Array.isArray(res.body.capabilities)).toBe(true);
    expect(res.body.capabilities).toHaveLength(2);
  });

  it("model-call capability has correct shape", async () => {
    const res = await request(app).get("/v1/capabilities").expect(200);
    const mc = res.body.capabilities.find((c: { id: string }) => c.id === "model-call");
    expect(mc).toBeDefined();
    expect(mc.method).toBe("POST");
    expect(mc.route).toBe("/v1/model-call");
    expect(mc.price_usd).toBeTypeOf("number");
    expect(mc.payment).toBe("x402");
    expect(mc.description).toBeTruthy();
  });

  it("market-signal capability has correct shape", async () => {
    const res = await request(app).get("/v1/capabilities").expect(200);
    const ms = res.body.capabilities.find((c: { id: string }) => c.id === "market-signal");
    expect(ms).toBeDefined();
    expect(ms.method).toBe("POST");
    expect(ms.route).toBe("/v1/market-signal");
    expect(ms.price_usd).toBeTypeOf("number");
    expect(ms.payment).toBe("x402");
    expect(ms.description).toBeTruthy();
  });

  it("reflects x402_enabled=false in local mode", async () => {
    const res = await request(app).get("/v1/capabilities").expect(200);
    expect(res.body.x402_enabled).toBe(false);
  });

  it("shows mock provider when no ANTHROPIC_API_KEY", async () => {
    const res = await request(app).get("/v1/capabilities").expect(200);
    const mc = res.body.capabilities.find((c: { id: string }) => c.id === "model-call");
    expect(mc.provider).toBe("mock");
  });

  it("shows anthropic provider when ANTHROPIC_API_KEY is set", async () => {
    const appWithKey = createApp(
      loadConfig({
        NODE_ENV: "test",
        X402_ENABLED: "false",
        ANTHROPIC_API_KEY: "sk-ant-fake-key-for-test"
      })
    );
    const res = await request(appWithKey).get("/v1/capabilities").expect(200);
    const mc = res.body.capabilities.find((c: { id: string }) => c.id === "model-call");
    expect(mc.provider).toBe("anthropic");
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
    const res = await request(appWithSecrets).get("/v1/capabilities").expect(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("sk-ant-super-secret");
    expect(body).not.toContain("cdp-key-id-secret");
    expect(body).not.toContain("apiKey");
    expect(body).not.toContain("private");
  });
});
