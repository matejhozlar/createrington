import type { Pool, PoolClient } from "pg";
import { GallerySubmissionBaseQueries } from "@/generated/db/gallery_submission.queries";
import type {
  GallerySubmission,
  GallerySubmissionRow,
} from "@createrington/shared/db/gallery_submission.types";

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

  /**
   * Reads a submission under a row lock (SELECT ... FOR UPDATE). Must be called
   * on a transaction-bound instance; the lock is held until the surrounding
   * transaction ends, so a concurrent review of the same submission blocks here
   * and observes the committed status rather than the one it read earlier.
   *
   * @returns The locked submission, or null when the id does not exist
   */
  async getForUpdate(id: number): Promise<GallerySubmission | null> {
    const query = `
      SELECT *
      FROM ${this.table}
      WHERE id = $1
      FOR UPDATE`;

    const result = await this.runQuery<GallerySubmissionRow>(
      "get gallery submission for update",
      query,
      [id],
    );

    const row = result.rows[0];
    return row ? this.mapRowToEntity(row) : null;
  }
}
