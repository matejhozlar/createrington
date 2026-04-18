/**
 * Application entry point
 *
 * Initializes the global logger, bootstraps all services via the DI
 * container, starts the HTTP server, and wires up graceful shutdown.
 */

import "./logger.global";
import { env } from "@/config/env/env.config";
import { initializeServices, shutdownServices } from "@/services/bootstrap";
import type { Server } from "node:http";
import { container, Services } from "@/services";

const PORT = env.PORT;

/** Bootstraps services and starts listening for HTTP requests */
async function start() {
  try {
    await initializeServices();

    const httpServer = await container.get(Services.HTTP_SERVER);
    setupProcessHandlers(httpServer);
    httpServer.listen(PORT, () => {
      logger.info(`✓ Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start:", error);
    process.exit(1);
  }
}

/** Gracefully tears down all services and exits */
async function shutdown() {
  logger.info("Shutting down...");
  await shutdownServices();
  process.exit(0);
}

/**
 * Sets up process event handlers for graceful shutdown and error handling
 */
function setupProcessHandlers(_httpServer: Server): void {
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled promise rejection:", reason);
    logger.error("Promise:", promise);
    shutdown();
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception:", error);
    shutdown();
  });
}

start().catch((error) => {
  logger.error("Fatal error during startup:", error);
  process.exit(1);
});
