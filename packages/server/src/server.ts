/**
 * Application entry point
 *
 * Initializes the global logger, bootstraps all services via the DI
 * container, starts the HTTP server, and wires up graceful shutdown.
 */

import "./logger.global";
import config from "@/config";
import { initializeServices, shutdownServices } from "@/services/bootstrap";
import { container, Services } from "@/services";

/** Bootstraps services and starts listening for HTTP requests */
async function start() {
  try {
    await initializeServices();

    const httpServer = await container.get(Services.HTTP_SERVER);
    setupProcessHandlers();
    httpServer.listen(config.app.port, () => {
      logger.info(`✓ Server running on port ${config.app.port}`);
    });
  } catch (error) {
    logger.error("Failed to start:", error);
    process.exit(1);
  }
}

/** Gracefully tears down all services and exits */
async function shutdown() {
  logger.info("Shutting down...");
  try {
    await shutdownServices();
  } catch (error) {
    logger.error("Service shutdown failed:", error);
  }
  process.exit(0);
}

/**
 * Sets up process event handlers for graceful shutdown and error handling
 */
function setupProcessHandlers(): void {
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled promise rejection:", reason);
    logger.error("Promise:", promise);
    void shutdown();
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception:", error);
    void shutdown();
  });
}

start().catch((error) => {
  logger.error("Fatal error during startup:", error);
  process.exit(1);
});
