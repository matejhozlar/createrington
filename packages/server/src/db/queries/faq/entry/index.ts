import type { Pool, PoolClient } from "pg";
import { FaqEntryBaseQueries } from "@/generated/db/faq_entry.queries";

export class FaqEntryQueries extends FaqEntryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
