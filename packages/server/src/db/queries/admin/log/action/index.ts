import type { Pool, PoolClient } from "pg";
import { AdminLogActionBaseQueries } from "@/generated/db/admin_log_action.queries";
import { escapeLike } from "@/db/utils";
import type {
  AdminLogAction,
  AdminLogActionCreate,
  AdminLogActionRow,
} from "@createrington/shared/db/admin_log_action.types";
import type { WorkshopModReviewAction } from "@createrington/shared/workshop";

export const SYSTEM_AUDIT_ACTOR = {
  discordId: "system",
  username: "System",
} as const;

export type AdminActionType =
  | "admin_demote"
  | "admin_promote"
  | "auto_message_config_create"
  | "auto_message_config_delete"
  | "auto_message_config_update"
  | "balance_deduct"
  | "balance_grant"
  | "balance_set"
  | "ban_player_permanent"
  | "ban_player_temporary"
  | "ban_workshop_suggest"
  | "delete_player"
  | "delete_waitlist"
  | "discord_entities_refetch"
  | "embed_edit"
  | "embed_send"
  | "embed_update_all"
  | "faq_create"
  | "faq_delete"
  | "faq_repost_welcome"
  | "faq_update"
  | "feature_flag_set"
  | "gallery_settings_update"
  | "gallery_submission_approve"
  | "gallery_submission_reject"
  | "gallery_submission_remove"
  | "ghost_members_refresh"
  | "ghost_members_remove"
  | "inactivity_exemption_add"
  | "inactivity_exemption_remove"
  | "inactivity_remove_manual"
  | "inactivity_resolve_manual"
  | "inactivity_trigger_cleanup"
  | "inactivity_trigger_resolve_remove"
  | "launcher_pack_add"
  | "launcher_pack_enable"
  | "launcher_pack_remove"
  | "launcher_pack_reorder"
  | "modpack_create"
  | "modpack_delete"
  | "modpack_seed_manifest"
  | "modpack_update"
  | "player_prompt_close"
  | "player_prompt_create"
  | "player_prompt_delete"
  | "remove_party_member"
  | "server_maintenance_allow_player"
  | "server_maintenance_cancel"
  | "server_maintenance_disable"
  | "server_maintenance_disallow_player"
  | "server_maintenance_enable"
  | "server_maintenance_schedule"
  | "server_maintenance_settings_push"
  | "server_maintenance_settings_update"
  | "server_whitelist_resync"
  | "setting_update"
  | "strike_issued"
  | "strike_removed"
  | "structure_pack_add_mod"
  | "structure_pack_clear_rotation"
  | "structure_pack_config_update"
  | "structure_pack_create"
  | "structure_pack_delete"
  | "structure_pack_force_rotation"
  | "structure_pack_import"
  | "structure_pack_remove_mod"
  | "structure_pack_toggle"
  | "structure_pack_update"
  | "unban_player"
  | "unban_workshop_suggest"
  | "unlinked_members_refresh"
  | "update_player"
  | "vote_reward_commands_update"
  | "workshop_create"
  | "workshop_delete"
  | "workshop_mod_file"
  | "workshop_mod_required"
  | "workshop_mods_admin_add"
  | "workshop_pack_member_remove"
  | "workshop_project_environment"
  | "workshop_update"
  | `workshop_mod_${WorkshopModReviewAction}`;

type AdminLogActionInsert = AdminLogActionCreate & {
  actionType: AdminActionType;
};

export class AdminLogActionQueries extends AdminLogActionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Inserts one audit row; `actionType` must be a known AdminActionType. */
  override async create(data: AdminLogActionInsert): Promise<void> {
    return super.create(data);
  }

  /** Inserts one audit row and returns it; `actionType` must be a known AdminActionType. */
  override async createAndReturn(
    data: AdminLogActionInsert,
  ): Promise<AdminLogAction> {
    return super.createAndReturn(data);
  }

  /** Inserts several audit rows; every `actionType` must be a known AdminActionType. */
  override async createMany(
    rows: AdminLogActionInsert[],
    options?: { onConflict?: "ignore" },
  ): Promise<void> {
    return super.createMany(rows, options);
  }

  /** Inserts several audit rows and returns them; every `actionType` must be a known AdminActionType. */
  override async createManyAndReturn(
    rows: AdminLogActionInsert[],
    options?: { onConflict?: "ignore" },
  ): Promise<AdminLogAction[]> {
    return super.createManyAndReturn(rows, options);
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
      const like = `%${escapeLike(opts.search)}%`;
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
      this.runQuery<AdminLogActionRow>(
        "search admin log actions",
        `SELECT * FROM ${this.table} ${where} ORDER BY ${sortCol} ${dir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, opts.limit, opts.offset],
      ),
      this.runQuery<{ count: number }>(
        "count admin log actions",
        `SELECT COUNT(*)::int AS count FROM ${this.table} ${where}`,
        params,
      ),
    ]);

    return {
      actions: this.mapRowsToEntities(dataResult.rows),
      total: countResult.rows[0]?.count ?? 0,
    };
  }

  /**
   * Get distinct admin usernames that have audit log entries
   */
  async getDistinctAdmins(): Promise<string[]> {
    const result = await this.runQuery<{ admin_username: string }>(
      "get distinct admin log usernames",
      `SELECT DISTINCT admin_username FROM ${this.table} ORDER BY admin_username ASC`,
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
    actionType: AdminActionType;
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
