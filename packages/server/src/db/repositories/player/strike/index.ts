import { db, Q } from "@/db";
import { DatabaseTable } from "@/generated/db";
import type {
  PlayerStrike,
  StrikeClassification,
} from "@createrington/shared/db";
import type { StrikeStatistics } from "@/db/queries/player/strike";
import { BasePlayerRepository, type PlayerIdentifier } from "../base";

/**
 * Player strike lifecycle: issue, pardon, history, and active-count batching.
 * Each mutation writes a paired admin_log_action entry in the same DB
 * transaction.
 */
export class PlayerStrikeRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  /** Issue a new strike and write its admin_log_action entry in one transaction. */
  async issue(
    identifier: PlayerIdentifier,
    data: {
      classification: StrikeClassification;
      description: string;
      severity: 1 | 2 | 3 | 4 | 5;
      serverId?: number;
      metadata?: Record<string, unknown>;
    },
    adminDiscordId: string,
    adminUsername: string,
  ): Promise<PlayerStrike> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    return await db.inTransaction(async (tx) => {
      const strike = await tx.player.strike.createAndReturn({
        playerMinecraftUuid: uuid,
        classification: data.classification,
        description: data.description,
        severity: data.severity,
        issuedByDiscordId: adminDiscordId,
        issuedByUsername: adminUsername,
        serverId: data.serverId,
        metadata: data.metadata || {},
      });

      await tx.admin.log.action.create({
        adminDiscordId,
        adminUsername,
        actionType: "strike_issued",
        targetPlayerUuid: uuid,
        targetPlayerName: player.minecraftUsername,
        tableName: DatabaseTable.PLAYER_STRIKE.TABLE,
        fieldName: DatabaseTable.PLAYER_STRIKE.FIELDS.CLASSIFICATION,
        oldValue: null,
        newValue: data.classification,
        reason: data.description,
        serverId: data.serverId,
        metadata: {
          strikeId: strike.id,
          severity: data.severity,
        },
      });

      logger.info(
        `Strike #${strike.id} issued to ${player.minecraftUsername} (${uuid}) by ${adminUsername}: ${data.classification}`,
      );

      return strike;
    });
  }

  /** Pardon a strike by ID; throws if it was already removed. */
  async remove(
    strikeId: number,
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<PlayerStrike> {
    const strike = await Q.player.strike.get({ id: strikeId });

    if (strike.removed) {
      throw new Error(`Strike #${strikeId} has already been removed`);
    }

    const player = await Q.player.get({
      minecraftUuid: strike.playerMinecraftUuid,
    });

    return await db.inTransaction(async (tx) => {
      const updatedStrike = await tx.player.strike.updateAndReturn(
        { id: strikeId },
        {
          removed: true,
          removedByDiscordId: adminDiscordId,
          removedByUsername: adminUsername,
          removedAt: new Date(),
          removalReason: reason,
        },
      );

      await tx.admin.log.action.create({
        adminDiscordId,
        adminUsername,
        actionType: "strike_removed",
        targetPlayerUuid: strike.playerMinecraftUuid,
        targetPlayerName: player.minecraftUsername,
        tableName: DatabaseTable.PLAYER_STRIKE.TABLE,
        fieldName: DatabaseTable.PLAYER_STRIKE.FIELDS.REMOVED,
        oldValue: "false",
        newValue: "true",
        reason,
        serverId: strike.serverId || undefined,
        metadata: {
          strikeId,
          originalClassification: strike.classification,
          originalSeverity: strike.severity,
        },
      });

      logger.info(
        `Strike #${strikeId} removed for ${player.minecraftUsername} by ${adminUsername}: ${reason}`,
      );

      return updatedStrike;
    });
  }

  /** Full strike history for a player; pass activeOnly=true to skip removed strikes. */
  async getHistory(
    identifier: PlayerIdentifier,
    activeOnly: boolean = false,
  ): Promise<PlayerStrike[]> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.strike.getStrikeHistory(uuid, !activeOnly);
  }

  /** Alias of getHistory(). */
  async get(
    identifier: PlayerIdentifier,
    activeOnly: boolean = false,
  ): Promise<PlayerStrike[]> {
    return this.getHistory(identifier, activeOnly);
  }

  /** Batched UUID -> active strike count map, for list views. */
  async getActiveStrikeCounts(
    playerUuids: string[],
  ): Promise<Record<string, number>> {
    return await Q.player.strike.getActiveStrikeCounts(playerUuids);
  }

  /** Aggregate strike statistics for a single player. */
  async getStatistics(identifier: PlayerIdentifier): Promise<StrikeStatistics> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.strike.getPlayerStatistics(uuid);
  }

  /** Number of strikes currently active (not removed) for the player. */
  async countActive(identifier: PlayerIdentifier): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.strike.countActiveStrikes(uuid);
  }
}
