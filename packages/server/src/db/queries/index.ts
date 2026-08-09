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
export { CryptoSettingQueries } from "./crypto/setting";
export { CryptoTokenQueries } from "./crypto/token";
export { CryptoTransactionQueries } from "./crypto/transaction";
export { CryptoTreasuryQueries } from "./crypto/treasury";
export { CryptoWatchlistQueries } from "./crypto/watchlist";
export { CurseforgeProjectQueries } from "./curseforge/project";
export { DiscordAutoMessageQueries } from "./discord/auto/message";
export { DiscordAutoMessageConfigQueries } from "./discord/auto/message/config";
export { DiscordAutoMessageFollowupQueries } from "./discord/auto/message/followup";
export { DiscordCommandUsageQueries } from "./discord/command/usage";
export { DiscordEmbedPresetQueries } from "./discord/embed/preset";
export { DiscordEmbedPresetCategoryQueries } from "./discord/embed/preset/category";
export { DiscordEmbedPresetMessageQueries } from "./discord/embed/preset/message";
export { DiscordGuildMemberJoinQueries } from "./discord/guild/member/join";
export { DiscordGuildMemberLeaveQueries } from "./discord/guild/member/leave";
export { DonationQueries } from "./donation";
export { FaqEntryQueries } from "./faq/entry";
export { FaqWelcomeMessageQueries } from "./faq/welcome/message";
export { FeatureFlagQueries } from "./feature/flag";
export { LeaderboardMessageQueries } from "./leaderboard/message";
export { LotteryParticipantQueries } from "./lottery/participant";
export { ModpackQueries } from "./modpack";
export { ModpackModQueries } from "./modpack/mod";
export { ModpackReleaseQueries } from "./modpack/release";
export { ModpackReleaseModQueries } from "./modpack/release/mod";
export { PlayerQueries } from "./player";
export { PlayerAchievementQueries } from "./player/achievement";
export { PlayerBalanceQueries } from "./player/balance";
export { PlayerBalanceTransactionQueries } from "./player/balance/transaction";
export { PlayerBanQueries } from "./player/ban";
export { PlayerInactivityWarningQueries } from "./player/inactivity/warning";
export { PlayerMinecraftStatsQueries } from "./player/minecraft/stats";
export { PlayerPlaytimeDailyQueries } from "./player/playtime/daily";
export { PlayerPlaytimeHourlyQueries } from "./player/playtime/hourly";
export { PlayerPlaytimeSummaryQueries } from "./player/playtime/summary";
export { PlayerPromptQueries } from "./player/prompt";
export { PlayerPromptResponseQueries } from "./player/prompt/response";
export { PlayerSessionQueries } from "./player/session";
export { PlayerStrikeQueries } from "./player/strike";
export { RewardClaimQueries } from "./reward/claim";
export { ServerQueries } from "./server";
export { ServerAllyFakePartyQueries } from "./server/ally/fake/party";
export { ServerAllyFakePartyMemberQueries } from "./server/ally/fake/party/member";
export { ServerAllyPartyQueries } from "./server/ally/party";
export { ServerAllyQualifiedPlayerQueries } from "./server/ally/qualified/player";
export { ServerChunkQueries } from "./server/chunk";
export { ServerForceloadChunkQueries } from "./server/forceload/chunk";
export { ServerForceloadMemberQueries } from "./server/forceload/member";
export { ServerForceloadPartyQueries } from "./server/forceload/party";
export { ServerForceloadPlayerQueries } from "./server/forceload/player";
export { ServerMaintenanceScheduleQueries } from "./server/maintenance/schedule";
export { StructurePackQueries } from "./structure/pack";
export { StructurePackBoostQueries } from "./structure/pack/boost";
export { StructurePackModQueries } from "./structure/pack/mod";
export { StructurePackRotationQueries } from "./structure/pack/rotation";
export { StructurePackRotationConfigQueries } from "./structure/pack/rotation/config";
export { TicketQueries } from "./ticket";
export { TicketActionQueries } from "./ticket/action";
export { WaitlistEntryQueries } from "./waitlist/entry";
export { WorkshopQueries } from "./workshop";
export { WorkshopModQueries } from "./workshop/mod";
export { WorkshopModUpvoteQueries } from "./workshop/mod/upvote";
export { WorkshopPollQueries } from "./workshop/poll";
export { WorkshopPollBallotQueries } from "./workshop/poll/ballot";
export { WorkshopPollModQueries } from "./workshop/poll/mod";
export { WorkshopProjectDependencyQueries } from "./workshop/project/dependency";
