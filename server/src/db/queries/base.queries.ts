import type { Pool, QueryResultRow } from "pg";
import logger from "@/logger";
import { createNotFoundError } from "../utils/query-helpers";

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
  }
> {
  protected abstract readonly table: string;
  protected readonly COLUMN_MAP?: Record<string, string>;

  constructor(protected db: Pool) {}

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
    row: TBdRow
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
    rows: TDbRow[]
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
    filters: Partial<NonNullable<TConfig["Filters"]>>
  ): {
    whereClause: string;
    params: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        const column = this.getColumnName(key);
        if (column) {
          conditions.push(`${column} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      }
    }

    return {
      whereClause: conditions.length > 0 ? conditions.join(" AND ") : "1=1",
      params,
    };
  }

  // ============================================================================
  // SINGLE ENTITY OPERATIONS (by unique identifiers)
  // ============================================================================

  /**
   * Finds a single entity by unique identifier
   * Returns null if not found
   *
   * @param identifier - Unique identifier
   * @returns Promise resolving to the entity or null
   */
  async find(
    identifier: NonNullable<TConfig["Identifier"]>
  ): Promise<TConfig["Entity"] | null> {
    const { whereClause, values } = this.getColumnMapping(identifier);
    const query = `SELECT * FROM ${this.table} WHERE ${whereClause} LIMIT 1`;

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
   * @param identifier - Unique identifier
   * @returns Promise resolving to the entity
   * @throws Error if entity is not found
   */
  async get(
    identifier: NonNullable<TConfig["Identifier"]>
  ): Promise<TConfig["Entity"]> {
    const entity = await this.find(identifier);

    if (!entity) {
      throw createNotFoundError(this.table, identifier);
    }

    return entity;
  }

  /**
   * Checks if an entity exists by unique identifier
   *
   * @param identifier - Unique identifier
   * @returns Promise resolving to true if entity exists, false otherwise
   */
  async exists(
    identifier: NonNullable<TConfig["Identifier"]>
  ): Promise<boolean> {
    const { whereClause, values } = this.getColumnMapping(identifier);
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
   * @param identifier - Unique identifier to find the entity
   * @param updates - Object containing fields to update
   * @returns Promise resolving when the update is complete
   * @throws Error if no entity is found with the specified identifier
   */
  async update(
    identifier: NonNullable<TConfig["Identifier"]>,
    updates: Partial<NonNullable<TConfig["Update"]>>
  ): Promise<void> {
    const { whereClause, values: identifierValues } =
      this.getColumnMapping(identifier);
    const updateMappings = this.getUpdateMapping(updates);

    const setClauses = updateMappings.map(
      (mapping, index) =>
        `${mapping.column} = $${identifierValues.length + index + 1}`
    );

    const query = `
        UPDATE ${this.table}
        SET ${setClauses.join(", ")}
        WHERE ${whereClause}`;

    const params = [...identifierValues, ...updateMappings.map((m) => m.value)];

    try {
      const result = await this.db.query(query, params);

      if (result.rowCount === 0) {
        throw createNotFoundError(this.table, identifier);
      }
    } catch (error) {
      logger.error(`Failed to update ${this.table}:`, error);
      throw error;
    }
  }

  /**
   * Updates a single entity and returns the updated record
   *
   * @param identifier - Unique identifier to find the entity
   * @param updates - Object containing fields to update
   * @returns Promise resolving to the updated entity
   * @throws Error if no entity is found with the specified identifier
   */
  async updateAndReturn(
    identifier: NonNullable<TConfig["Identifier"]>,
    updates: Partial<NonNullable<TConfig["Update"]>>
  ): Promise<TConfig["Entity"]> {
    const { whereClause, values: identifierValues } =
      this.getColumnMapping(identifier);
    const updateMappings = this.getUpdateMapping(updates);

    const setClauses = updateMappings.map(
      (mapping, index) =>
        `${mapping.column} = $${identifierValues.length + index + 1}`
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
        throw createNotFoundError(this.table, identifier);
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
   * @param identifier - Unique identifier to find the entity
   * @returns Promise resolving when the deletion is complete
   * @throws Error if no entity is found with the specified identifier
   */
  async delete(identifier: NonNullable<TConfig["Identifier"]>): Promise<void> {
    const { whereClause, values } = this.getColumnMapping(identifier);
    const query = `DELETE FROM ${this.table} WHERE ${whereClause}`;

    try {
      const result = await this.db.query(query, values);

      if (result.rowCount === 0) {
        throw createNotFoundError(this.table, identifier);
      }
    } catch (error) {
      logger.error(`Failed to delete ${this.table}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // MULTIPLE ENTITY OPERATIONS (by non-unique filters)
  // ============================================================================

  /**
   * Finds all entities matching the filter criteria
   *
   * @param filters - Optional filter criteria (can be partial)
   * @param options - Optional pagination and sorting options
   * @returns Promise resolving to an array of entities
   */
  async findAll(
    filters?: Partial<NonNullable<TConfig["Filters"]>>,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      orderDirection?: "ASC" | "DESC";
    }
  ): Promise<TConfig["Entity"][]> {
    const { whereClause, params } = filters
      ? this.buildFilterClause(filters)
      : { whereClause: "1=1", params: [] };

    let query = `SELECT * FROM ${this.table} WHERE ${whereClause}`;

    if (options?.orderBy) {
      const orderColumn = this.getColumnName(options.orderBy);
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
   * @param options - Optional pagination and sorting options
   * @returns Promise resolving to an array of all entities
   */
  async getAll(options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
  }): Promise<TConfig["Entity"][]> {
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
    filters?: Partial<NonNullable<TConfig["Filters"]>>
  ): Promise<number> {
    const { whereClause, params } = filters
      ? this.buildFilterClause(filters)
      : { whereClause: "1=1", params: [] };

    const updateMappings = this.getUpdateMapping(updates);

    const setClauses = updateMappings.map(
      (mapping, index) => `${mapping.column} = $${params.length + index + 1}`
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
    filters: Partial<NonNullable<TConfig["Filters"]>>
  ): Promise<number> {
    if (!filters || Object.keys(filters).length === 0) {
      throw new Error(
        `deleteAll requires at least one filter. Use drop() to delete all records from ${this.table}`
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
        `DROPPED all ${result.rowCount} record(s) from ${this.table}`
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
    data: NonNullable<TConfig["Create"]>
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
    updateFields?: Array<keyof NonNullable<TConfig["Create"]>>
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
    filters?: Partial<NonNullable<TConfig["Filters"]>>
  ): Promise<number> {
    const { whereClause, params } = filters
      ? this.buildFilterClause(filters)
      : { whereClause: "1=1", params: [] };

    const query = `SELECT COUNT(*) FROM ${this.table} WHERE ${whereClause}`;

    try {
      const result = await this.db.query<{ count: number }>(query, params);

      return result.rows[0].count ?? 0;
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

  /**
   * Begins a database transaction
   * Returns a transaction client that must be commited or rolled back
   *
   * @returns Promise resolving to the transaction client
   */
  async begin() {
    const client = await this.db.connect();
    await client.query("BEGIN");
    return client;
  }
}
