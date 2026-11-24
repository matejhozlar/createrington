import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import pg from "pg";
import { DatabaseQueries } from "@/generated/db/db";
import { logPoolErrors } from "@/db/pool-errors";
import { getTestPool, cleanupTestPool } from "@/tests/helpers/db";

function subjectPool(): pg.Pool {
  const pool = new pg.Pool({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASSWORD ?? "test_password",
    database: process.env.DB_DATABASE ?? "test_db",
    ssl: false,
  });
  logPoolErrors(pool);
  return pool;
}

async function terminateBackend(pid: number): Promise<void> {
  await getTestPool().query("SELECT pg_terminate_backend($1)", [pid]);
}

async function until(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("condition not met in time");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe("PostgreSQL connection errors", () => {
  let pool: pg.Pool;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    pool = subjectPool();
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
    await until(() => warn.mock.calls.length > 0);

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
        await until(() => warn.mock.calls.length > 0);
        throw new Error("original failure");
      }),
    ).rejects.toThrow("original failure");

    const next = await pool.query<{ ok: number }>("SELECT 1 AS ok");
    expect(next.rows[0].ok).toBe(1);
  });
});
