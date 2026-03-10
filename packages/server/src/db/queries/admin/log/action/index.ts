import type { Pool, PoolClient } from "pg";
import { AdminLogActionBaseQueries } from "@/generated/db/admin_log_action.queries";

/**
 * Custom queries for admin_log_action table
 *
 * Extends the auto-generated base class with custom methods
 */
export class AdminLogActionQueries extends AdminLogActionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here

  /**
   * Log an admin action with all required context
   */
  async logAction(data: {
    adminDiscordId: string;
    adminUsername: string;
    actionType: string;
    targetPlayerUuid: string;
    targetPlayerName: string;
    tableName: string;
    fieldName: string;
    oldValue: string;
    newValue: string;
    reason: string;
    serverId?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.create({
      adminDiscordId: data.adminDiscordId,
      adminUsername: data.adminUsername,
      actionType: data.actionType,
      targetPlayerUuid: data.targetPlayerUuid,
      targetPlayerName: data.targetPlayerName,
      tableName: data.tableName,
      fieldName: data.fieldName,
      oldValue: data.oldValue,
      newValue: data.newValue,
      reason: data.reason,
      serverId: data.serverId,
      metadata: data.metadata,
    });

    logger.info(
      `Admin action logged: ${data.adminUsername} updated ${data.tableName}.${data.fieldName} for ${data.targetPlayerName}`,
    );
  }
}
