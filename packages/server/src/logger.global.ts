/**
 * Creates the shared logger instance and registers it globally.
 *
 * Must be imported before any other module that uses `logger`.
 * After this module executes, `logger` is available globally
 * without an explicit import in every file.
 */

import config from "@/config";
import { createLogger, type Logger } from "@createrington/logger";

const loggerInstance: Logger = createLogger({
  logDir: config.utils.logger.logDir,
  keepDays: config.utils.logger.keepDays,
});

declare global {
  var logger: Logger;
}

global.logger = loggerInstance;

export default loggerInstance;
