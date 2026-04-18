export * from "./types";
export { DiscordRateLimiter } from "./rate-limiter";
export { BucketManager } from "./bucket-manager";
export { QueueManager } from "./queue-manager";

import { DiscordRateLimiter } from "./rate-limiter";

/**
 * Global rate limiter instance
 */
export const discordRateLimiter = new DiscordRateLimiter();

process.on("SIGTERM", async () => {
  await discordRateLimiter.shutdown();
});

process.on("SIGINT", async () => {
  await discordRateLimiter.shutdown();
});
