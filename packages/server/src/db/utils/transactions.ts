import type { Pool, PoolClient } from "pg";

export async function transaction<T>(
  db: Pool,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    logger.debug("Transaction started");

    const result = await callback(client);

    await client.query("COMMIT");
    logger.debug("Transaction committed");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Transaction rolled back:", error);
    throw error;
  } finally {
    client.release();
  }
}

const SAVEPOINT_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

function assertSavepointName(name: string): void {
  if (!SAVEPOINT_NAME_RE.test(name)) {
    throw new Error(`Invalid savepoint name: ${JSON.stringify(name)}`);
  }
}

export async function savepoint(
  client: PoolClient,
  name: string,
): Promise<void> {
  assertSavepointName(name);
  await client.query(`SAVEPOINT ${name}`);
  logger.debug(`Savepoint created: ${name}`);
}

export async function rollbackToSavepoint(
  client: PoolClient,
  name: string,
): Promise<void> {
  assertSavepointName(name);
  await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
  logger.debug(`Rolled back to savepoint: ${name}`);
}

export async function releaseSavepoint(
  client: PoolClient,
  name: string,
): Promise<void> {
  assertSavepointName(name);
  await client.query(`RELEASE SAVEPOINT ${name}`);
  logger.debug(`Savepoint released: ${name}`);
}
