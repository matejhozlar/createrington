import { defineCustomId } from "@/discord/utils/custom-id";

export const CustomIds = {
  departedDeleteNow: defineCustomId("departed:delete-now", ["departedId"]),
  embedAction: defineCustomId("embed-action", ["presetId", "buttonIndex"]),
  leaderboardRefresh: defineCustomId("leaderboard:refresh", ["type"]),
  promptRespond: defineCustomId("prompt:respond", ["promptId"]),
  promptSubmit: defineCustomId("prompt:submit", ["promptId"]),
  registrationClose: defineCustomId("registration:close"),
  registrationOpen: defineCustomId("registration:open"),
  registrationSubmit: defineCustomId("registration:submit"),
  rolePanel: defineCustomId("role-panel", ["roleId"]),
  ticket: defineCustomId("ticket", ["action", "target"]),
  waitlist: defineCustomId("waitlist", ["action"]),
  workshopSuggest: defineCustomId("workshop-suggest", ["target"]),
} as const;
