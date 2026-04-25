import type { AppConfig } from "../config.js";
import { HttpError } from "../errors/httpError.js";
import { DexScreenerMarketSignalProvider } from "./dexscreener.js";
import { MockMarketSignalProvider } from "./mock.js";
import type { MarketSignalInput, MarketSignalProvider, MarketSignalResult, SupportedChain } from "./types.js";

export interface MarketSignalRegistry {
  getProviderForChain(chain: SupportedChain): MarketSignalProvider;
  getProviderCostUsd(dataSource: string): number;
}

class FallbackMarketSignalProvider implements MarketSignalProvider {
  constructor(
    private readonly primary: MarketSignalProvider,
    private readonly fallback: MarketSignalProvider
  ) {}

  canHandle(chain: SupportedChain): boolean {
    return this.primary.canHandle(chain) || this.fallback.canHandle(chain);
  }

  async fetchSignals(input: MarketSignalInput): Promise<MarketSignalResult> {
    try {
      return await this.primary.fetchSignals(input);
    } catch (error) {
      if (this.fallback.canHandle(input.chain)) {
        return this.fallback.fetchSignals(input);
      }

      throw error;
    }
  }
}

function createDexScreenerProvider(config: AppConfig): MarketSignalProvider | undefined {
  if (config.marketSignal.provider !== "dexscreener") {
    return undefined;
  }

  try {
    const url = new URL(config.marketSignal.dexscreener.baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      return undefined;
    }

    return new DexScreenerMarketSignalProvider({
      baseUrl: url.toString(),
      timeoutMs: config.marketSignal.providerTimeoutMs
    });
  } catch {
    return undefined;
  }
}

export function getMarketSignalProviderCostUsd(config: AppConfig, dataSource: string): number {
  return dataSource === "dexscreener"
    ? config.marketSignal.dexscreener.providerCostUsd
    : config.marketSignal.providerCostUsd;
}

export function createMarketSignalRegistry(config: AppConfig): MarketSignalRegistry {
  const mock = new MockMarketSignalProvider();
  const dexScreener = createDexScreenerProvider(config);
  const provider = dexScreener ? new FallbackMarketSignalProvider(dexScreener, mock) : mock;

  return {
    getProviderForChain(chain: SupportedChain): MarketSignalProvider {
      if (provider.canHandle(chain)) {
        return provider;
      }

      throw new HttpError({
        statusCode: 503,
        code: "PROVIDER_NOT_CONFIGURED",
        message: `No configured market signal provider can handle chain ${chain}.`
      });
    },
    getProviderCostUsd(dataSource: string): number {
      return getMarketSignalProviderCostUsd(config, dataSource);
    }
  };
}
