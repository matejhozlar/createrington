import pg from "pg";

const INT8_OID = 20;
const DATE_OID = 1082;

export function registerPgTypeParsers(): void {
  pg.types.setTypeParser(INT8_OID, BigInt);
  pg.types.setTypeParser(DATE_OID, (value: string) => value);
}
