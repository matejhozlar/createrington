import { db, Q } from "@/db/pool";
import { DatabaseTable, type DatabaseQueries } from "@/generated/db";
import type { PlayerBan } from "@createrington/shared/db";
import { BasePlayerRepository, type PlayerIdentifier } from "../base";
import type { BanStatistics } from "@/db/queries/player/ban";
import { NotFoundError } from "@/db/utils";

/**
 * Player ban lifecycle: issuing temporary or permanent bans, unbanning, and
 * querying a player's history and statistics. The expired-ban sweep lives in
 * PlayerBanService.
 * Every mutation writes a paired admin_log_action entry inside the same DB
 * transaction. Permanent bans cascade-delete the player row. Issuing a ban
 * locks the player row before checking for an active ban, so two bans issued
 * at once for one player end as one ban and one "already banned" error.
 */
export class PlayerBanRepository extends BasePlayerRepository {
  private async findCurrentBanLocked(
    tx: DatabaseQueries,
    minecraftUuid: string,
  ): Promise<PlayerBan | null> {
    if (!(await tx.player.lockForUpdate(minecraftUuid))) {
      throw new NotFoundError("player", { minecraftUuid });
    }
    return tx.player.ban.findCurrentBan(minecraftUuid);
  }

  /**
   * Issue a temporary ban that expires at the given timestamp. Rejects if the
   * player already has an active ban or if expiresAt is not in the future.
   * Pass options.tx to join an outer transaction, so work after it can still roll the ban back.
   */
  async issueTemporary(
    identifier: PlayerIdentifier,
    data: {
      reason: string;
      expiresAt: Date;
      serverId?: number;
      metadata?: Record<string, unknown>;
    },
    adminDiscordId: string,
    adminUsername: string,
    { tx: outerTx }: { tx?: DatabaseQueries } = {},
  ): Promise<PlayerBan> {
    const uuid = await this.resolvePlayerUuid(identifier, { tx: outerTx });
    const player = await (outerTx ?? Q).player.get({ minecraftUuid: uuid });

    if (data.expiresAt <= new Date()) {
      throw new Error("Ban expiry must be in the future");
    }

    return await (outerTx ?? db).inTransaction(async (tx) => {
      const existingBan = await this.findCurrentBanLocked(tx, uuid);
      if (existingBan) {
        throw new Error(
          `Player is already banned (Ban #${existingBan.id}, expires: ${existingBan.expiresAt ? existingBan.expiresAt.toISOString() : "permanent"})`,
        );
      }

      const ban = await tx.player.ban.createAndReturn({
        playerMinecraftUuid: uuid,
        banType: "temporary",
        reason: data.reason,
        bannedByDiscordId: adminDiscordId,
        bannedByUsername: adminUsername,
        expiresAt: data.expiresAt,
        serverId: data.serverId,
        metadata: data.metadata || {},
      });

      await tx.admin.log.action.create({
        adminDiscordId,
        adminUsername,
        actionType: "ban_player_temporary",
        targetPlayerUuid: uuid,
        targetPlayerName: player.minecraftUsername,
        tableName: DatabaseTable.PLAYER_BAN.TABLE,
        fieldName: DatabaseTable.PLAYER_BAN.FIELDS.BAN_TYPE,
        oldValue: null,
        newValue: "temporary",
        reason: data.reason,
        serverId: data.serverId,
        metadata: {
          banId: ban.id,
          expiresAt: data.expiresAt.toISOString(),
        },
      });

      logger.info(
        `Temporary ban #${ban.id} issued to ${player.minecraftUsername} (${uuid}) by ${adminUsername}, expires: ${data.expiresAt.toISOString()}`,
      );

      return ban;
    });
  }

  /**
   * Create a permanent ban record plus its audit row, returning a pre-cascade
   * snapshot of the ban. Does not delete the player: the caller
   * (PlayerDeletionService) passes options.tx and deletes the player in the
   * same transaction, which cascade-removes this ban row. Rejects if the player
   * already has an active ban.
   */
  async createPermanent(
    player: {
      minecraftUuid: string;
      discordId: string;
      minecraftUsername: string;
    },
    data: {
      reason: string;
      serverId?: number;
      metadata?: Record<string, unknown>;
    },
    adminDiscordId: string,
    adminUsername: string,
    { tx: outerTx }: { tx?: DatabaseQueries } = {},
  ): Promise<PlayerBan> {
    return await (outerTx ?? db).inTransaction(async (tx) => {
      const existingBan = await this.findCurrentBanLocked(
        tx,
        player.minecraftUuid,
      );
      if (existingBan) {
        throw new Error(
          `Player is already banned (Ban #${existingBan.id}). Use unban first if you want to change ban type.`,
        );
      }

      const ban = await tx.player.ban.createAndReturn({
        playerMinecraftUuid: player.minecraftUuid,
        banType: "permanent",
        reason: data.reason,
        bannedByDiscordId: adminDiscordId,
        bannedByUsername: adminUsername,
        expiresAt: null,
        serverId: data.serverId,
        metadata: data.metadata || {},
      });

      await tx.admin.log.action.create({
        adminDiscordId,
        adminUsername,
        actionType: "ban_player_permanent",
        targetPlayerUuid: player.minecraftUuid,
        targetPlayerName: player.minecraftUsername,
        tableName: DatabaseTable.PLAYER_BAN.TABLE,
        fieldName: DatabaseTable.PLAYER_BAN.FIELDS.BAN_TYPE,
        oldValue: null,
        newValue: "permanent",
        reason: data.reason,
        serverId: data.serverId,
        metadata: {
          banId: ban.id,
          discordId: player.discordId,
          minecraftUsername: player.minecraftUsername,
        },
      });

      logger.warn(
        `PERMANENT BAN: Player ${player.minecraftUsername} (${player.minecraftUuid}) permanently banned by ${adminUsername}. Reason: ${data.reason}`,
      );

      return ban;
    });
  }

  /**
   * Lift a ban by ID. Works for both ban types, but permanent bans that
   * already cascade-deleted the player cannot be undone; the player record
   * stays gone. Pass options.tx to join an outer transaction, so work after
   * it can still keep the ban in place.
   */
  async unban(
    banId: number,
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
    { tx: outerTx }: { tx?: DatabaseQueries } = {},
  ): Promise<PlayerBan> {
    const ban = await (outerTx ?? Q).player.ban.get({ id: banId });

    if (ban.unbanned) {
      throw new Error(`Ban #${banId} has already been lifted`);
    }

    const { minecraftUsername: playerName } = await (outerTx ?? Q).player.get({
      minecraftUuid: ban.playerMinecraftUuid,
    });

    return await (outerTx ?? db).inTransaction(async (tx) => {
      const updatedBan = await tx.player.ban.updateAndReturn(
        { id: banId },
        {
          unbanned: true,
          unbannedByDiscordId: adminDiscordId,
          unbannedByUsername: adminUsername,
          unbannedAt: new Date(),
          unbanReason: reason,
        },
      );

      await tx.admin.log.action.create({
        adminDiscordId,
        adminUsername,
        actionType: "unban_player",
        targetPlayerUuid: ban.playerMinecraftUuid,
        targetPlayerName: playerName,
        tableName: DatabaseTable.PLAYER_BAN.TABLE,
        fieldName: DatabaseTable.PLAYER_BAN.FIELDS.UNBANNED,
        oldValue: "false",
        newValue: "true",
        reason,
        serverId: ban.serverId || undefined,
        metadata: {
          banId,
          originalBanType: ban.banType,
          originalReason: ban.reason,
        },
      });

      logger.info(
        `Ban #${banId} lifted for ${playerName} by ${adminUsername}: ${reason}`,
      );

      return updatedBan;
    });
  }

  /** The player's currently active ban row, or null. */
  async findCurrent(identifier: PlayerIdentifier): Promise<PlayerBan | null> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.ban.findCurrentBan(uuid);
  }

  /** Full ban history for a player; pass includeUnbanned: false to skip lifted bans. */
  async getHistory(
    identifier: PlayerIdentifier,
    options: { includeUnbanned?: boolean } = {},
  ): Promise<PlayerBan[]> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.ban.getBanHistory(uuid, options);
  }

  /** Aggregate ban statistics for a single player. */
  async getStatistics(identifier: PlayerIdentifier): Promise<BanStatistics> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.ban.getPlayerStatistics(uuid);
  }
}
