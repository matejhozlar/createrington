import type { PoolClient } from "pg";

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
