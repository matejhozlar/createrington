import type { Client } from "discord.js";
import { RoleAssignmentService } from "../role-assignment.service";
import type { PlaytimeService } from "@/services/playtime";
import { getRealtimeRoleRules } from "../config";
import { Q } from "@/db";

/**
 * Handles realtime role assignments triggered by playtime events
 *
 * Listens to sessionEnd events from PlaytimeService and checks if the player
 * qualifies for any new roles based on their updated playtime
 */
export class RealtimeRoleHandler {
  private roleService: RoleAssignmentService;

  constructor(
    private bot: Client,
    private playtimeService: PlaytimeService,
  ) {
    this.roleService = new RoleAssignmentService(bot);
    this.setupListeners();
  }

  /**
   * Sets up event listener for playtime service
   *
   * @private
   */
  private setupListeners(): void {
    this.playtimeService.on("sessionAggregated", async (event) => {
      logger.debug(
        `Session aggregated for ${event.username}, checking role eligibility`,
      );

      try {
        const player = await Q.player.find({ minecraftUuid: event.uuid });

        if (!player) {
          logger.warn(`No player found with UUID ${event.uuid} for role check`);
          return;
        }

        const rules = getRealtimeRoleRules();

        await this.roleService.processRoleHierarchy(player.discordId, rules);
      } catch (error) {
        logger.error(
          `Failed to process realtime role check for ${event.username}:`,
          error,
        );
      }
    });
  }

  /**
   * Manually trigger a role check for a specific player
   *
   * @param discordId - Discord user ID of the player
   */
  async checkPlayer(discordId: string): Promise<void> {
    const rules = getRealtimeRoleRules();
    await this.roleService.processRoleHierarchy(discordId, rules);
  }
}
