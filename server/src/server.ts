import { env } from "@/config/env/env.config";
import "./logger.global";
import http from "node:http";
import { createApp } from "./app";
import mainBot from "./discord/bots/main";

const PORT = env.PORT;

/**
 * Gracefully shuts down the HTTP server and exits the process
 *
 * This function attempts to close all connections and stop the server gracefully
 * If successful, exits with code 0; if an error occurs, exits with code 1
 *
 * @param httpServer - The HTTP server instance to shut down
 * @returns Promise resolving when the shutdown is complete
 */
async function shutdown(httpServer: http.Server): Promise<void> {
  logger.info("Shutting down...");

  try {
    await mainBot.destroy();

    httpServer.close(() => {
      logger.info("Server closed. Exiting...");
      process.exit(0);
    });
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
}

/**
 * Sets up process event handlers for graceful shutdown and error handling
 *
 * Registers handlers for:
 * - SIGINT: Graceful shutdown on Ctrl+C
 * - SIGTERM: Graceful shutdown on termination signal
 * - unhandledRejection: Catches unhandled promise rejections
 * - uncaughtException: Catches uncaught exceptions
 *
 * @param httpServer - The HTTP server instance to manage
 */
function setupProcessHandlers(httpServer: http.Server): void {
  process.on("SIGINT", () => shutdown(httpServer));
  process.on("SIGTERM", () => shutdown(httpServer));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection:", reason);
    shutdown(httpServer);
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception:", error);
    shutdown(httpServer);
  });
}

/**
 * Initializes and starts the HTTP server
 *
 * This function:
 * 1. Creates the Express application
 * 2. Creates an HTTP server instance
 * 3. Sets up process handlers for graceful shutdown
 * 4. Starts listening on the configured PORT
 */
function start(): void {
  const app = createApp();
  const httpServer = http.createServer(app);

  setupProcessHandlers(httpServer);

  httpServer.listen(PORT, () => {
    logger.info(`Server started at http://localhost:${PORT}`);
  });
}

start();

logger.info(mainBot);
