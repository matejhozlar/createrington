import { Q } from "@/db";
import { BadRequestError, ConflictError } from "@/errors";
import { fetchGuildMember } from "@/discord/utils/fetch-guild-member";
import { RoleManager } from "@/discord/utils/roles/role-manager";
import { Discord } from "@/discord/constants";
import { minecraftRcon } from "@/utils/rcon";
import { sessionService } from "@/services/auth/session/session.service";
import { adminStatusService } from "@/services/auth/admin-status/admin-status.service";

export interface AdminRoleActor {
  discordId: string;
  minecraftUsername: string;
}

export interface DeopResult {
  serverId: number;
  success: boolean;
  error?: string;
}

/**
 * Grants and revokes admin rights across every place they live: the admin
 * table (and its cached status), web sessions, the Discord ADMIN role and,
 * on demote, operator status on every Minecraft server. The DB and session
 * steps are authoritative and run first; the Discord and RCON steps are best
 * effort and reported back to the caller. Every change is audited. Stateless
 * singleton.
 */
class AdminRoleService {
  /** Adds the admin row and the Discord ADMIN role. Never ops in game: the owner does that per trust. */
  async promote(
    discordId: string,
    reason: string | undefined,
    actor: AdminRoleActor,
  ) {
    if (await Q.admin.find({ discordId })) {
      throw new ConflictError("User is already an admin");
    }

    const player = await Q.player.find({ discordId });

    await Q.admin.create({ discordId });
    adminStatusService.invalidate(discordId);

    let discordRoleAdded = false;
    try {
      const member = await fetchGuildMember(discordId);
      if (member) {
        discordRoleAdded = await RoleManager.assign(
          member,
          Discord.Roles.ADMIN,
          reason ?? `Promoted by ${actor.minecraftUsername}`,
        );
      }
    } catch (error) {
      logger.error(
        `[admin-promote] Failed to add Discord ADMIN role for ${discordId}:`,
        error,
      );
    }

    await Q.admin.log.action.logAction({
      adminDiscordId: actor.discordId,
      adminUsername: actor.minecraftUsername,
      actionType: "admin_promote",
      description: `Promoted ${player?.minecraftUsername ?? discordId} to admin`,
      targetPlayerUuid: player?.minecraftUuid,
      targetPlayerName: player?.minecraftUsername,
      reason,
      metadata: { discordRoleAdded },
    });

    return {
      discordRoleAdded,
      minecraftUsername: player?.minecraftUsername ?? null,
    };
  }

  /** Removes the admin row, signs the user out, drops the Discord role and deops them on every server. */
  async demote(
    discordId: string,
    reason: string | undefined,
    actor: AdminRoleActor,
  ) {
    if (discordId === actor.discordId) {
      throw new BadRequestError("You can't demote yourself");
    }

    const player = await Q.player.find({ discordId });
    const dbEntry = await Q.admin.find({ discordId });

    if (dbEntry) {
      await Q.admin.delete({ discordId });
    }

    adminStatusService.invalidate(discordId);
    await sessionService.revokeAllForUser(discordId);

    let discordRoleRemoved = false;
    try {
      const member = await fetchGuildMember(discordId);
      if (member?.roles.cache.has(Discord.Roles.ADMIN)) {
        discordRoleRemoved = await RoleManager.remove(
          member,
          Discord.Roles.ADMIN,
          reason ?? `Demoted by ${actor.minecraftUsername}`,
        );
      }
    } catch (error) {
      logger.error(
        `[admin-demote] Failed to remove Discord ADMIN role for ${discordId}:`,
        error,
      );
    }

    const rconResults = player?.minecraftUsername
      ? await this.deopEverywhere(player.minecraftUsername)
      : [];

    await Q.admin.log.action.logAction({
      adminDiscordId: actor.discordId,
      adminUsername: actor.minecraftUsername,
      actionType: "admin_demote",
      description: `Demoted ${player?.minecraftUsername ?? discordId} from admin`,
      targetPlayerUuid: player?.minecraftUuid,
      targetPlayerName: player?.minecraftUsername,
      reason,
      metadata: {
        removedFromDb: !!dbEntry,
        discordRoleRemoved,
        rconResults,
      },
    });

    return {
      removedFromDb: !!dbEntry,
      discordRoleRemoved,
      rconResults,
      minecraftUsername: player?.minecraftUsername ?? null,
    };
  }

  private async deopEverywhere(minecraftUsername: string) {
    const results = await minecraftRcon.sendAll(`deop ${minecraftUsername}`);
    return [...results.entries()].map(([serverId, result]): DeopResult => {
      if (!result.success) {
        logger.warn(
          `[admin-demote] deop failed on server ${serverId} for ${minecraftUsername}:`,
          result.error,
        );
      }
      return {
        serverId,
        success: result.success,
        error: result.error?.message,
      };
    });
  }
}

export const adminRoleService = new AdminRoleService();
