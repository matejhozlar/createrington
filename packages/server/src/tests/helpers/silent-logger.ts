import type { Logger } from "@createrington/logger";

const ignore = () => {};

export const silentLogger: Logger = {
  debug: ignore,
  info: ignore,
  warn: ignore,
  error: ignore,
  log: ignore,
  close: ignore,
};
