import type { AppConfig } from "../config.js";
import { HttpError } from "../errors/httpError.js";
import { MockProvider } from "./mock.js";
import type { ModelAlias, ModelProvider } from "./types.js";

export interface ProviderRegistry {
  getProviderForModel(model: ModelAlias): ModelProvider;
}

export function createProviderRegistry(_config: AppConfig): ProviderRegistry {
  const mockProvider = new MockProvider();

  return {
    getProviderForModel(model: ModelAlias): ModelProvider {
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
