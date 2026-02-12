import type { Pool, PoolClient } from "pg";
import { FaqEntryBaseQueries } from "@/generated/db/faq_entry.queries";

/**
 * Custom queries for faq_entry table
 * 
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class FaqEntryQueries extends FaqEntryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add your custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<FaqEntry[]> {
  //   const result = await this.db.query<FaqEntry>(
  //     `SELECT * FROM faq_entry WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
