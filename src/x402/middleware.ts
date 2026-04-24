import type { NextFunction, Request, RequestHandler, Response } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import type { AppConfig } from "../config.js";
import { logger } from "../telemetry/logger.js";
import { createX402RoutesConfig, normalizeX402Network } from "./config.js";

export function createX402Middleware(config: AppConfig): RequestHandler {
  if (!config.x402.enabled) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const facilitatorClient = new HTTPFacilitatorClient({
    url: config.x402.facilitatorUrl
  });
  const network = normalizeX402Network(config.x402.network);
  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(network, new ExactEvmScheme())
    .registerExtension(bazaarResourceServerExtension);

  const middleware = paymentMiddleware(
    createX402RoutesConfig(config),
    resourceServer,
    {
      appName: config.x402.serviceName,
      testnet: network === "eip155:84532"
    },
    undefined,
    true
  );

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await middleware(req, res, next);
    } catch (error) {
      logger.error({ err: error, request_id: req.requestId, route: req.path, error_code: "X402_ERROR" });
      next(error);
    }
  };
}
