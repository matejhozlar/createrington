import type { Pool, PoolClient } from "pg";
import { FaqWelcomeMessageBaseQueries } from "@/generated/db/faq_welcome_message.queries";

/**
 * Custom queries for faq_welcome_message table
 * 
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class FaqWelcomeMessageQueries extends FaqWelcomeMessageBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add your custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<FaqWelcomeMessage[]> {
  //   const result = await this.db.query<FaqWelcomeMessage>(
  //     `SELECT * FROM faq_welcome_message WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
