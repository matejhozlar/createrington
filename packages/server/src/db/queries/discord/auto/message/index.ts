import type { Pool, PoolClient } from "pg";
import { DiscordAutoMessageBaseQueries } from "@/generated/db/discord_auto_message.queries";

/**
 * Custom queries for discord_auto_message table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class DiscordAutoMessageQueries extends DiscordAutoMessageBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Set the sort order of several messages in one statement; returns how many rows matched. */
  async reorder(
    items: Array<{ id: number; sortOrder: number }>,
  ): Promise<number> {
    if (items.length === 0) return 0;

    const result = await this.runQuery(
      "reorder auto messages",
      `UPDATE ${this.table} m
       SET sort_order = d.sort_order, updated_at = NOW()
       FROM UNNEST($1::int[], $2::int[]) AS d(id, sort_order)
       WHERE m.id = d.id`,
      [items.map((item) => item.id), items.map((item) => item.sortOrder)],
    );
    return result.rowCount ?? 0;
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<DiscordAutoMessage[]> {
  //   const result = await this.db.query<DiscordAutoMessage>(
  //     `SELECT * FROM discord_auto_message WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
