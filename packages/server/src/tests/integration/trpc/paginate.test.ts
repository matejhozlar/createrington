import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { DatabaseQueries } from "@/generated/db/db";
import { getTestPool, getTestDb, cleanupTestPool } from "@/tests/helpers/db";
import { ilikeContains } from "@/db/utils";
import { paginate } from "@/trpc/utils";

class Rollback extends Error {}

describe("paginate (faq_entry, rolled back)", () => {
  let db: DatabaseQueries;

  beforeAll(async () => {
    await getTestPool().query("SELECT 1");
    db = getTestDb();
  });

  afterAll(async () => {
    await cleanupTestPool();
  });

  async function withSeededEntries<T>(
    run: (
      tx: DatabaseQueries,
      filters: { title: { $ilike: string }; enabled: boolean },
    ) => Promise<T>,
  ): Promise<T> {
    const marker = `paginate-spec-${Date.now()}`;
    let result: T | undefined;

    await db
      .inTransaction(async (tx) => {
        for (const priority of [1, 2, 3, 4]) {
          await tx.faq.entry.create({
            matchMode: "keywords",
            pattern: marker,
            title: `${marker} enabled ${priority}`,
            response: "r",
            enabled: true,
            priority,
          });
        }
        await tx.faq.entry.create({
          matchMode: "keywords",
          pattern: marker,
          title: `${marker} disabled`,
          response: "r",
          enabled: false,
          priority: 99,
        });

        result = await run(tx, {
          title: ilikeContains(marker),
          enabled: true,
        });
        throw new Rollback();
      })
      .catch((error: unknown) => {
        if (!(error instanceof Rollback)) throw error;
      });

    return result as T;
  }

  it("pages the rows and counts the total from the same predicate", async () => {
    const page = await withSeededEntries((tx, filters) =>
      paginate(
        tx.faq.entry,
        filters,
        { page: 0, limit: 3 },
        { orderBy: "priority", orderDirection: "desc" },
      ),
    );

    expect(page.rows.map((row) => row.priority)).toEqual([4, 3, 2]);
    expect(page.pagination).toEqual({
      page: 0,
      limit: 3,
      total: 4,
      totalPages: 2,
    });
  });

  it("offsets later pages by page * limit", async () => {
    const page = await withSeededEntries((tx, filters) =>
      paginate(
        tx.faq.entry,
        filters,
        { page: 1, limit: 3 },
        { orderBy: "priority", orderDirection: "desc" },
      ),
    );

    expect(page.rows.map((row) => row.priority)).toEqual([1]);
    expect(page.pagination.total).toBe(4);
  });
});
