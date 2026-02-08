import "./logger.global";
import { env } from "@/config/env/env.config";
import { initializeServices, shutdownServices } from "@/services/bootstrap";
import { container, Services } from "@/services";
import type { Server as HttpServer } from "node:http";

const PORT = env.PORT;

async function start() {
  try {
    // Initialize everything
    await initializeServices();

    // Start HTTP server
    const httpServer = await container.get<HttpServer>(Services.HTTP_SERVER);
    setupProcessHandlers(httpServer);
    httpServer.listen(PORT, () => {
      logger.info(`✓ Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start:", error);
    process.exit(1);
  }
}

async function shutdown() {
  logger.info("Shutting down...");
  await shutdownServices();
  process.exit(0);
}

/**
 * Sets up process event handlers for graceful shutdown and error handling
 */
function setupProcessHandlers(httpServer: HttpServer): void {
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
