import type { Pool, PoolClient } from "pg";
import { GallerySubmissionCreditBaseQueries } from "@/generated/db/gallery_submission_credit.queries";

/**
 * Custom queries for gallery_submission_credit table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class GallerySubmissionCreditQueries extends GallerySubmissionCreditBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<GallerySubmissionCredit[]> {
  //   const result = await this.db.query<GallerySubmissionCredit>(
  //     `SELECT * FROM gallery_submission_credit WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
