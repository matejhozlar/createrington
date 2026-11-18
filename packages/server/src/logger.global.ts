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
