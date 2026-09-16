import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { QueryInstances } from "@/generated/db/queries";
import { DatabaseQueries } from "@/generated/db/db";
import {
  getTestPool,
  getTestQueries,
  getTestDb,
  truncateTable,
  cleanupTestPool,
} from "@/tests/helpers/db";

describe("Transactions (server table)", () => {
  let Q: QueryInstances;
  let db: DatabaseQueries;

  beforeAll(async () => {
    const pool = getTestPool();
    await pool.query("SELECT 1");
    Q = getTestQueries();
    db = getTestDb();
  });

  beforeEach(async () => {
    await truncateTable("server");
  });

  afterAll(async () => {
    await cleanupTestPool();
  });

  // ==========================================================================
  // DatabaseQueries.inTransaction()
  // ==========================================================================

  describe("DatabaseQueries.inTransaction()", () => {
    it("should commit multi-accessor transaction", async () => {
      await db.inTransaction(async (tx) => {
        await tx.server.create({ name: "TxA", identifier: "tx-a" });
        await tx.server.create({ name: "TxB", identifier: "tx-b" });
      });

      expect(await Q.server.count()).toBe(2);
    });

    it("should rollback multi-accessor transaction on error", async () => {
      await expect(
        db.inTransaction(async (tx) => {
          await tx.server.create({ name: "TxC", identifier: "tx-c" });
          throw new Error("Multi-accessor failure");
        }),
      ).rejects.toThrow("Multi-accessor failure");

      expect(await Q.server.count()).toBe(0);
    });

    it("should detect nested transaction and reuse client", async () => {
      await db.inTransaction(async (tx) => {
        // Nested inTransaction should reuse the existing tx
        await tx.inTransaction(async (innerTx) => {
          expect(innerTx.isInTransaction()).toBe(true);
          await innerTx.server.create({
            name: "Nested",
            identifier: "nested",
          });
        });
      });

      // Data from nested transaction should be committed
      const found = await Q.server.find({ identifier: "nested" });
      expect(found).not.toBeNull();
    });
  });

  // ==========================================================================
  // useClient()
  // ==========================================================================

  describe("useClient()", () => {
    it("should create a new query instance bound to a transaction client", async () => {
      const pool = getTestPool();
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const txQ = Q.server.useClient(client);
        expect(txQ.isInTransaction()).toBe(true);

        await txQ.create({ name: "ClientBound", identifier: "client-bound" });

        // Not visible outside transaction yet
        const outsideResult = await Q.server.find({
          identifier: "client-bound",
        });
        expect(outsideResult).toBeNull();

        await client.query("COMMIT");
      } catch {
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }

      // Now visible after commit
      const found = await Q.server.find({ identifier: "client-bound" });
      expect(found).not.toBeNull();
    });
  });
});
