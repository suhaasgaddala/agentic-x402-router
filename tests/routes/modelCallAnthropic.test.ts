import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const anthropicMock = vi.hoisted(() => ({
  create: vi.fn()
}));

vi.mock("@anthropic-ai/sdk", () => {
  class APIConnectionTimeoutError extends Error {}
  class APIUserAbortError extends Error {}

  return {
    default: class Anthropic {
      messages = {
        create: anthropicMock.create
      };
    },
    APIConnectionTimeoutError,
    APIUserAbortError
  };
});

import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";

describe("model-call Anthropic route integration", () => {
  it("returns the stable response shape without raw provider internals", async () => {
    anthropicMock.create.mockResolvedValueOnce({
      id: "msg_test",
      container: null,
      content: [{ type: "text", text: "real normalized output", citations: null }],
      model: "claude-sonnet-4-6",
      role: "assistant",
      stop_details: null,
      stop_reason: "end_turn",
      stop_sequence: null,
      type: "message",
      usage: {
        cache_creation: null,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        inference_geo: null,
        input_tokens: 11,
        output_tokens: 7,
        server_tool_use: null,
        service_tier: "standard"
      },
      raw_secret_field: "should-not-leak"
    });

    const app = createApp(
      loadConfig({
        NODE_ENV: "test",
        X402_ENABLED: "false",
        ANTHROPIC_API_KEY: "sk-test"
      })
    );

    await request(app)
      .post("/v1/model-call")
      .send({
        model: "claude-sonnet",
        messages: [{ role: "user", content: "hello" }],
        max_tokens: 100,
        temperature: 0.2
      })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          ok: true,
          model: "claude-sonnet",
          provider: "anthropic",
          text: "real normalized output",
          usage: {
            input_tokens: 11,
            output_tokens: 7,
            charged_usd: 0.04
          }
        });
        expect(response.body).not.toHaveProperty("raw");
        expect(JSON.stringify(response.body)).not.toContain("should-not-leak");
      });
  });
});
