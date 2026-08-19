import { db, Q } from "@/db";
import { DatabaseTable, type DatabaseQueries } from "@/generated/db";
import { NotFoundError } from "@/app/middleware/error-handler";
import { AdminEdit } from "@/types";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";
import type { PlayerIdentifier } from "@/db/repositories/player/base";

/** Who triggered a deletion. `system` covers automated cleanup paths. */
export type DeletionActor =
  | { type: "admin" | "user"; discordId: string; username: string }
  | { type: "system"; username?: string };

/** Snapshot of the removed player, captured before the row is deleted. */
export interface DeletedPlayer {
  minecraftUuid: string;
  discordId: string;
  minecraftUsername: string;
}

export interface DeletePlayerOptions {
  actor: DeletionActor;
  reason: string;
  /** Remove the player from every Minecraft whitelist via RCON. Default true. */
  removeFromWhitelist?: boolean;
  /** Write a DELETE_PLAYER admin_log_action row. Default true. */
  writeAudit?: boolean;
  /** Resolve to null instead of throwing when the player row is already gone. Default false. */
  ignoreMissing?: boolean;
  serverId?: number;
  metadata?: Record<string, unknown>;
  /**
   * Extra DB work to run in the same transaction as the audit row and the
   * player delete, before the delete (e.g. writing a ban record). Lets callers
   * that need atomicity fold their own writes into the deletion transaction.
   */
  beforeDelete?: (tx: DatabaseQueries, player: DeletedPlayer) => Promise<void>;
}

/**
 * The single chokepoint for deleting a player. Owns the DB delete plus the
 * cross-cutting application-level side effects (audit row, RCON whitelist
 * removal) so manual and automated paths cannot drift. Stateless; a singleton
 * is exported at the bottom of this file.
 */
export class PlayerDeletionService {
  async initialize(): Promise<void> {
    logger.info("PlayerDeletionService initialized");
  }

  /**
   * Delete a player and run the cross-cutting side effects. The audit row and
   * the row delete share one transaction (with any caller `beforeDelete` work);
   * whitelist removal runs after commit and never aborts the deletion. Returns
   * the deleted snapshot, or null when `ignoreMissing` is set and no player
   * existed.
   */
  async delete(
    identifier: PlayerIdentifier,
    options: DeletePlayerOptions,
  ): Promise<DeletedPlayer | null> {
    const {
      actor,
      reason,
      removeFromWhitelist = true,
      writeAudit = true,
      ignoreMissing = false,
      serverId,
      metadata,
      beforeDelete,
    } = options;

    const player = await Q.player.find(this.toFilter(identifier));
    if (!player) {
      if (ignoreMissing) return null;
      throw new NotFoundError("Player not found");
    }

    const snapshot: DeletedPlayer = {
      minecraftUuid: player.minecraftUuid,
      discordId: player.discordId,
      minecraftUsername: player.minecraftUsername,
    };

    await db.inTransaction(async (tx) => {
      if (beforeDelete) {
        await beforeDelete(tx, snapshot);
      }

      if (writeAudit) {
        await tx.admin.log.action.create({
          adminDiscordId: actor.type === "system" ? "system" : actor.discordId,
          adminUsername:
            actor.type === "system"
              ? (actor.username ?? "System")
              : actor.username,
          actionType: AdminEdit.DELETE_PLAYER,
          targetPlayerUuid: snapshot.minecraftUuid,
          targetPlayerName: snapshot.minecraftUsername,
          tableName: DatabaseTable.PLAYER.TABLE,
          fieldName: "deleted",
          oldValue: "false",
          newValue: "true",
          reason,
          serverId,
          metadata: {
            discordId: snapshot.discordId,
            minecraftUsername: snapshot.minecraftUsername,
            ...metadata,
          },
        });
      }

      await tx.player.delete({ minecraftUuid: snapshot.minecraftUuid });
    });

    logger.info(
      `Deleted player ${snapshot.minecraftUsername} (${snapshot.minecraftUuid}) by ${this.actorLabel(actor)}: ${reason}`,
    );

    if (removeFromWhitelist) {
      try {
        await minecraftRcon.whitelistAll(
          WhitelistAction.REMOVE,
          snapshot.minecraftUsername,
        );
      } catch (error) {
        logger.error(
          `Failed to remove ${snapshot.minecraftUsername} from whitelist:`,
          error,
        );
      }
    }

    return snapshot;
  }

  private actorLabel(actor: DeletionActor): string {
    if (actor.type === "system") return "system";
    return `${actor.type} ${actor.username}`;
  }

  private toFilter(
    identifier: PlayerIdentifier,
  ):
    | { minecraftUuid: string }
    | { minecraftUsername: string }
    | { discordId: string } {
    if (typeof identifier === "string") return { minecraftUuid: identifier };
    if ("minecraftUuid" in identifier && identifier.minecraftUuid) {
      return { minecraftUuid: identifier.minecraftUuid };
    }
    if ("discordId" in identifier && identifier.discordId) {
      return { discordId: identifier.discordId };
    }
    if ("minecraftUsername" in identifier && identifier.minecraftUsername) {
      return { minecraftUsername: identifier.minecraftUsername };
    }
    throw new NotFoundError("Player not found: invalid identifier");
  }
}

export const playerDeletionService = new PlayerDeletionService();
