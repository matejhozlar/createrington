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
  coinflip: "prod",
  compare: "prod",
  status: "prod",
  history: "prod",
  list: "prod",
  username: "prod",
  crypto: "prod",

  // Admin
  leaderboard: "prod",
  ticket: "prod",
  cooldown: "prod",
  purge: "prod",
  message: "prod",
  "ticket-panel": "prod",
  "server-panel": "prod",
};
