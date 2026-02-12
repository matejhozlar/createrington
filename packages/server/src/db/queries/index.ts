/**
 * Barrel export for all actual query classes
 * 
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: npm run generate
 * 
 * @example
 * import { PlayerQueries, AdminLogActionQueries } from "@/db/queries";
 */

export { AdminQueries } from "./admin";
export { AdminLogActionQueries } from "./admin/log/action";
export { DiscordGuildMemberJoinQueries } from "./discord/guild/member/join";
export { DiscordGuildMemberLeaveQueries } from "./discord/guild/member/leave";
export { FaqEntryQueries } from "./faq/entry";
export { FaqWelcomeMessageQueries } from "./faq/welcome/message";
export { LeaderboardMessageQueries } from "./leaderboard/message";
export { PlayerQueries } from "./player";
export { PlayerAchievementQueries } from "./player/achievement";
export { PlayerBalanceQueries } from "./player/balance";
export { PlayerBalanceTransactionQueries } from "./player/balance/transaction";
export { PlayerBanQueries } from "./player/ban";
export { PlayerMinecraftStatsQueries } from "./player/minecraft/stats";
export { PlayerPlaytimeDailyQueries } from "./player/playtime/daily";
export { PlayerPlaytimeHourlyQueries } from "./player/playtime/hourly";
export { PlayerPlaytimeSummaryQueries } from "./player/playtime/summary";
export { PlayerSessionQueries } from "./player/session";
export { PlayerStrikeQueries } from "./player/strike";
export { RewardClaimQueries } from "./reward/claim";
export { ServerQueries } from "./server";
export { TicketQueries } from "./ticket";
export { TicketActionQueries } from "./ticket/action";
export { WaitlistEntryQueries } from "./waitlist/entry";
