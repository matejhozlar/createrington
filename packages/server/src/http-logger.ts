import config from "@/config";
import { createLogger, type Logger } from "@createrington/logger";

export const httpLogger: Logger = createLogger({
  logDir: config.utils.logger.logDir,
  keepDays: config.utils.logger.keepDays,
  name: "http",
  skipCleanup: true,
});
