import { config } from "./config.js";
import { createApp } from "./app.js";
import { logger } from "./telemetry/logger.js";

const app = createApp(config);

app.listen(config.port, () => {
  logger.info({
    service: "agentic-x402-router",
    port: config.port,
    x402_enabled: config.x402.enabled
  }, "server started");
});
