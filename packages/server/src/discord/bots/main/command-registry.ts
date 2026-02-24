/** Environment in which a command should be deployed and loaded */
export type CommandEnv = "dev" | "prod" | "both";

/** Registry mapping command names to their deployment environment */
export const commandRegistry: Record<string, CommandEnv> = {
  // Public
  verify: "both",
  register: "both",

  // User
  ping: "both",
  money: "both",
  daily: "both",
  pay: "both",
  lottery: "both",
  playtime: "both",
  seen: "both",
  skin: "both",
  coinflip: "both",
  compare: "both",
  status: "both",
  history: "both",
  list: "both",
  username: "both",

  // Admin
  leaderboard: "both",
  ticket: "both",
  cooldown: "both",
  purge: "both",
  message: "both",
  "ticket-panel": "both",
  "server-panel": "both",
};
