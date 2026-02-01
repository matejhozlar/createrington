import type { Pool, PoolClient, QueryResultRow } from "pg";
import logger from "@/logger";
import { createNotFoundError } from "../utils/query-helpers";
import { FilterValue } from "@createrington/shared/db/base.types";

/**
 * Fluent query builder for composable queries
 * Accumulates filters and options, then executes via the underlying BaseQueries methods
 */
class QueryBuilder<
  TConfig extends {
    Entity: QueryResultRow;
    Filters?: Record<string, any>;
  },
> {
  private filters: Partial<NonNullable<TConfig["Filters"]>> = {};
  private options: {
    limit?: number;
    offset?: number;
    orderBy?: keyof TConfig["Entity"];
    orderDirection?: "ASC" | "DESC";
    select?: Array<keyof TConfig["Entity"]>;
  } = {};

  constructor(
    private executor: (
      filters?: Partial<NonNullable<TConfig["Filters"]>>,
      options?: any,
    ) => Promise<any[]>,
  ) {}

  /**
   * Add filter conditions
   * Can be called multiple times - conditions are merged
   *
   * @param filters - Filter conditions to apply
   * @returns This builder for chaining
   *
   * @example
   * Q.player.where({ isActive: true }).where({ role: "admin" })
   */
  where(filters: Partial<NonNullable<TConfig["Filters"]>>): this {
    this.filters = { ...this.filters, ...filters };
    return this;
  }

  /**
   * Set sort order
   *
   * @param field - Field to sort by
   * @param direction - Sort direction (default: "ASC")
   * @returns This builder for chaining
   *
   * @example
   * Q.player.where({ isActive: true }).orderBy("createdAt", "DESC")
   */
  orderBy(
    field: keyof TConfig["Entity"],
    direction: "ASC" | "DESC" = "ASC",
  ): this {
    this.options.orderBy = field;
    this.options.orderDirection = direction;
    return this;
  }

  /**
   * Set maximum number of results
   *
   * @param count - Maximum number of rows to return
   * @returns This builder for chaining
   *
   * @example
   * Q.player.where({ isActive: true }).limit(10)
   */
  limit(count: number): this {
    this.options.limit = count;
    return this;
  }

  /**
   * Set result offset for pagination
   *
   * @param count - Number of rows to skip
   * @returns This builder for chaining
   *
   * @example
   * Q.player.where({ isActive: true }).limit(10).offset(20)
   */
  offset(count: number): this {
    this.options.offset = count;
    return this;
  }

  /**
   * Select specific fields (field projection)
   *
   * @param fields - Array of field names to select
   * @returns This builder for chaining
   *
   * @example
   * Q.player.where({ isActive: true }).select(["id", "minecraftUsername"])
   */
  select(fields: Array<keyof TConfig["Entity"]>): this {
    this.options.select = fields;
    return this;
  }

  /**
   * Set page number and size (convenience method)
   * Automatically calculates offset
   *
   * @param page - Page number (0-indexed)
   * @param pageSize - Number of items per page
   * @returns This builder for chaining
   *
   * @example
   * Q.player.where({ isActive: true }).paginate(2, 20) // page 2, 20 items per page
   */
  paginate(page: number, pageSize: number): this {
    this.options.limit = pageSize;
    this.options.offset = page * pageSize;
    return this;
  }

  /**
   * Execute the query and return all matching results
   *
   * @returns Promise resolving to array of entities
   *
   * @example
   * const players = await Q.player
   *   .where({ isActive: true })
   *   .orderBy("createdAt", "DESC")
   *   .limit(10)
   *   .all()
   */
  async all(): Promise<TConfig["Entity"][]> {
    return this.executor(this.filters, this.options);
  }

  /**
   * Execute the query and return the first result
   * Returns null if no results found
   *
   * @returns Promise resolving to first entity or null
   *
   * @example
   * const player = await Q.player
   *   .where({ minecraftUsername: "Steve" })
   *   .first()
   */
  async first(): Promise<TConfig["Entity"] | null> {
    const results = await this.executor(this.filters, {
      ...this.options,
      limit: 1,
    });
    return results[0] || null;
  }

  /**
   * Execute the query and return the first result
   * Throws an error if no results found
   *
   * @returns Promise resolving to first entity
   * @throws Error if no results found
   *
   * @example
   * const player = await Q.player
   *   .where({ minecraftUsername: "Steve" })
   *   .firstOrFail()
   */
  async firstOrFail(): Promise<TConfig["Entity"]> {
    const result = await this.first();
    if (!result) {
      throw new Error("No results found for query");
    }
    return result;
  }

  /**
   * Execute the query and return count of results
   * Note: This still fetches all results and counts them
   * For large datasets, prefer using count() method directly
   *
   * @returns Promise resolving to count
   *
   * @example
   * const count = await Q.player.where({ isActive: true }).count()
   */
  async count(): Promise<number> {
    const results = await this.executor(this.filters, this.options);
    return results.length;
  }
}

/**
 * Base class for database query operations
 * Provides common CRUD functionality that can be extended by specific entity data
 */
export abstract class BaseQueries<
  TConfig extends {
    Entity: QueryResultRow;
    DbEntity: QueryResultRow;
    Identifier?: Record<string, any>;
    Filters?: Record<string, any>;
    Update?: Record<string, any>;
    Create?: Record<string, any>;
  },
> {
  protected abstract readonly table: string;
  protected readonly COLUMN_MAP?: Record<string, string>;
  protected readonly VALID_IDENTIFIER_FIELDS?: Set<string>;

  // ============================================================================
  // SINGLETON REGISTRY FOR CHILD QUERIES
  // ============================================================================

  /**
   * Global registry for query instances, keyed by pool
   * Uses WeakMap so instances are garbage collected when pool is destroyed
   */
  private static queryInstances = new WeakMap<
    Pool | PoolClient,
    Map<string, any>
  >();

  /**
   * Gets or creates a child query instance as a singleton per pool
   * This ensures we only have one instance of each query class per database connection
   *
   * @param key - Unique key for this child (e.g., 'balance')
   * @param QueryClass - The query class constructor
   * @returns Singleton instance of the query class
   */
  protected getOrCreateChild<T>(
    key: string,
    QueryClass: new (db: Pool | PoolClient) => T,
  ): T {
    if (!BaseQueries.queryInstances.has(this.db)) {
      BaseQueries.queryInstances.set(this.db, new Map());
    }

    const cache = BaseQueries.queryInstances.get(this.db)!;

    const fullKey = `${this.table}.${key}`;

    if (!cache.has(fullKey)) {
      cache.set(fullKey, new QueryClass(this.db));
    }

    return cache.get(fullKey) as T;
  }

  constructor(protected db: Pool | PoolClient) {}

  /**
   * Converts snake_case to camelCase
   *
   * @param str - String to convert to camelCase
   * @returns Converted snake_case value
   */
  protected snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Converts camelCase to snake_case
   *
   * @param str - String to convert to snake_case
   * @returns Converted camelCase value
   */
  protected camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Converts a database row from snake_case to camelCase
   *
   * @param row - Database row object with snake_case keys
   * @returns Entity object with camelCase keys
   */
  protected mapRowToEntity(row: TConfig["DbEntity"]): TConfig["Entity"];
  protected mapRowToEntity<TBdRow extends Record<string, any>, TEntity>(
    row: TBdRow,
  ): TEntity;
  protected mapRowToEntity(row: any): any {
    const entity: any = {};
    for (const [key, value] of Object.entries(row)) {
      entity[this.snakeToCamel(key)] = value;
    }
    return entity;
  }

  /**
   * Converts multiple database rows from snake_case to camelCase
   *
   * @param rows - Array of database row objects with snake_case keys
   * @returns Array of entitiy objects with camelCase keys
   */
  protected mapRowsToEntities(rows: TConfig["DbEntity"][]): TConfig["Entity"][];
  protected mapRowsToEntities<TDbRow extends Record<string, any>, TEntity>(
    rows: TDbRow[],
  ): TEntity[];
  protected mapRowsToEntities(rows: any[]): any[] {
    return rows.map((row) => this.mapRowToEntity(row));
  }

  /**
   * Gets the database column name for a given key
   * Uses COLUMN_MAP if provided, otherwise convers camelCase to snake_case
   *
   * @param key - Value to convert
   * @returns Database column name
   */
  protected getColumnName(key: string): string {
    return this.COLUMN_MAP?.[key] ?? this.camelToSnake(key);
  }

  /**
   * Maps an identifier/filter object to its corresponding database column and value
   *
   * @param data - Data object
   * @returns Object containing the column and value
   * @throws Error if data key is not found
   */
  protected getColumnMapping(data: Record<string, any>): {
    whereClause: string;
    values: any[];
  } {
    const entries = Object.entries(data);

    if (entries.length === 0) {
      throw new Error("Identifier object cannot be empty");
    }

    const conditions: string[] = [];
    const values: any[] = [];

    entries.forEach(([key, value], index) => {
      const column = this.getColumnName(key);

      if (!column) {
        throw new Error(`Invalid column key: ${key}`);
      }

      conditions.push(`${column} = $${index + 1}`);
      values.push(value);
    });

    return {
      whereClause: conditions.join(" AND "),
      values,
    };
  }

  /**
   * Extracts a valid identifier from an object that may contain extra fields
   * Picks the first matching unique identifier field with a non-null value
   *
   * This allows passing full entities to methods like get(), update(), delete(), etc.
   * The Identifier type union determines which fields are tried
   *
   * @param obj - Object that may contain identifier fields plus extra data
   * @returns Valid identifier object with only the necessary field(s)
   *
   * @example
   * // PlayerIdentifier = { minecraftUuid: string } | { discordId: string }
   * extractIdentifier(player)
   * // returns { minecraftUuid: "..." } if player.minecraftUuid exists
   *
   * @example
   * // Explicit identifier still works
   * extractIdentifier({ discordId: "123" })
   * // Returns { discordId: "123" }
   */
  protected extractIdentifier(
    obj: Record<string, any>,
  ): NonNullable<TConfig["Identifier"]> {
    // Get all keys with non-null/undefined values
    const availableKeys = Object.keys(obj).filter(
      (key) => obj[key] !== undefined && obj[key] !== null,
    );

    // If object has only 1-2 keys, it's likely already an identifier
    // Use it directly for performance
    if (availableKeys.length <= 2) {
      return obj as NonNullable<TConfig["Identifier"]>;
    }

    // Try each available key as a potential single-field identifier
    // We test by checking if the column exists
    for (const key of availableKeys) {
      try {
        const columnName = this.getColumnName(key);

        // Check if this is a valid identifier field
        if (
          this.VALID_IDENTIFIER_FIELDS &&
          !this.VALID_IDENTIFIER_FIELDS.has(key)
        ) {
          continue;
        }

        // If we got a valid column name, try using this as identifier
        if (columnName) {
          const testIdentifier = { [key]: obj[key] };

          // Test if this creates a valid WHERE clause
          // This validates it's actually an identifier field
          this.getColumnMapping(testIdentifier);

          return testIdentifier as NonNullable<TConfig["Identifier"]>;
        }
      } catch {
        // This key didn't work, try next one
        // Loop continues automatically - no 'continue' needed in catch
      }
    }

    // If no single-key identifier worked, fallback to using object as-is
    // This handles composite keys or when user explicitly passes minimal identifier
    return obj as NonNullable<TConfig["Identifier"]>;
  }
  /**
   * Maps an update object to an array of column-value pairs
   *
   * @param updates - Update data object
   * @returns Array of objects containing column names and values
   */
  protected getUpdateMapping(updates: Partial<NonNullable<TConfig["Update"]>>) {
    return Object.entries(updates).map(([key, value]) => ({
      column: this.getColumnName(key),
      value,
    }));
  }

  /**
   * Maps a create object to an array of column-value pairs
   *
   * @param data - Create data object
   * @returns Array of objects containing column names and values
   */
  protected getCreateMapping(data: NonNullable<TConfig["Create"]>) {
    return Object.entries(data).map(([key, value]) => ({
      column: this.getColumnName(key),
      value,
    }));
  }

  /**
   * Builds WHERE clause from filter criteria
   *
   * @param filters - Object containing filer data
   * @returns Object containing the WHERE clause and all parameter values
   */
  protected buildFilterClause(
    filters: Partial<{
      [K in keyof NonNullable<TConfig["Filters"]>]: FilterValue<
        NonNullable<TConfig["Filters"]>[K]
      >;
    }>,
  ): {
    whereClause: string;
    params: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filters)) {
      const column = this.getColumnName(key);
      if (!column) continue;

      // Skip undefined (means "don't filter")
      if (value === undefined) continue;

      // Handle null explicitly
      if (value === null) {
        conditions.push(`${column} IS NULL`);
        continue;
      }

      // Check if value is an operator object
      if (this.isOperatorObject(value)) {
        this.buildOperatorConditions(column, value, conditions, params);
        paramIndex = params.length + 1;
        continue;
      }

      // Default equality check
      conditions.push(`${column} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    return {
      whereClause: conditions.length > 0 ? conditions.join(" AND ") : "1=1",
      params,
    };
  }

  /**
   * Checks if value is an operator object (has kes starting with $)
   *
   * @param value - The value to check
   * @returns True if the value is an operator object, false otherwise
   */
  private isOperatorObject(value: any): boolean {
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).some((key) => key.startsWith("$"))
    );
  }

  /**
   * Build conditions for operator objects
   *
   * @param column - The column to build
   * @param operators - The operators to add to the query
   * @param conditions - The conditions of the columns
   * @returns Promise resolving once the operation is completed
   */
  private buildOperatorConditions(
    column: string,
    operators: Record<string, any>,
    conditions: string[],
    params: any[],
  ): void {
    for (const [op, val] of Object.entries(operators)) {
      const paramIndex = params.length + 1;

      switch (op) {
        case "$exists":
          if (val === true) {
            conditions.push(`${column} IS NOT NULL`);
          } else if (val === false) {
            conditions.push(`${column} IS NULL`);
          }
          break;

        case "$between":
          if (!Array.isArray(val) || val.length !== 2) {
            throw new Error("$between requires an array of exactly 2 values");
          }
          conditions.push(
            `${column} BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
          );
          params.push(val[0], val[1]);
          break;

        case "$eq":
          conditions.push(`${column} = $${paramIndex}`);
          params.push(val);
          break;

        case "$ne":
          if (val === null) {
            conditions.push(`${column} IS NOT NULL`);
          } else {
            conditions.push(`${column} != $${paramIndex}`);
            params.push(val);
          }
          break;

        case "$gt":
          conditions.push(`${column} > $${paramIndex}`);
          params.push(val);
          break;

        case "$gte":
          conditions.push(`${column} >= $${paramIndex}`);
          params.push(val);
          break;

        case "$lt":
          conditions.push(`${column} < $${paramIndex}`);
          params.push(val);
          break;

        case "$lte":
          conditions.push(`${column} <= $${paramIndex}`);
          params.push(val);
          break;

        case "$in":
          if (!Array.isArray(val)) {
            throw new Error("$in requires an array value");
          }
          if (val.length === 0) {
            conditions.push("1=0");
          } else {
            conditions.push(`${column} = ANY($${paramIndex})`);
            params.push(val);
          }
          break;

        case "$nin":
          if (!Array.isArray(val)) {
            throw new Error("$nin requires an array value");
          }
          if (val.length === 0) {
            conditions.push("1=1");
          } else {
            conditions.push(`${column} != ALL($${paramIndex})`);
            params.push(val);
          }
          break;

        case "$like":
          conditions.push(`${column} LIKE $${paramIndex}`);
          params.push(val);
          break;

        case "$ilike":
          conditions.push(`${column} ILIKE $${paramIndex}`);
          params.push(val);
          break;

        default:
          logger.warn(`Unknown operator: ${op}`);
      }
    }
  }

  // ============================================================================
  // SINGLE ENTITY OPERATIONS (by unique identifiers)
  // ============================================================================

  /**
   * Finds a single entity by unique identifier
   * Returns null if not found
   *
   * Accepts either a minimal identifier OR a full entity object
   *
   * @param identifier - Unique identifier or full entity object
   * @param options - Optional query options including field selection
   * @returns Promise resolving to the entity or null
   *
   * @example
   * // Explicit identifier
   * await Q.player.find({ minecraftUuid: "abc-123" })
   *
   * @example
   * // Pass full entity (auto-extracts identifier)
   * await Q.player.find(somePlayer)
   *
   * @example
   * // With field projection
   * await Q.player.find({ minecraftUuid: "abc-123" }, { select: ["id", "minecraftUsername"] })
   */
  async find(
    identifier: NonNullable<TConfig["Identifier"]> | TConfig["Entity"],
    options?: { select?: Array<keyof TConfig["Entity"]> },
  ): Promise<TConfig["Entity"] | null>;
  async find<K extends keyof TConfig["Entity"]>(
    identifier: NonNullable<TConfig["Identifier"]> | TConfig["Entity"],
    options?: { select?: K[] },
  ): Promise<Pick<TConfig["Entity"], K> | null>;
  async find(
    identifier: NonNullable<TConfig["Identifier"]> | TConfig["Entity"],
    options?: { select?: Array<keyof TConfig["Entity"]> },
  ): Promise<any | null> {
    const extracted = this.extractIdentifier(identifier as Record<string, any>);
    const { whereClause, values } = this.getColumnMapping(extracted);

    // Build column selection
    const columns = options?.select
      ? options.select
          .map((field) => this.getColumnName(field as string))
          .join(", ")
      : "*";

    const query = `SELECT ${columns} FROM ${this.table} WHERE ${whereClause} LIMIT 1`;

    try {
      const result = await this.db.query<TConfig["DbEntity"]>(query, values);

      return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Failed to find ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves a single entity by unique identifier
   * Throws an error if not found
   *
   * Accepts either a minimal identifier OR a full entity object
   *
   * @param identifier - Unique identifier or full entity object
   * @param options - Optional query options including field selection
   * @returns Promise resolving to the entity
   * @throws Error if entity is not found
   *
   * @example
   * // Explicit identifier
   * await Q.player.get({ discordId: "123" })
   *
   * @example
   * // Pass full entity
   * await Q.player.get(player) // Uses player.minecraftUuid
   * await Q.player.balance.get(player) // Uses player.id (maps to playerId)
   *
   * @example
   * // With field projection
   * const player = await Q.player.get({ discordId: "123" }, { select: ["id", "minecraftUsername"] })
   */
  async get(
    identifier: NonNullable<TConfig["Identifier"]> | TConfig["Entity"],
    options?: { select?: Array<keyof TConfig["Entity"]> },
  ): Promise<TConfig["Entity"]>;
  async get<K extends keyof TConfig["Entity"]>(
    identifier: NonNullable<TConfig["Identifier"]> | TConfig["Entity"],
    options?: { select?: K[] },
  ): Promise<Pick<TConfig["Entity"], K>>;
  async get(
    identifier: NonNullable<TConfig["Identifier"]> | TConfig["Entity"],
    options?: { select?: Array<keyof TConfig["Entity"]> },
  ): Promise<any> {
    const entity = await this.find(identifier, options);

    if (!entity) {
      const extracted = this.extractIdentifier(
        identifier as Record<string, any>,
      );
      throw createNotFoundError(this.table, extracted);
    }

    return entity;
  }

  /**
   * Checks if an entity exists by unique identifier
   *
   * Accepts either a minimal identifier OR a full entity object
   *
   * @param identifier - Unique identifier or full entity object
   * @returns Promise resolving to true if entity exists, false otherwise
   *
   * @example
   * if (await Q.player.exists(player)) {
   *   // Player exists
   * }
   */
  async exists(
    identifier: NonNullable<TConfig["Identifier"]> | TConfig["Entity"],
  ): Promise<boolean> {
    const extracted = this.extractIdentifier(identifier as Record<string, any>);
    const { whereClause, values } = this.getColumnMapping(extracted);
    const query = `SELECT EXISTS(SELECT 1 FROM ${this.table} WHERE ${whereClause})`;

    try {
      const result = await this.db.query<{ exists: boolean }>(query, values);

      return Boolean(result.rows[0].exists);
    } catch (error) {
      logger.error(`Failed to check ${this.table} existence:`, error);
      throw error;
    }
  }

  /**
   * Updates a single entity by unique identifier
   *
   * Accepts either a minimal identifier OR a full entity object
   *
   * @param identifier - Unique identifier or full entity object to find the entity
   * @param updates - Object containing fields to update
   * @returns Promise resolving when the update is complete
   * @throws Error if no entity is found with the specified identifier
   *
   * @example
   * // Explicit identifier
   * await Q.player.update({ discordId: "123" }, { minecraftUsername: "NewName" })
   *
   * @example
   * // Pass full entity
   * await Q.player.update(player, { minecraftUsername: "NewName" })
   */
  async update(
    identifier: NonNullable<TConfig["Identifier"]> | TConfig["Entity"],
    updates: Partial<NonNullable<TConfig["Update"]>>,
  ): Promise<void> {
    const extracted = this.extractIdentifier(identifier as Record<string, any>);
    const { whereClause, values: identifierValues } =
      this.getColumnMapping(extracted);
    const updateMappings = this.getUpdateMapping(updates);

    const setClauses = updateMappings.map(
      (mapping, index) =>
        `${mapping.column} = $${identifierValues.length + index + 1}`,
    );

    const query = `
      UPDATE ${this.table}
      SET ${setClauses.join(", ")}
      WHERE ${whereClause}`;

    const params = [...identifierValues, ...updateMappings.map((m) => m.value)];

    try {
      const result = await this.db.query(query, params);

      if (result.rowCount === 0) {
        throw createNotFoundError(this.table, extracted);
      }
    } catch (error) {
      logger.error(`Failed to update ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Updates a single entity and returns the updated record
   *
   * Accepts either a minimal identifier OR a full entity object
   *
   * @param identifier - Unique identifier or full entity object to find the entity
   * @param updates - Object containing fields to update
   * @returns Promise resolving to the updated entity
   * @throws Error if no entity is found with the specified identifier
   *
   * @example
   * const updated = await Q.player.updateAndReturn(player, {
   *   minecraftUsername: "NewName"
   * });
   */
  async updateAndReturn(
    identifier: NonNullable<TConfig["Identifier"]> | TConfig["Entity"],
    updates: Partial<NonNullable<TConfig["Update"]>>,
  ): Promise<TConfig["Entity"]> {
    const extracted = this.extractIdentifier(identifier as Record<string, any>);
    const { whereClause, values: identifierValues } =
      this.getColumnMapping(extracted);
    const updateMappings = this.getUpdateMapping(updates);

    const setClauses = updateMappings.map(
      (mapping, index) =>
        `${mapping.column} = $${identifierValues.length + index + 1}`,
    );

    const query = `
      UPDATE ${this.table}
      SET ${setClauses.join(", ")}
      WHERE ${whereClause}
      RETURNING *`;

    const params = [...identifierValues, ...updateMappings.map((m) => m.value)];

    try {
      const result = await this.db.query<TConfig["DbEntity"]>(query, params);

      if (result.rowCount === 0) {
        throw createNotFoundError(this.table, extracted);
      }

      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to update ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a single entity by unique identifier
   *
   * Accepts either a minimal identifier OR a full entity object
   *
   * @param identifier - Unique identifier or full entity object to find the entity
   * @returns Promise resolving when the deletion is complete
   * @throws Error if no entity is found with the specified identifier
   *
   * @example
   * await Q.player.delete(player) // Uses player.minecraftUuid
   */
  async delete(
    identifier: NonNullable<TConfig["Identifier"]> | TConfig["Entity"],
  ): Promise<void> {
    const extracted = this.extractIdentifier(identifier as Record<string, any>);
    const { whereClause, values } = this.getColumnMapping(extracted);
    const query = `DELETE FROM ${this.table} WHERE ${whereClause}`;

    try {
      const result = await this.db.query(query, values);

      if (result.rowCount === 0) {
        throw createNotFoundError(this.table, extracted);
      }
    } catch (error) {
      logger.error(`Failed to delete ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Gets a specific field value with an optimized query
   * Only fetches the requested column from the database
   *
   * Accepts either a minimal identifier OR a full entity object
   *
   * @param identifier - Unique identifier or full entity object
   * @param field - Field name to retrieve
   * @returns Promise resolving to the field value
   * @throws Error if entity not found
   *
   * @example
   * const username = await Q.player.pluck(player, "minecraftUsername")
   */
  async pluck<K extends keyof TConfig["Entity"]>(
    identifier: NonNullable<TConfig["Identifier"]> | TConfig["Entity"],
    field: K,
  ): Promise<TConfig["Entity"][K]> {
    const extracted = this.extractIdentifier(identifier as Record<string, any>);
    const { whereClause, values } = this.getColumnMapping(extracted);
    const columnName = this.getColumnName(field as string);

    const query = `SELECT ${columnName} FROM ${this.table} WHERE ${whereClause} LIMIT 1`;

    try {
      const result = await this.db.query(query, values);

      if (result.rows.length === 0) {
        throw createNotFoundError(this.table, extracted);
      }

      const row = result.rows[0];
      return row[columnName] as TConfig["Entity"][K];
    } catch (error) {
      logger.error(
        `Failed to pluck ${String(field)} from ${this.table}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Proxy based optimized field getter
   * Uses pluck() under the hood for efficient queries
   *
   * Now supports both minimal identifiers and full entities
   *
   * @example
   * const username = await Q.player.select.minecraftUsername(player)
   */
  readonly select = new Proxy({} as any, {
    get: (_, field: string) => {
      return async (
        identifier: NonNullable<TConfig["Identifier"]> | TConfig["Entity"],
      ) => {
        return this.pluck(identifier, field as keyof TConfig["Entity"]);
      };
    },
  }) as {
    [K in keyof TConfig["Entity"]]: (
      identifier: NonNullable<TConfig["Identifier"]> | TConfig["Entity"],
    ) => Promise<TConfig["Entity"][K]>;
  };

  // ============================================================================
  // QUERY BUILDER (Fluent Interface)
  // ============================================================================

  /**
   * Create a query builder for fluent, composable queries
   *
   * @param filters - Optional initial filter conditions
   * @returns QueryBuilder instance
   *
   * @example
   * const players = await Q.player
   *   .where({ isActive: true })
   *   .orderBy("createdAt", "DESC")
   *   .limit(50)
   *   .all()
   *
   * @example
   * const player = await Q.player
   *   .where({ minecraftUsername: "Steve" })
   *   .select(["id", "minecraftUsername"])
   *   .first()
   */
  where(
    filters: Partial<NonNullable<TConfig["Filters"]>>,
  ): QueryBuilder<TConfig> {
    return new QueryBuilder<TConfig>((f, opts) => this.findAll(f, opts)).where(
      filters,
    );
  }

  /**
   * Create a query builder starting with orderBy
   *
   * @param field - Field to sort by
   * @param direction - Sort direction (default: "ASC")
   * @returns QueryBuilder instance
   *
   * @example
   * const players = await Q.player
   *   .orderBy("createdAt", "DESC")
   *   .limit(10)
   *   .all()
   */
  orderBy(
    field: keyof TConfig["Entity"],
    direction: "ASC" | "DESC" = "ASC",
  ): QueryBuilder<TConfig> {
    return new QueryBuilder<TConfig>((f, opts) =>
      this.findAll(f, opts),
    ).orderBy(field, direction);
  }

  /**
   * Create a query builder starting with limit
   *
   * @param count - Maximum number of rows to return
   * @returns QueryBuilder instance
   *
   * @example
   * const players = await Q.player.limit(10).all()
   */
  limit(count: number): QueryBuilder<TConfig> {
    return new QueryBuilder<TConfig>((f, opts) => this.findAll(f, opts)).limit(
      count,
    );
  }

  /**
   * Create a query builder starting with offset
   *
   * @param count - Number of rows to skip
   * @returns QueryBuilder instance
   *
   * @example
   * const players = await Q.player.offset(20).limit(10).all()
   */
  offset(count: number): QueryBuilder<TConfig> {
    return new QueryBuilder<TConfig>((f, opts) => this.findAll(f, opts)).offset(
      count,
    );
  }

  /**
   * Create a query builder starting with field selection
   *
   * @param fields - Array of field names to select
   * @returns QueryBuilder instance
   *
   * @example
   * const players = await Q.player
   *   .select(["id", "minecraftUsername"])
   *   .where({ isActive: true })
   *   .all()
   */
  selectFields(fields: Array<keyof TConfig["Entity"]>): QueryBuilder<TConfig> {
    return new QueryBuilder<TConfig>((f, opts) => this.findAll(f, opts)).select(
      fields,
    );
  }

  /**
   * Create a query builder starting with pagination
   *
   * @param page - Page number (0-indexed)
   * @param pageSize - Number of items per page
   * @returns QueryBuilder instance
   *
   * @example
   * const players = await Q.player
   *   .paginate(2, 20)
   *   .where({ isActive: true })
   *   .all()
   */
  paginate(page: number, pageSize: number): QueryBuilder<TConfig> {
    return new QueryBuilder<TConfig>((f, opts) =>
      this.findAll(f, opts),
    ).paginate(page, pageSize);
  }

  // ============================================================================
  // MULTIPLE ENTITY OPERATIONS (by non-unique filters)
  // ============================================================================

  /**
   * Finds all entities matching the filter criteria
   *
   * @param filters - Optional filter criteria (can be partial)
   * @param options - Optional pagination, sorting, and field selection options
   * @returns Promise resolving to an array of entities
   *
   * @example
   * // Get all players
   * await Q.player.findAll()
   *
   * @example
   * // With filters
   * await Q.player.findAll({ isActive: true })
   *
   * @example
   * // With field projection
   * await Q.player.findAll({ isActive: true }, { select: ["id", "minecraftUsername"] })
   *
   * @example
   * // With pagination and sorting
   * await Q.player.findAll(
   *   { isActive: true },
   *   { limit: 10, offset: 0, orderBy: "createdAt", orderDirection: "DESC" }
   * )
   */
  async findAll(
    filters?: Partial<NonNullable<TConfig["Filters"]>>,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: keyof TConfig["Entity"];
      orderDirection?: "ASC" | "DESC";
      select?: Array<keyof TConfig["Entity"]>;
    },
  ): Promise<TConfig["Entity"][]>;
  async findAll<K extends keyof TConfig["Entity"]>(
    filters?: Partial<NonNullable<TConfig["Filters"]>>,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: keyof TConfig["Entity"];
      orderDirection?: "ASC" | "DESC";
      select?: K[];
    },
  ): Promise<Pick<TConfig["Entity"], K>[]>;
  async findAll(
    filters?: Partial<NonNullable<TConfig["Filters"]>>,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: keyof TConfig["Entity"];
      orderDirection?: "ASC" | "DESC";
      select?: Array<keyof TConfig["Entity"]>;
    },
  ): Promise<any[]> {
    const { whereClause, params } = filters
      ? this.buildFilterClause(filters)
      : { whereClause: "1=1", params: [] };

    // Build column selection
    const columns = options?.select
      ? options.select
          .map((field) => this.getColumnName(field as string))
          .join(", ")
      : "*";

    let query = `SELECT ${columns} FROM ${this.table} WHERE ${whereClause}`;

    if (options?.orderBy) {
      const orderColumn = this.getColumnName(options.orderBy as string);
      query += ` ORDER BY ${orderColumn} ${options.orderDirection || "ASC"}`;
    }

    if (options?.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(options.offset);
    }

    try {
      const result = await this.db.query<TConfig["DbEntity"]>(query, params);
      return this.mapRowsToEntities(result.rows);
    } catch (error) {
      logger.error(`Failed to find all ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Retrieves all entities from the table with optional pagination and sorting
   * Alias for findAll() with no filters
   *
   * @param options - Optional pagination, sorting, and field selection options
   * @returns Promise resolving to an array of all entities
   *
   * @example
   * // Get all players
   * await Q.player.getAll()
   *
   * @example
   * // With field projection
   * await Q.player.getAll({ select: ["id", "minecraftUsername"] })
   */
  async getAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: keyof TConfig["Entity"];
    orderDirection?: "ASC" | "DESC";
    select?: Array<keyof TConfig["Entity"]>;
  }): Promise<TConfig["Entity"][]>;
  async getAll<K extends keyof TConfig["Entity"]>(options?: {
    limit?: number;
    offset?: number;
    orderBy?: keyof TConfig["Entity"];
    orderDirection?: "ASC" | "DESC";
    select?: K[];
  }): Promise<Pick<TConfig["Entity"], K>[]>;
  async getAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: keyof TConfig["Entity"];
    orderDirection?: "ASC" | "DESC";
    select?: Array<keyof TConfig["Entity"]>;
  }): Promise<any[]> {
    return this.findAll(undefined, options);
  }

  /**
   * Updates all entities matching the filter criteria
   * If no filers provided, updates ALL records in the table
   *
   * @param updates - Object containing fields to update
   * @param filtters - Optional filter criteria to match specific entries
   * @returns Promise resolving to the number of rows affected
   */
  async updateAll(
    updates: Partial<NonNullable<TConfig["Update"]>>,
    filters?: Partial<NonNullable<TConfig["Filters"]>>,
  ): Promise<number> {
    const { whereClause, params } = filters
      ? this.buildFilterClause(filters)
      : { whereClause: "1=1", params: [] };

    const updateMappings = this.getUpdateMapping(updates);

    const setClauses = updateMappings.map(
      (mapping, index) => `${mapping.column} = $${params.length + index + 1}`,
    );

    const query = `
        UPDATE ${this.table}
        SET ${setClauses.join(", ")}
        WHERE ${whereClause}`;

    const allParams = [...params, ...updateMappings.map((m) => m.value)];

    try {
      const result = await this.db.query(query, allParams);

      logger.info(`Updated ${result.rowCount} ${this.table} record(s)`);
      return result.rowCount || 0;
    } catch (error) {
      logger.error(`Failed to update ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Deletes all entities matching the filter criteria
   * Filters are required to prevent accidental table-wide deletion
   *
   * @param filters - Filter criteria to match specific entities (required)
   * @returns Promise resolving to the number of rows affected
   */
  async deleteAll(
    filters: Partial<NonNullable<TConfig["Filters"]>>,
  ): Promise<number> {
    if (!filters || Object.keys(filters).length === 0) {
      throw new Error(
        `deleteAll requires at least one filter. Use drop() to delete all records from ${this.table}`,
      );
    }

    const { whereClause, params } = this.buildFilterClause(filters);
    const query = `DELETE FROM ${this.table} WHERE ${whereClause}`;

    try {
      const result = await this.db.query(query, params);
      logger.info(`Deleted ${result.rowCount} ${this.table} record(s)`);
      return result.rowCount || 0;
    } catch (error) {
      logger.error(`Failed to delete from ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Drops all records from the table
   * This is equivalent to TRUNCATE but returns the count of deleted rows
   * Use with extreme caution - this cannot be undone
   *
   * @returns Promise resolving to the number of rows deleted
   */
  async drop(): Promise<number> {
    const query = `DELETE FROM ${this.table}`;

    try {
      const result = await this.db.query(query);
      logger.warn(
        `DROPPED all ${result.rowCount} record(s) from ${this.table}`,
      );
      return result.rowCount || 0;
    } catch (error) {
      logger.error(`Failed to drop ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Truncates the table (faster than drop for large tables)
   * Resets auto-increment sequences and removes all rows instantly
   * Use with extreme caution - this cannot be undone
   *
   * @param cascade - If true, also truncates tables with foreign key references
   * @param restartIdentity - If true, restarts identity columns (auto-increment)
   * @returns Promise resolving to when truncation is complete
   */
  async truncate(options?: {
    cascade?: boolean;
    restartIdentity?: boolean;
  }): Promise<void> {
    let query = `TRUNCATE TABLE ${this.table}`;

    if (options?.restartIdentity) {
      query += " RESTART IDENTITY";
    }

    if (options?.cascade) {
      query += " CASCADE";
    }

    try {
      await this.db.query(query);
      logger.warn(`TRUNCATED table ${this.table}`);
    } catch (error) {
      logger.error(`Failed to truncate ${this.table}`);
      throw error;
    }
  }

  // ============================================================================
  // CREATE OPERATIONS
  // ============================================================================

  /**
   * Creates and persists a new entity record in the database
   *
   * @param data - Object containing creation data
   * @returns Promise resolving when the entity is created
   */
  async create(data: NonNullable<TConfig["Create"]>): Promise<void> {
    const createMappings = this.getCreateMapping(data);

    const columns = createMappings.map((m) => m.column).join(", ");
    const placeholders = createMappings
      .map((_, index) => `$${index + 1}`)
      .join(", ");

    const values = createMappings.map((m) => m.value);

    const query = `INSERT INTO ${this.table} (${columns}) VALUES (${placeholders})`;

    try {
      await this.db.query(query, values);
    } catch (error) {
      logger.error(`Failed to create ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Creates and return the new entity with generated fields
   *
   * @param data - Object containing creation data
   * @returns Promise resolving to the created entity
   */
  async createAndReturn(
    data: NonNullable<TConfig["Create"]>,
  ): Promise<TConfig["Entity"]> {
    const createMappings = this.getCreateMapping(data);

    const columns = createMappings.map((m) => m.column).join(", ");
    const placeholders = createMappings
      .map((_, index) => `$${index + 1}`)
      .join(", ");
    const values = createMappings.map((m) => m.value);

    const query = `INSERT INTO ${this.table} (${columns}) VALUES (${placeholders}) RETURNING *`;

    try {
      const result = await this.db.query<TConfig["DbEntity"]>(query, values);

      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to create ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Insert or update if conflict occurs on constraint
   * Uses PostgreSQL's ON CONFLICT clause
   *
   * @param data - Object containing creation data
   * @param conflictTarget - Column(s) to check for conflicts
   * @param updateFields - Fields to update on conflict
   * @returns Promise resolving to the upserted entity
   */
  async upsert(
    data: NonNullable<TConfig["Create"]>,
    conflictTarget:
      | keyof NonNullable<TConfig["Create"]>
      | Array<keyof NonNullable<TConfig["Create"]>>,
    updateFields?: Array<keyof NonNullable<TConfig["Create"]>>,
  ): Promise<TConfig["Entity"]> {
    const createMappings = this.getCreateMapping(data);
    const columns = createMappings.map((m) => m.column).join(", ");
    const placeholders = createMappings
      .map((_, index) => `$${index + 1}`)
      .join(", ");
    const values = createMappings.map((m) => m.value);

    const conflictColumns = Array.isArray(conflictTarget)
      ? conflictTarget
          .map((key) => this.getColumnName(key as string))
          .join(", ")
      : this.getColumnName(conflictTarget as string);

    const fieldsToUpdate = updateFields
      ? updateFields.map((key) => this.getColumnName(key as string))
      : createMappings.map((m) => m.column);

    const updateClause = fieldsToUpdate
      .map((col) => `${col} = EXCLUDED.${col}`)
      .join(", ");

    const query = `
        INSERT INTO ${this.table} (${columns})
        VALUES (${placeholders})
        ON CONFLICT (${conflictColumns})
        DO UPDATE SET ${updateClause}
        RETURNING *`;

    try {
      const result = await this.db.query<TConfig["DbEntity"]>(query, values);

      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      logger.error(`Failed to upsert ${this.table}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Counts entities matching the filter criteria
   *
   * @param filters - Optional filter criteria (can be partial)
   * @returns Promise resolving to the count
   */
  async count(
    filters?: Partial<NonNullable<TConfig["Filters"]>>,
  ): Promise<number> {
    const { whereClause, params } = filters
      ? this.buildFilterClause(filters)
      : { whereClause: "1=1", params: [] };

    const query = `SELECT COUNT(*) FROM ${this.table} WHERE ${whereClause}`;

    try {
      const result = await this.db.query<{ count: string | number | bigint }>(
        query,
        params,
      );

      const count = result.rows[0].count;
      return typeof count === "bigint" ? Number(count) : Number(count ?? 0);
    } catch (error) {
      logger.error(`Failed to count ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Executes a raw SQL query with type safety
   * Use with caution - bypasses all abstraction layers
   *
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns Promise resolving to query results
   */
  async raw(query: string, params?: any[]): Promise<TConfig["Entity"][]> {
    try {
      const result = await this.db.query<TConfig["DbEntity"]>(query, params);

      return this.mapRowsToEntities(result.rows);
    } catch (error) {
      logger.error(`Failed to execute raw query on ${this.table}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // TRANSACTION SUPPORT
  // ============================================================================

  /**
   * Create a new instance of this qeury class using a transaction client
   * Allows using the same query API with the transaction helper
   *
   * @param client - Transaction client
   * @returns New instance using the transaction client
   *
   * @example
   * import { transaction } from "@/db/utils/transactions";
   * import { PlayerQueries } fron "@/db/queries/player";
   *
   * await transaction(db, async (client) => {
   *    const queries = new PlayerQueries(db).useClient(client);
   *    await queries.create({...});
   *    await queries.balance.create({...});
   * })
   */
  useClient(client: PoolClient): this {
    const Constructor = this.constructor as new (db: Pool | PoolClient) => this;
    return new Constructor(client);
  }

  /**
   * Check if this query instance is using a transaction client
   * Useful for debugging or conditional logic
   */
  isInTransaction(): boolean {
    return "processID" in this.db;
  }

  /**
   * Execute a callback within a transaction using this query class
   * Convenience wrapper around the transaction helper
   *
   * @param callback - Function to execute with transaction enables queries
   * @returns Result from callback
   */
  async inTransaction<T>(callback: (queries: this) => Promise<T>): Promise<T> {
    const client = await (this.db as Pool).connect();

    try {
      await client.query("BEGIN");
      logger.debug("Transaction started");

      const txQueries = this.useClient(client);
      const result = await callback(txQueries);

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
}
