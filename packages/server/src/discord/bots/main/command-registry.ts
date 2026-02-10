export type CommandEnv = "dev" | "prod" | "both";

export const commandRegistry: Record<string, CommandEnv> = {
  // Public
  verify: "both",
  register: "both",

  // User
  ping: "both",
  money: "both",
  daily: "both",
  pay: "both",
  playtime: "both",
  list: "both",
  username: "both",

  // Admin
  leaderboard: "both",
  ticket: "both",
  cooldown: "both",
  delete: "both",
  message: "both",
  "ticket-panel": "both",
  "server-panel": "both",
};
