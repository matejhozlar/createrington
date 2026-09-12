import type { Pool, PoolClient } from "pg";
import { GallerySubmissionBaseQueries } from "@/generated/db/gallery_submission.queries";

/**
 * Custom queries for gallery_submission table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class GallerySubmissionQueries extends GallerySubmissionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<GallerySubmission[]> {
  //   const result = await this.db.query<GallerySubmission>(
  //     `SELECT * FROM gallery_submission WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
