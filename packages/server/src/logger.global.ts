/**
 * Registers the logger as a global variable
 *
 * Must be imported before any other module that uses `logger`.
 * After this module executes, `logger` is available globally
 * without an explicit import in every file.
 */

import loggerInstance from "./logger";

declare global {
  var logger: typeof loggerInstance;
}

global.logger = loggerInstance;

export {};
