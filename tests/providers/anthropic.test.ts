import type { Message, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import { describe, expect, it, vi } from "vitest";
import {
  AnthropicProvider,
  buildAnthropicSystemPrompt,
  extractAnthropicText,
  shouldSendTemperature,
  toAnthropicMessages
} from "../../src/providers/anthropic.js";

const modelMap = {
  "claude-haiku": "claude-haiku-4-5",
  "claude-sonnet": "claude-sonnet-4-6",
  "claude-opus": "claude-opus-4-7"
};

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg_test",
    container: null,
    content: [{ type: "text", text: "hello from Claude", citations: null }],
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
      input_tokens: 12,
      output_tokens: 5,
      server_tool_use: null,
      service_tier: "standard"
    },
    ...overrides
  };
}

describe("AnthropicProvider", () => {
  it("maps aliases to configured Anthropic models", async () => {
    const create = vi.fn(async () => message({ model: "claude-opus-4-7" }));
    const provider = new AnthropicProvider({
      apiKey: "sk-test",
      modelMap,
      timeoutMs: 1000,
      client: { create }
    });

    await provider.call({
      requestId: "req_test",
      model: "claude-opus",
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 100,
      temperature: 0.2
    });

    const body = (create.mock.calls as unknown as [[MessageCreateParamsNonStreaming]])[0][0];
    expect(body.model).toBe("claude-opus-4-7");
  });

  it("combines gateway and request system messages", () => {
    const system = buildAnthropicSystemPrompt([
      { role: "system", content: "Be brief." },
      { role: "user", content: "hello" }
    ]);

    expect(system).toContain("x402-paid inference gateway");
    expect(system).toContain("Be brief.");
  });

  it("converts only user and assistant messages into Anthropic conversation messages", () => {
    expect(
      toAnthropicMessages([
        { role: "system", content: "system" },
        { role: "user", content: "one" },
        { role: "assistant", content: "two" }
      ])
    ).toEqual([
      { role: "user", content: "one" },
      { role: "assistant", content: "two" }
    ]);
  });

  it("extracts text blocks and maps token usage", async () => {
    const create = vi.fn(async () =>
      message({
        content: [
          { type: "text", text: "first", citations: null },
          { type: "text", text: " second", citations: null }
        ]
      })
    );
    const provider = new AnthropicProvider({
      apiKey: "sk-test",
      modelMap,
      timeoutMs: 1000,
      client: { create }
    });

    const result = await provider.call({
      requestId: "req_test",
      model: "claude-sonnet",
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 100,
      temperature: 0.2
    });

    expect(extractAnthropicText(message())).toBe("hello from Claude");
    expect(result.provider).toBe("anthropic");
    expect(result.text).toBe("first second");
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 5 });
  });

  it("omits temperature for current Claude 4 aliases", async () => {
    const create = vi.fn(async () => message());
    const provider = new AnthropicProvider({
      apiKey: "sk-test",
      modelMap,
      timeoutMs: 1000,
      client: { create }
    });

    await provider.call({
      requestId: "req_test",
      model: "claude-sonnet",
      messages: [{ role: "user", content: "hello" }],
      maxTokens: 100,
      temperature: 0.2
    });

    const body = (create.mock.calls as unknown as [[MessageCreateParamsNonStreaming]])[0][0];
    expect(shouldSendTemperature("claude-sonnet-4-6")).toBe(false);
    expect(body).not.toHaveProperty("temperature");
  });

  it("normalizes timeout errors", async () => {
    const create = vi.fn(async () => {
      throw new Error("request timeout");
    });
    const provider = new AnthropicProvider({
      apiKey: "sk-test",
      modelMap,
      timeoutMs: 1000,
      client: { create }
    });

    await expect(
      provider.call({
        requestId: "req_test",
        model: "claude-sonnet",
        messages: [{ role: "user", content: "hello" }],
        maxTokens: 100,
        temperature: 0.2
      })
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT", statusCode: 504 });
  });

  it("normalizes upstream provider errors", async () => {
    const create = vi.fn(async () => {
      throw new Error("provider said no");
    });
    const provider = new AnthropicProvider({
      apiKey: "sk-test",
      modelMap,
      timeoutMs: 1000,
      client: { create }
    });

    await expect(
      provider.call({
        requestId: "req_test",
        model: "claude-sonnet",
        messages: [{ role: "user", content: "hello" }],
        maxTokens: 100,
        temperature: 0.2
      })
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR", statusCode: 502 });
  });
});
