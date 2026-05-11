import type { Pool, PoolClient } from "pg";
import { AdminLogActionBaseQueries } from "@/generated/db/admin_log_action.queries";
import type { AdminLogAction } from "@createrington/shared/db/admin_log_action.types";

/**
 * Custom queries for admin_log_action table
 *
 * - Provides structured admin action logging with full audit context
 * - All admin mutations (balance, bans, strikes, player edits) route through logAction()
 */
export class AdminLogActionQueries extends AdminLogActionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Search audit logs with text matching across description and targetPlayerName.
   * Supports pagination, sorting, and optional action type filter.
   */
  async search(opts: {
    search?: string;
    actionType?: string;
    adminUsername?: string;
    orderBy: string;
    orderDirection: "asc" | "desc";
    limit: number;
    offset: number;
  }): Promise<{ actions: AdminLogAction[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (opts.search) {
      const like = `%${opts.search}%`;
      conditions.push(
        `(description ILIKE $${paramIndex} OR target_player_name ILIKE $${paramIndex + 1})`,
      );
      params.push(like, like);
      paramIndex += 2;
    }

    if (opts.actionType) {
      conditions.push(`action_type = $${paramIndex}`);
      params.push(opts.actionType);
      paramIndex += 1;
    }

    if (opts.adminUsername) {
      conditions.push(`admin_username = $${paramIndex}`);
      params.push(opts.adminUsername);
      paramIndex += 1;
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const allowedSortColumns: Record<string, string> = {
      performedAt: "performed_at",
      actionType: "action_type",
      adminUsername: "admin_username",
    };
    const sortCol = allowedSortColumns[opts.orderBy] ?? "performed_at";
    const dir = opts.orderDirection === "asc" ? "ASC" : "DESC";

    const [dataResult, countResult] = await Promise.all([
      this.db.query(
        `SELECT * FROM admin_log_action ${where} ORDER BY ${sortCol} ${dir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, opts.limit, opts.offset],
      ),
      this.db.query(
        `SELECT COUNT(*)::int AS count FROM admin_log_action ${where}`,
        params,
      ),
    ]);

    return {
      actions: dataResult.rows.map((row: Record<string, unknown>) =>
        this.mapRowToEntity(row),
      ),
      total: countResult.rows[0]?.count ?? 0,
    };
  }

  /**
   * Get distinct admin usernames that have audit log entries
   */
  async getDistinctAdmins(): Promise<string[]> {
    const result = await this.db.query<{ admin_username: string }>(
      `SELECT DISTINCT admin_username FROM admin_log_action ORDER BY admin_username ASC`,
    );
    return result.rows.map((r) => r.admin_username);
  }

  /**
   * Log an admin action with all required context
   *
   * @param data - Action details including admin info, target player, table/field changed, and old/new values
   */
  async logAction(data: {
    adminDiscordId: string;
    adminUsername: string;
    actionType: string;
    description?: string;
    targetPlayerUuid?: string;
    targetPlayerName?: string;
    tableName?: string;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    reason?: string;
    serverId?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.create({
      adminDiscordId: data.adminDiscordId,
      adminUsername: data.adminUsername,
      actionType: data.actionType,
      description: data.description,
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

    const target =
      data.description ??
      (data.tableName && data.fieldName
        ? `${data.tableName}.${data.fieldName} for ${data.targetPlayerName}`
        : data.actionType);

    logger.info(`Admin action logged: ${data.adminUsername}: ${target}`);
  }
}
