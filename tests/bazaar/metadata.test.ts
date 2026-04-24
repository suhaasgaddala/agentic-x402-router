import { describe, expect, it } from "vitest";
import {
  bazaarMetadata,
  bazaarModelAliases,
  bazaarTags,
  createBazaarExtensions,
  modelCallInputSchema,
  modelCallOutputSchema
} from "../../src/bazaar/metadata.js";

describe("bazaar metadata", () => {
  it("contains discovery tags", () => {
    expect(bazaarTags).toEqual(
      expect.arrayContaining([
        "llm",
        "inference",
        "model access",
        "claude",
        "anthropic",
        "chat completion",
        "text generation",
        "summarization",
        "code",
        "reasoning",
        "agent tools"
      ])
    );
  });

  it("includes model list and examples", () => {
    expect(bazaarModelAliases).toEqual(["claude-haiku", "claude-sonnet", "claude-opus", "mock-fast"]);
    expect(bazaarMetadata.examples).toHaveLength(3);
  });

  it("exposes input and output schemas", () => {
    expect(modelCallInputSchema.properties).toHaveProperty("messages");
    expect(modelCallOutputSchema.properties).toHaveProperty("usage");
  });

  it("creates a Bazaar discovery extension", () => {
    expect(createBazaarExtensions()).toHaveProperty("bazaar");
  });
});
