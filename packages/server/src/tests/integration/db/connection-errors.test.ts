import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import type pg from "pg";
import { DatabaseQueries } from "@/generated/db/db";
import { logPoolErrors } from "@/db/pool-errors";
import {
  cleanupTestPool,
  createTestPool,
  getTestPool,
} from "@/tests/helpers/db";

async function terminateBackend(pid: number): Promise<void> {
  await getTestPool().query("SELECT pg_terminate_backend($1)", [pid]);
}

describe("PostgreSQL connection errors", () => {
  let pool: pg.Pool;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pool = createTestPool();
    logPoolErrors(pool);
    warn = vi.spyOn(logger, "warn");
  });

  afterEach(async () => {
    warn.mockRestore();
    await pool.end();
  });

  afterAll(async () => {
    await cleanupTestPool();
  });

  it("survives the backend of an idle pooled client dying and serves the next query", async () => {
    const client = await pool.connect();
    const { rows } = await client.query<{ pid: number }>(
      "SELECT pg_backend_pid() AS pid",
    );
    client.release();

    await terminateBackend(rows[0].pid);
    await vi.waitFor(() => expect(warn).toHaveBeenCalled(), {
      timeout: 5000,
    });

    const next = await pool.query<{ ok: number }>("SELECT 1 AS ok");
    expect(next.rows[0].ok).toBe(1);
  });

  it("keeps the original error when the connection dies inside a transaction", async () => {
    const db = new DatabaseQueries(pool);

    await expect(
      db.inTransaction(async (tx) => {
        const client = tx.getDb() as pg.PoolClient;
        const { rows } = await client.query<{ pid: number }>(
          "SELECT pg_backend_pid() AS pid",
        );
        await terminateBackend(rows[0].pid);
        await vi.waitFor(() => expect(warn).toHaveBeenCalled(), {
          timeout: 5000,
        });
        throw new Error("original failure");
      }),
    ).rejects.toThrow("original failure");

    const next = await pool.query<{ ok: number }>("SELECT 1 AS ok");
    expect(next.rows[0].ok).toBe(1);
  });
});
