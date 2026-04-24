import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createProviderRegistry } from "../../src/providers/index.js";
import { MockProvider } from "../../src/providers/mock.js";

describe("mock provider", () => {
  it("returns deterministic output", async () => {
    const provider = new MockProvider();
    const result = await provider.call({
      requestId: "req_test",
      model: "mock-fast",
      messages: [{ role: "user", content: "hello world" }],
      maxTokens: 100,
      temperature: 0.2
    });

    expect(result.provider).toBe("mock");
    expect(result.text).toBe("mock response for mock-fast: hello world");
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
  });

  it("provider selector uses mock when no Anthropic key exists", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      X402_ENABLED: "false",
      ANTHROPIC_API_KEY: ""
    });
    const registry = createProviderRegistry(config);

    expect(registry.getProviderForModel("claude-sonnet")).toBeInstanceOf(MockProvider);
    expect(registry.getProviderForModel("mock-fast")).toBeInstanceOf(MockProvider);
  });
});
