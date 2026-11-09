import config from "@/config";
import { Q } from "@/db";
import { DatabaseTable } from "@/generated/db";
import { AppError, ConflictError } from "@/app/middleware/error-handler";
import { waitForPartySync } from "@/app/features/mod/parties/parties.service";
import {
  PartyMembersClient,
  type PartyRemoval,
} from "@/services/mc-server/party-members";
import type { DeletedPlayer, DeletionActor } from "@/services/player/deletion";
import { AdminEdit } from "@/types";
import { minecraftRcon } from "@/utils/rcon";

const SYNC_TIMEOUT_MS = 15_000;
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REASON = "Player is no longer on the server";

export interface PartyPurgeActor {
  discordId: string;
  username: string;
}

export type PartyRemovalTrigger = "deletion" | "purge";

export interface RemovedPartyMember {
  minecraftUuid: string;
  playerName: string;
  partyName: string;
}

export interface PartyPurgeResult {
  serverId: number;
  checked: number;
  removed: RemovedPartyMember[];
  skipped: number;
  failed: number;
}

function auditActor(actor: DeletionActor): PartyPurgeActor {
  return actor.type === "system"
    ? { discordId: "system", username: actor.username ?? "System" }
    : { discordId: actor.discordId, username: actor.username };
}

export function isPartyPurgeAllowed(): boolean {
  return config.envMode.isProductionDeployment;
}

/**
 * Takes players who left the server (their player row is gone) out of their
 * FTB Teams party in game, over RCON through core's `/createrington party`
 * commands; the app's party tables follow with core's next sync. Party owners
 * are never removed. Three triggers share it: the player deletion hook
 * (`removePlayer`, immediate), a daily purge armed by `initialize`, and the
 * admin Parties page's purge. A purge first makes core send a fresh party
 * snapshot and waits for it, then removes every non-owner member without a
 * player row. Every removal writes a REMOVE_PARTY_MEMBER audit row. Only one
 * purge runs at a time. Production deployment only: local dev and
 * dev.createrington.com share the production RCON target.
 */
export class PartyPurgeService {
  private intervalId?: NodeJS.Timeout;
  private purging = false;

  constructor(private readonly client = new PartyMembersClient()) {}

  /** Runs a purge of every server now, then once a day. */
  initialize(): void {
    void this.purgeAllServers();
    this.intervalId = setInterval(() => {
      void this.purgeAllServers();
    }, PURGE_INTERVAL_MS);
    logger.info("PartyPurgeService initialized");
  }

  /** Stops the daily purge. Safe to call multiple times. */
  shutdown(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /** Removes a just-deleted player from their party on every server where they are a non-owner member, audited as whoever ran the deletion. Never throws. */
  async removePlayer(
    player: DeletedPlayer,
    actor: DeletionActor,
  ): Promise<void> {
    for (const serverId of minecraftRcon.getServerIds()) {
      try {
        const membership = await Q.server.party.getForMember(
          serverId,
          player.minecraftUuid,
        );
        if (!membership) continue;
        if (membership.rank === "owner") {
          logger.info(
            `Deleted player ${player.minecraftUsername} owns party ${membership.name} on server ${serverId}, left in it`,
          );
          continue;
        }
        await this.removeMember(
          serverId,
          player.minecraftUuid,
          auditActor(actor),
          "deletion",
        );
      } catch (error) {
        logger.error(
          `Failed to remove deleted player ${player.minecraftUsername} from their party on server ${serverId}:`,
          error,
        );
      }
    }
  }

  /** Syncs a server's parties from core, then removes every non-owner member who left the server. */
  async purge(
    serverId: number,
    actor: PartyPurgeActor | null,
  ): Promise<PartyPurgeResult> {
    if (this.purging) {
      throw new ConflictError("A party purge is already running");
    }
    this.purging = true;
    try {
      await this.syncFromCore(serverId);

      const departed = await Q.server.party.member.getDeparted(serverId);
      const result: PartyPurgeResult = {
        serverId,
        checked: departed.length,
        removed: [],
        skipped: 0,
        failed: 0,
      };

      for (const member of departed) {
        try {
          const removal = await this.removeMember(
            serverId,
            member.minecraftUuid,
            actor,
            "purge",
          );
          if (removal.outcome === "removed") {
            result.removed.push({
              minecraftUuid: member.minecraftUuid,
              playerName: removal.playerName,
              partyName: removal.partyName,
            });
          } else {
            result.skipped++;
          }
        } catch (error) {
          result.failed++;
          logger.error(
            `Party purge on server ${serverId} failed to remove ${member.minecraftUuid} from ${member.partyName}:`,
            error,
          );
        }
      }

      logger.info(
        `Party purge on server ${serverId} by ${actor?.username ?? "system"}: ${result.checked} departed member(s), ${result.removed.length} removed, ${result.skipped} skipped, ${result.failed} failed`,
      );
      return result;
    } finally {
      this.purging = false;
    }
  }

  private async purgeAllServers(): Promise<void> {
    for (const serverId of minecraftRcon.getServerIds()) {
      try {
        await this.purge(serverId, null);
      } catch (error) {
        logger.error(
          `Scheduled party purge on server ${serverId} failed:`,
          error,
        );
      }
    }
  }

  private async syncFromCore(serverId: number): Promise<void> {
    const synced = waitForPartySync(serverId, SYNC_TIMEOUT_MS);
    try {
      await this.client.sync(serverId);
    } catch (error) {
      throw new AppError(
        `Could not ask the Minecraft server for its parties: ${error instanceof Error ? error.message : String(error)}`,
        503,
      );
    }
    if (!(await synced)) {
      throw new AppError(
        `The Minecraft server did not send its parties within ${SYNC_TIMEOUT_MS / 1000} seconds, nothing was removed`,
        503,
      );
    }
  }

  private async removeMember(
    serverId: number,
    minecraftUuid: string,
    actor: PartyPurgeActor | null,
    trigger: PartyRemovalTrigger,
  ): Promise<PartyRemoval> {
    const removal = await this.client.remove(serverId, minecraftUuid);
    if (removal.outcome !== "removed") {
      logger.info(
        `Party removal of ${removal.playerName} (${minecraftUuid}) on server ${serverId} skipped: ${removal.outcome === "owner" ? `owns ${removal.partyName}` : "not in a party"}`,
      );
      return removal;
    }

    logger.info(
      `Removed ${removal.playerName} (${minecraftUuid}) from party ${removal.partyName} on server ${serverId} (${trigger})`,
    );
    try {
      await Q.admin.log.action.create({
        adminDiscordId: actor?.discordId ?? "system",
        adminUsername: actor?.username ?? "System",
        actionType: AdminEdit.REMOVE_PARTY_MEMBER,
        targetPlayerUuid: minecraftUuid,
        targetPlayerName: removal.playerName,
        tableName: DatabaseTable.SERVER_PARTY_MEMBER.TABLE,
        fieldName: "party",
        oldValue: removal.partyName,
        newValue: null,
        reason: REASON,
        serverId,
        metadata: { trigger },
      });
    } catch (error) {
      logger.error(
        `Failed to write the audit row for removing ${minecraftUuid} from ${removal.partyName}:`,
        error,
      );
    }
    return removal;
  }
}

export const partyPurgeService = new PartyPurgeService();
