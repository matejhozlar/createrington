import config from "@/config";
import { createLogger, type Logger } from "@createrington/logger";

export const httpLogger: Logger = createLogger({
  logDir: config.utils.logger.logDir,
  keepDays: config.utils.logger.keepDays,
  name: "http",
  skipCleanup: true,
});

export function colorDuration(ms: number): string {
  if (ms < 100) return `\x1b[32m${ms}ms\x1b[0m`;
  if (ms < 500) return `\x1b[33m${ms}ms\x1b[0m`;
  return `\x1b[31m${ms}ms\x1b[0m`;
}
