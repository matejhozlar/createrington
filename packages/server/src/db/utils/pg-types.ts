import pg from "pg";

const INT8_OID = 20;
const DATE_OID = 1082;

/**
 * Registers the process-wide pg result parsers the query layer relies on:
 * int8 columns and COUNT/SUM results arrive as BigInt, and date columns
 * arrive as the YYYY-MM-DD string Postgres sent instead of a local-midnight
 * Date. Idempotent; call before the first query on any pool.
 */
export function registerPgTypeParsers(): void {
  pg.types.setTypeParser(INT8_OID, BigInt);
  pg.types.setTypeParser(DATE_OID, (value: string) => value);
}
