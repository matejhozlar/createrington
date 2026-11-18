import type { Pool, PoolClient } from "pg";
import { GallerySubmissionCreditBaseQueries } from "@/generated/db/gallery_submission_credit.queries";

export class GallerySubmissionCreditQueries extends GallerySubmissionCreditBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
