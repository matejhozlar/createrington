import { SkinApiError } from "createrington-skin-api";
import { Q, playerBanRepo, playerRepo } from "@/db";
import { UniqueViolationError } from "@/db/utils";
import {
  BadRequestError,
  ConflictError,
  ServiceUnavailableError,
} from "@/errors";
import { fetchGuildMember } from "@/discord/utils/fetch-guild-member";
import { inGameBanReason } from "@/services/player/ban";
import { getSkinApiClient } from "@/services/skin-api/client";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";
import type { PlayerIdObject } from "@/utils/player-identifier";
import type { Player } from "@createrington/shared/db";

export interface PlayerEdit {
  minecraftUsername?: string;
  discordId?: string;
}

export interface PlayerEditActor {
  discordId: string;
  username: string;
}

interface MinecraftAccount {
  uuid: string;
  username: string;
}

function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Applies an admin edit of a player's Minecraft account or Discord ID. A new
 * username is resolved through the skin API and the edit is refused when it
 * does not resolve to an account, when the lookup fails, or when the account
 * belongs to another player; the Minecraft UUID changes with the account. The
 * new name is whitelisted on every server before the database changes and
 * removed again if the update fails. After commit the old name leaves the
 * whitelist, an active ban moves to the new name in game, and the Discord
 * nickname follows; those steps are best-effort and logged.
 */
export class PlayerEditService {
  /** Applies the edit and resolves to the updated player. */
  async update(
    identifier: PlayerIdObject,
    edit: PlayerEdit,
    actor: PlayerEditActor,
    reason: string,
  ): Promise<Player> {
    const player = await Q.player.get(identifier);
    const account = edit.minecraftUsername
      ? await this.resolveAccount(edit.minecraftUsername)
      : null;
    const renamed =
      account &&
      (account.uuid !== player.minecraftUuid ||
        account.username !== player.minecraftUsername)
        ? account
        : null;

    if (!renamed && !edit.discordId) {
      throw new BadRequestError(
        `${player.minecraftUsername} already uses this Minecraft account`,
      );
    }

    if (renamed) await this.requireUnclaimed(renamed, player);

    const whitelistsNewName =
      renamed !== null && !sameName(renamed.username, player.minecraftUsername);
    if (whitelistsNewName) await this.whitelist(renamed.username);

    let updated: Player;
    try {
      updated = await playerRepo.adminUpdate(
        { minecraftUuid: player.minecraftUuid },
        {
          ...(renamed && {
            minecraftUsername: renamed.username,
            minecraftUuid: renamed.uuid,
          }),
          ...(edit.discordId && { discordId: edit.discordId }),
        },
        actor.discordId,
        actor.username,
        reason,
      );
    } catch (error) {
      if (whitelistsNewName) await this.undoWhitelist(renamed);
      if (error instanceof UniqueViolationError) {
        throw new ConflictError(
          "That Minecraft account is already registered to another player",
        );
      }
      throw error;
    }

    if (renamed) await this.followRename(player, updated);
    return updated;
  }

  private async resolveAccount(username: string): Promise<MinecraftAccount> {
    try {
      const profile = await getSkinApiClient().resolve({ username });
      return { uuid: profile.uuid, username: profile.username ?? username };
    } catch (error) {
      if (error instanceof SkinApiError && error.status === 404) {
        throw new BadRequestError(`No Minecraft account is named ${username}`);
      }
      logger.error(`Could not resolve Minecraft account ${username}:`, error);
      throw new ServiceUnavailableError(
        "Could not look up the Minecraft account, try again later",
      );
    }
  }

  private async requireUnclaimed(
    account: MinecraftAccount,
    player: Player,
  ): Promise<void> {
    const owner = await Q.player.find({ minecraftUuid: account.uuid });
    if (owner && owner.id !== player.id) {
      throw new ConflictError(
        `${account.username} is already registered to another player`,
      );
    }
  }

  private async whitelist(username: string): Promise<void> {
    try {
      await minecraftRcon.whitelistAll(WhitelistAction.ADD, username);
    } catch (error) {
      logger.error(`Could not whitelist ${username}:`, error);
      throw new ServiceUnavailableError(
        `Could not whitelist ${username} on every server, nothing was changed`,
      );
    }
  }

  private async undoWhitelist(account: MinecraftAccount): Promise<void> {
    try {
      if (await Q.player.exists({ minecraftUuid: account.uuid })) return;
      await minecraftRcon.whitelistAll(
        WhitelistAction.REMOVE,
        account.username,
      );
    } catch (error) {
      logger.error(
        `Could not remove ${account.username} from the whitelist after the failed edit:`,
        error,
      );
    }
  }

  private async followRename(previous: Player, updated: Player): Promise<void> {
    const from = previous.minecraftUsername;
    const to = updated.minecraftUsername;

    if (!sameName(from, to)) {
      try {
        await minecraftRcon.whitelistAll(WhitelistAction.REMOVE, from);
      } catch (error) {
        logger.error(
          `Could not remove the old name ${from} from the whitelist:`,
          error,
        );
      }

      try {
        const ban = await playerBanRepo.findCurrent({
          minecraftUuid: updated.minecraftUuid,
        });
        if (ban) {
          await minecraftRcon.banAll(
            to,
            inGameBanReason(ban.reason, ban.expiresAt),
          );
          await minecraftRcon.pardonAll(from);
        }
      } catch (error) {
        logger.error(
          `Could not move the in-game ban of ${from} to ${to}:`,
          error,
        );
      }
    }

    try {
      const member = await fetchGuildMember(updated.discordId);
      await member?.setNickname(to, "Minecraft account changed by an admin");
    } catch (error) {
      logger.warn(`Could not set the nickname of ${to}:`, error);
    }

    logger.info(
      `Player ${from} (${previous.minecraftUuid}) now uses ${to} (${updated.minecraftUuid})`,
    );
  }
}

export const playerEditService = new PlayerEditService();
