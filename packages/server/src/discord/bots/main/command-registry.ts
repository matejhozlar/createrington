/**
 * Environment in which a command should be deployed and loaded.
 * - "prod" — deploy and load in all environments
 * - "both" — same as "prod"
 * - "dev"  — skip deployment and loading (WIP/experimental commands)
 */
export type CommandEnv = "dev" | "prod" | "both";

/** Registry mapping command names to their deployment environment */
export const commandRegistry: Record<string, CommandEnv> = {
  // Public
  verify: "prod",
  register: "prod",

  // User
  ping: "prod",
  money: "prod",
  daily: "prod",
  pay: "prod",
  lottery: "prod",
  playtime: "prod",
  seen: "prod",
  skin: "prod",
  compare: "prod",
  status: "prod",
  history: "prod",
  list: "prod",
  crypto: "prod",
  profile: "prod",
  activity: "prod",
  top: "prod",

  // Admin
  username: "prod",
  leaderboard: "prod",
  ticket: "prod",
  cooldown: "prod",
  purge: "prod",
  message: "prod",

  // Owner
  "notification-panel": "prod",
  "ticket-panel": "prod",
  "server-panel": "prod",
  "donate-panel": "prod",
  "command-docs-panel": "prod",
  "force-inactivity-cleanup": "prod",
};
