import { Q } from "@/db";
import { NotFoundError } from "@/errors";
import { fetchGuildMember } from "@/discord/utils/fetch-guild-member";
import { playerDeletionService } from "@/services/player/deletion";
import type { AuthSession } from "@createrington/shared/db/auth_session.types";

export interface AccountOwner {
  discordId: string;
  minecraftUuid: string;
}

const HIDDEN_TRANSACTION_FIELDS = ["metadata"] as const;
const HIDDEN_BAN_FIELDS = [
  "bannedByDiscordId",
  "bannedByUsername",
  "unbannedByDiscordId",
  "unbannedByUsername",
  "metadata",
] as const;
const HIDDEN_STRIKE_FIELDS = [
  "issuedByDiscordId",
  "issuedByUsername",
  "removedByDiscordId",
  "removedByUsername",
  "metadata",
] as const;
const HIDDEN_TICKET_FIELDS = ["closedByDiscordId", "metadata"] as const;

const newestFirst = <K extends string>(orderBy: K) => ({
  orderBy,
  orderDirection: "desc" as const,
});

function omit<T extends object, K extends keyof T>(
  row: T,
  keys: readonly K[],
): Omit<T, K> {
  const copy = { ...row };
  for (const key of keys) delete copy[key];
  return copy;
}

function toPlainJson(data: unknown): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(data, (_key, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  ) as Record<string, unknown>;
}

/** The public view of a web session: no token hash, family id or revocation state. */
export function toSessionView(session: AuthSession) {
  return {
    id: session.id,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    createdAt: session.createdAt.toISOString(),
    lastUsedAt: session.lastUsedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  };
}

/**
 * Self-service account operations for a signed-in player: a full export of
 * their personal data (staff identities and internal metadata stripped,
 * BigInts and dates as JSON strings) and permanent account deletion, which
 * goes through the player deletion chokepoint and then kicks them from
 * Discord. Stateless singleton.
 */
class PlayerAccountService {
  /** Every table that holds the player's data, as one JSON-safe object. */
  async exportData({
    discordId,
    minecraftUuid,
  }: AccountOwner): Promise<Record<string, unknown>> {
    const byPlayer = { playerMinecraftUuid: minecraftUuid };
    const byUuid = { minecraftUuid };

    const [
      player,
      sessions,
      balance,
      balanceTransactions,
      gameSessions,
      playtimeDaily,
      playtimeHourly,
      playtimeSummary,
      minecraftStats,
      bans,
      strikes,
      rewardClaims,
      tickets,
    ] = await Promise.all([
      Q.player.find({ discordId }),
      Q.auth.session.getActiveSessions(discordId),
      Q.player.balance.find(byUuid).catch(() => null),
      Q.player.balance.transaction.findAll(byPlayer, newestFirst("createdAt")),
      Q.player.session.findAll(byPlayer, newestFirst("sessionStart")),
      Q.player.playtime.daily.findAll(byPlayer, newestFirst("playDate")),
      Q.player.playtime.hourly.findAll(byPlayer, newestFirst("playHour")),
      Q.player.playtime.summary.findAll(byPlayer),
      Q.player.minecraft.stats.findAll(byUuid),
      Q.player.ban.findAll(byPlayer, newestFirst("bannedAt")),
      Q.player.strike.findAll(byPlayer, newestFirst("issuedAt")),
      Q.reward.claim.findAll(byPlayer, newestFirst("claimedAt")),
      Q.ticket.findAll(
        { creatorDiscordId: discordId },
        newestFirst("createdAt"),
      ),
    ]);

    return toPlainJson({
      exportedAt: new Date().toISOString(),
      player: player ?? null,
      sessions: sessions.map(toSessionView),
      balance,
      balanceTransactions: balanceTransactions.map((row) =>
        omit(row, HIDDEN_TRANSACTION_FIELDS),
      ),
      gameSessions,
      playtime: {
        daily: playtimeDaily,
        hourly: playtimeHourly,
        summary: playtimeSummary,
      },
      minecraftStats,
      moderation: {
        bans: bans.map((row) => omit(row, HIDDEN_BAN_FIELDS)),
        strikes: strikes.map((row) => omit(row, HIDDEN_STRIKE_FIELDS)),
      },
      rewardClaims,
      tickets: tickets.map((row) => omit(row, HIDDEN_TICKET_FIELDS)),
    });
  }

  /** Deletes the player with their tickets, then kicks them from Discord (best effort). */
  async deleteAccount(discordId: string): Promise<void> {
    const player = await Q.player.find({ discordId });
    if (!player) throw new NotFoundError("Player not found");

    await playerDeletionService.delete(
      { discordId },
      {
        actor: { type: "user", discordId, username: player.minecraftUsername },
        reason: "Account deleted by user",
        beforeDelete: async (tx) => {
          await tx.ticket.deleteAll({ creatorDiscordId: discordId });
        },
      },
    );

    try {
      const member = await fetchGuildMember(discordId);
      if (member) {
        await member.kick("Account deleted by user");
        logger.info(
          `Kicked ${player.minecraftUsername} from Discord after account deletion`,
        );
      }
    } catch (error) {
      logger.warn(
        `Failed to kick ${player.minecraftUsername} from Discord after account deletion:`,
        error,
      );
    }
  }
}

export const playerAccountService = new PlayerAccountService();
