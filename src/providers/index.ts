import type { AppConfig } from "../config.js";
import { HttpError } from "../errors/httpError.js";
import { AnthropicProvider, isClaudeAlias } from "./anthropic.js";
import { MockProvider } from "./mock.js";
import type { ModelAlias, ModelProvider } from "./types.js";

export interface ProviderRegistry {
  getProviderForModel(model: ModelAlias): ModelProvider;
}

export function createProviderRegistry(_config: AppConfig): ProviderRegistry {
  const mockProvider = new MockProvider();
  const anthropicProvider = _config.anthropic.apiKey
    ? new AnthropicProvider({
        apiKey: _config.anthropic.apiKey,
        modelMap: _config.anthropic.models,
        timeoutMs: _config.anthropic.timeoutMs
      })
    : undefined;

  return {
    getProviderForModel(model: ModelAlias): ModelProvider {
      if (model === "mock-fast") {
        return mockProvider;
      }

      if (anthropicProvider?.canHandle(model)) {
        return anthropicProvider;
      }

      if (isClaudeAlias(model) && mockProvider.canHandle(model)) {
        return mockProvider;
      }

      if (mockProvider.canHandle(model)) {
        return mockProvider;
      }

      throw new HttpError({
        statusCode: 503,
        code: "PROVIDER_NOT_CONFIGURED",
        message: `No configured provider can handle model ${model}.`
      });
    }
  };
}
