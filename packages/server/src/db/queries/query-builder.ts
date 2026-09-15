import type { QueryResultRow } from "pg";

/** Shared options shape used by QueryBuilder and findAll */
interface QueryBuilderOptions<TConfig extends { Entity: QueryResultRow }> {
  limit?: number;
  offset?: number;
  orderBy?: keyof TConfig["Entity"];
  orderDirection?: "asc" | "desc";
  select?: ReadonlyArray<keyof TConfig["Entity"]>;
}

/**
 * Row shape produced by a select projection: the full entity when the
 * selected keys cover every column (a widened `Array<keyof Entity>`),
 * otherwise a Pick of the literal keys
 */
export type Selected<TEntity, K extends keyof TEntity> = keyof TEntity extends K
  ? TEntity
  : Pick<TEntity, K>;

/**
 * Fluent query builder for composable queries
 * Accumulates filters and options, then executes via the underlying BaseQueries methods
 * TResult is the row type returned by all()/first(), narrowed by select()
 */
export class QueryBuilder<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic constraint requires any for structural compatibility
  TConfig extends { Entity: QueryResultRow; Filters?: Record<string, any> },
  TResult = TConfig["Entity"],
> {
  private filters: Partial<NonNullable<TConfig["Filters"]>> = {};
  private options: {
    limit?: number;
    offset?: number;
    orderBy?: keyof TConfig["Entity"];
    orderDirection?: "asc" | "desc";
    select?: ReadonlyArray<keyof TConfig["Entity"]>;
  } = {};

  constructor(
    private executor: (
      filters?: Partial<NonNullable<TConfig["Filters"]>>,
      options?: QueryBuilderOptions<TConfig>,
    ) => Promise<TConfig["Entity"][]>,
    private counter: (
      filters?: Partial<NonNullable<TConfig["Filters"]>>,
    ) => Promise<number>,
  ) {}

  /**
   * Add filter conditions
   * Can be called multiple times: conditions on different keys are ANDed,
   * and a key given twice takes the later value
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
   * Narrows the row type of all()/first()/firstOrFail() to the selected keys
   *
   * @param fields - Array of field names to select
   * @returns This builder for chaining, typed to the projected row
   *
   * @example
   * Q.player.where({ isActive: true }).select(["id", "minecraftUsername"])
   */
  select<K extends keyof TConfig["Entity"]>(
    fields: readonly K[],
  ): QueryBuilder<TConfig, Selected<TConfig["Entity"], K>> {
    this.options.select = fields;
    return this as unknown as QueryBuilder<
      TConfig,
      Selected<TConfig["Entity"], K>
    >;
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
   * @example
   * const players = await Q.player
   *   .where({ isActive: true })
   *   .orderBy("createdAt", "desc")
   *   .limit(10)
   *   .all()
   */
  async all(): Promise<TResult[]> {
    const results = await this.executor(this.filters, this.options);
    return results as TResult[];
  }

  /**
   * Execute the query and return the first result
   * Returns null if no results found
   *
   * @example
   * const player = await Q.player
   *   .where({ minecraftUsername: "Steve" })
   *   .first()
   */
  async first(): Promise<TResult | null> {
    const results = await this.executor(this.filters, {
      ...this.options,
      limit: 1,
    });
    return (results[0] as TResult | undefined) || null;
  }

  /**
   * Execute the query and return the first result
   * Throws an error if no results found
   *
   * @throws Error if no results found
   *
   * @example
   * const player = await Q.player
   *   .where({ minecraftUsername: "Steve" })
   *   .firstOrFail()
   */
  async firstOrFail(): Promise<TResult> {
    const result = await this.first();
    if (!result) {
      throw new Error("No results found for query");
    }
    return result;
  }

  /**
   * Count the rows matching the accumulated filters with a COUNT(*) query
   * Ignores orderBy, limit, offset, and select
   *
   * @example
   * const count = await Q.player.where({ isActive: true }).count()
   */
  async count(): Promise<number> {
    return this.counter(this.filters);
  }
}
