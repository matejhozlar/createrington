import type { Pool, PoolClient } from "pg";
import { PlanningItemBaseQueries } from "@/generated/db/planning_item.queries";
import type {
  PlanningItem,
  PlanningItemRow,
} from "@createrington/shared/db/planning_item.types";
import { createNotFoundError } from "@/db/utils/query-helpers";

export class PlanningItemQueries extends PlanningItemBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Reads an item under a row lock (SELECT ... FOR UPDATE). Must be called on
   * a transaction-bound instance, so two saves of the same item run one after
   * the other and the second one sees the first one's revision number.
   *
   * @throws NotFoundError when the id does not exist
   */
  async getForUpdate(id: number): Promise<PlanningItem> {
    const query = `
      SELECT *
      FROM ${this.table}
      WHERE id = $1
      FOR UPDATE`;

    const result = await this.runQuery<PlanningItemRow>(
      "get planning item for update",
      query,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw createNotFoundError(this.table, { id });
    }
    return this.mapRowToEntity(row);
  }
}
