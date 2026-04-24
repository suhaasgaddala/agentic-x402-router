import { describe, expect, it } from "vitest";
import { createModelCallSchema } from "../../src/schemas/modelCall.js";

const schema = createModelCallSchema({
  maxInputChars: 20,
  maxOutputTokens: 2_000
});

describe("modelCall schema", () => {
  it("accepts a valid request", () => {
    const parsed = schema.parse({
      model: "mock-fast",
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 50,
      temperature: 0.3
    });

    expect(parsed.model).toBe("mock-fast");
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.max_tokens).toBe(50);
    expect(parsed.temperature).toBe(0.3);
  });

  it("defaults model to claude-sonnet", () => {
    const parsed = schema.parse({
      messages: [{ role: "user", content: "hello" }]
    });

    expect(parsed.model).toBe("claude-sonnet");
    expect(parsed.max_tokens).toBe(1_000);
    expect(parsed.temperature).toBe(0.2);
  });

  it("rejects invalid roles", () => {
    const result = schema.safeParse({
      messages: [{ role: "tool", content: "hello" }]
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty messages", () => {
    const result = schema.safeParse({
      messages: []
    });

    expect(result.success).toBe(false);
  });

  it("rejects too long input", () => {
    const result = schema.safeParse({
      messages: [{ role: "user", content: "this message is too long" }]
    });

    expect(result.success).toBe(false);
  });
});
