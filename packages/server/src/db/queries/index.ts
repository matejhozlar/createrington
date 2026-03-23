/**
 * Barrel export for all actual query classes
 *
 * Auto-generated from database schema
 * DO NOT EDIT MANUALLY - regenerate with: pnpm generate
 *
 * @example
 * import { PlayerQueries, AdminLogActionQueries } from "@/db/queries";
 */

export { AdminQueries } from "./admin";
export { AdminLogActionQueries } from "./admin/log/action";
export { AuthSessionQueries } from "./auth/session";
export { CryptoCostBasisQueries } from "./crypto/cost/basis";
export { CryptoHoldingQueries } from "./crypto/holding";
export { CryptoMarketEventQueries } from "./crypto/market/event";
export { CryptoOrderQueries } from "./crypto/order";
export { CryptoPortfolioSnapshotQueries } from "./crypto/portfolio/snapshot";
export { CryptoPriceAlertQueries } from "./crypto/price/alert";
export { CryptoPriceSnapshotQueries } from "./crypto/price/snapshot";
export { CryptoTokenQueries } from "./crypto/token";
export { CryptoTransactionQueries } from "./crypto/transaction";
export { CryptoTreasuryQueries } from "./crypto/treasury";
export { CryptoWatchlistQueries } from "./crypto/watchlist";
export { DiscordAutoMessageQueries } from "./discord/auto/message";
export { DiscordAutoMessageConfigQueries } from "./discord/auto/message/config";
export { DiscordCommandUsageQueries } from "./discord/command/usage";
export { DiscordEmbedPresetQueries } from "./discord/embed/preset";
export { DiscordEmbedPresetCategoryQueries } from "./discord/embed/preset/category";
export { DiscordEmbedPresetMessageQueries } from "./discord/embed/preset/message";
export { DiscordGuildMemberJoinQueries } from "./discord/guild/member/join";
export { DiscordGuildMemberLeaveQueries } from "./discord/guild/member/leave";
export { DonationQueries } from "./donation";
export { FaqEntryQueries } from "./faq/entry";
export { FaqWelcomeMessageQueries } from "./faq/welcome/message";
export { LeaderboardMessageQueries } from "./leaderboard/message";
export { LotteryParticipantQueries } from "./lottery/participant";
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
export { ServerMaintenanceScheduleQueries } from "./server/maintenance/schedule";
export { TicketQueries } from "./ticket";
export { TicketActionQueries } from "./ticket/action";
export { WaitlistEntryQueries } from "./waitlist/entry";
