import { Q } from "@/db";
import { DatabaseTable } from "@/generated/db";
import type { AdminLogAction } from "@createrington/shared/db";
import { BasePlayerRepository, type PlayerIdentifier } from "../base";

/**
 * Repository for player audit log management
 *
 * Handles:
 * - Audit log retrieval
 * - Audit log counting
 * - Audit log pagination
 */
export class PlayerAuditRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  /**
   * Gets admin action audit log for a player
   *
   * @param identifier - Player identifier
   * @param limit - Number of actions to return
   * @param offset - Number of actions to skip
   * @returns Promise resolving to an array of audit logs
   */
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

  /**
   * Counts total audit log entries for a player
   *
   * @param identifier - Player identifier
   * @returns Promise resolving to total count
   */
  async count(identifier: PlayerIdentifier): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.admin.log.action.count({ targetPlayerUuid: uuid });
  }
}
