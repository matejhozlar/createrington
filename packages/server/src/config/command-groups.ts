/** Maps command names to logical display groups for player-facing docs. */
export const COMMAND_GROUPS: Record<string, string> = {
  verify: "Getting Started",
  register: "Getting Started",
  money: "Economy",
  daily: "Economy",
  pay: "Economy",
  lottery: "Economy",
  history: "Economy",
  playtime: "Player Info",
  compare: "Player Info",
  profile: "Player Info",
  activity: "Player Info",
  seen: "Player Info",
  skin: "Player Info",
  top: "Player Info",
  ping: "Server",
  status: "Server",
  list: "Server",
};

/** Ordered list of group names for display. */
export const GROUP_ORDER = [
  "Getting Started",
  "Economy",
  "Player Info",
  "Server",
];
