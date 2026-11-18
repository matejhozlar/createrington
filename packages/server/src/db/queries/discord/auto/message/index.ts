import type { Pool, PoolClient } from "pg";
import { DiscordAutoMessageBaseQueries } from "@/generated/db/discord_auto_message.queries";

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
}
