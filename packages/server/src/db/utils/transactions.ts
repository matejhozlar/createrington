import type { Pool, PoolClient } from "pg";

/**
 * Executes a callback within a database transaction
 * Automatically commits on success or rolls back on error
 *
 * @param db - Database pool
 * @param callback - Function to execute within transaction
 * @returns Result from the callback
 */
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

// Savepoint names must be SQL identifiers and can't be $N-parameterized, so
// interpolation is unavoidable. Guard against anything that isn't a bare
// identifier so a future caller taking `name` from external input can't
// smuggle SQL through these helpers.
const SAVEPOINT_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

function assertSavepointName(name: string): void {
  if (!SAVEPOINT_NAME_RE.test(name)) {
    throw new Error(`Invalid savepoint name: ${JSON.stringify(name)}`);
  }
}

/**
 * Creates a savepoint within an existing transaction
 * Useful for partial rollbacks without aborting the entire transaction
 *
 * @param client - Active transaction client
 * @param name - Savepoint name
 */
export async function savepoint(
  client: PoolClient,
  name: string,
): Promise<void> {
  assertSavepointName(name);
  await client.query(`SAVEPOINT ${name}`);
  logger.debug(`Savepoint created: ${name}`);
}

/**
 * Rolls back to a savepoint
 *
 * @param client - Active transaction client
 * @param name - Savepoint name
 */
export async function rollbackToSavepoint(
  client: PoolClient,
  name: string,
): Promise<void> {
  assertSavepointName(name);
  await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
  logger.debug(`Rolled back to savepoint: ${name}`);
}

/**
 * Releases a savepoint (no longer needed)
 *
 * @param client - Active transaction client
 * @param name - Savepoint name
 */
export async function releaseSavepoint(
  client: PoolClient,
  name: string,
): Promise<void> {
  assertSavepointName(name);
  await client.query(`RELEASE SAVEPOINT ${name}`);
  logger.debug(`Savepoint released: ${name}`);
}
