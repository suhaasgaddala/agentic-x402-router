import pino from "pino";
import { config } from "../config.js";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (config.nodeEnv === "production" ? "info" : "debug"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.x-payment",
      "req.headers.x-payment-response",
      "req.headers.cookie",
      "req.headers['x-api-key']",
      "*.apiKey",
      "*.api_key",
      "*.apiKeyId",
      "*.apiKeySecret",
      "*.privateKey",
      "*.secret",
      "*.ANTHROPIC_API_KEY",
      "*.CDP_API_KEY_ID",
      "*.CDP_API_KEY_SECRET",
      "*.CDP_API_KEY_SECRET_B64",
      "*.EVM_PRIVATE_KEY"
    ],
    remove: true
  }
});
