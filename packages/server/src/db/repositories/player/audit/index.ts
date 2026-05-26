import { Q } from "@/db";
import { DatabaseTable } from "@/generated/db";
import type { AdminLogAction } from "@createrington/shared/db";
import { BasePlayerRepository, type PlayerIdentifier } from "../base";

/**
 * Read access over admin_log_action filtered to a single target player.
 * Used by the admin panel audit-log views.
 */
export class PlayerAuditRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  /** Paginated admin actions targeting the player, newest first. */
  async getLog(
    identifier: PlayerIdentifier,
    limit: number = 20,
    offset: number = 0,
  ): Promise<AdminLogAction[]> {
    const uuid = await this.resolvePlayerUuid(identifier);

    const actions = await Q.admin.log.action.findAll(
      { targetPlayerUuid: uuid },
      {
        limit,
        offset,
        orderBy: DatabaseTable.ADMIN_LOG_ACTION.CAMEL_FIELDS.PERFORMED_AT,
        orderDirection: "desc",
      },
    );

    return actions;
  }

  /** Total admin action count targeting the player. */
  async count(identifier: PlayerIdentifier): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.admin.log.action.count({ targetPlayerUuid: uuid });
  }
}
