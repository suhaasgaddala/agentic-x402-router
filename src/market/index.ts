import type { AppConfig } from "../config.js";
import { HttpError } from "../errors/httpError.js";
import { MockMarketSignalProvider } from "./mock.js";
import type { MarketSignalProvider, SupportedChain } from "./types.js";

export interface MarketSignalRegistry {
  getProviderForChain(chain: SupportedChain): MarketSignalProvider;
}

export function createMarketSignalRegistry(_config: AppConfig): MarketSignalRegistry {
  const mock = new MockMarketSignalProvider();

  return {
    getProviderForChain(chain: SupportedChain): MarketSignalProvider {
      if (mock.canHandle(chain)) {
        return mock;
      }

      throw new HttpError({
        statusCode: 503,
        code: "PROVIDER_NOT_CONFIGURED",
        message: `No configured market signal provider can handle chain ${chain}.`
      });
    }
  };
}
