import type { TableStructure } from "../types";

export function generateActualQueries(structure: TableStructure): string {
  const { className, tableName } = structure;

  return `import type { Pool, PoolClient } from "pg";
import { ${className}BaseQueries } from "@/generated/db/${tableName}.queries";

export class ${className}Queries extends ${className}BaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
`;
}
