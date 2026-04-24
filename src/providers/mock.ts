import { estimateTokensFromText } from "../billing/cost.js";
import type { ModelAlias, ModelCallInput, ModelCallResult, ModelProvider } from "./types.js";

export class MockProvider implements ModelProvider {
  canHandle(model: ModelAlias): boolean {
    return model === "mock-fast" || model.startsWith("claude-");
  }

  async call(input: ModelCallInput): Promise<ModelCallResult> {
    const firstUserContent =
      input.messages.find((message) => message.role === "user")?.content ?? input.messages[0]?.content ?? "";
    const text = `mock response for ${input.model}: ${firstUserContent.slice(0, 200)}`;
    const combinedInput = input.messages.map((message) => message.content).join("\n");

    return {
      provider: "mock",
      model: input.model,
      text,
      usage: {
        inputTokens: estimateTokensFromText(combinedInput),
        outputTokens: estimateTokensFromText(text)
      }
    };
  }
}
