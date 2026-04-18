import type { QueryResultRow } from "pg";

/** Shared options shape used by QueryBuilder and findAll */
interface QueryBuilderOptions<TConfig extends { Entity: QueryResultRow }> {
  limit?: number;
  offset?: number;
  orderBy?: keyof TConfig["Entity"];
  orderDirection?: "asc" | "desc";
  select?: Array<keyof TConfig["Entity"]>;
}

/**
 * Fluent query builder for composable queries
 * Accumulates filters and options, then executes via the underlying BaseQueries methods
 */
export class QueryBuilder<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic constraint requires any for structural compatibility
  TConfig extends { Entity: QueryResultRow; Filters?: Record<string, any> },
> {
  private filters: Partial<NonNullable<TConfig["Filters"]>> = {};
  private options: {
    limit?: number;
    offset?: number;
    orderBy?: keyof TConfig["Entity"];
    orderDirection?: "asc" | "desc";
    select?: Array<keyof TConfig["Entity"]>;
  } = {};

  constructor(
    private executor: (
      filters?: Partial<NonNullable<TConfig["Filters"]>>,
      options?: QueryBuilderOptions<TConfig>,
    ) => Promise<TConfig["Entity"][]>,
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
   * @param direction - Sort direction (default: "asc")
   * @returns This builder for chaining
   *
   * @example
   * Q.player.where({ isActive: true }).orderBy("createdAt", "desc")
   */
  orderBy(
    field: keyof TConfig["Entity"],
    direction: "asc" | "desc" = "asc",
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
   *   .orderBy("createdAt", "desc")
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
