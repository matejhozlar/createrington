import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { QueryInstances } from "@/generated/db/queries";
import {
  getTestPool,
  getTestQueries,
  truncateTable,
  cleanupTestPool,
} from "@/tests/helpers/db";

describe("QueryBuilder (server table)", () => {
  let Q: QueryInstances;

  beforeAll(async () => {
    const pool = getTestPool();
    await pool.query("SELECT 1");
    Q = getTestQueries();
  });

  beforeEach(async () => {
    await truncateTable("server");

    // Seed three rows in deterministic order
    await Q.server.create({ name: "Alpha", identifier: "alpha" });
    await Q.server.create({ name: "Beta", identifier: "beta" });
    await Q.server.create({ name: "Gamma", identifier: "gamma" });
  });

  afterAll(async () => {
    await cleanupTestPool();
  });

  // ==========================================================================
  // WHERE
  // ==========================================================================

  it("should filter with a single where()", async () => {
    const results = await Q.server.where({ name: "Alpha" }).all();
    expect(results).toHaveLength(1);
    expect(results[0].identifier).toBe("alpha");
  });

  it("should merge chained where() calls (AND)", async () => {
    const results = await Q.server
      .where({ name: "Alpha" })
      .where({ identifier: "alpha" })
      .all();
    expect(results).toHaveLength(1);
  });

  it("should return empty array when where() matches nothing", async () => {
    const results = await Q.server.where({ name: "Nonexistent" }).all();
    expect(results).toHaveLength(0);
  });

  // ==========================================================================
  // ORDER BY
  // ==========================================================================

  it("should sort ascending", async () => {
    const results = await Q.server.orderBy("name", "asc").all();
    expect(results.map((r) => r.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("should sort descending", async () => {
    const results = await Q.server.orderBy("name", "desc").all();
    expect(results.map((r) => r.name)).toEqual(["Gamma", "Beta", "Alpha"]);
  });

  // ==========================================================================
  // LIMIT / OFFSET / PAGINATE
  // ==========================================================================

  it("should apply limit", async () => {
    const results = await Q.server.orderBy("name", "asc").limit(2).all();
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("Alpha");
  });

  it("should apply offset", async () => {
    const results = await Q.server
      .orderBy("name", "asc")
      .limit(1)
      .offset(1)
      .all();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Beta");
  });

  it("should paginate correctly", async () => {
    const page0 = await Q.server.orderBy("name", "asc").paginate(0, 2).all();
    expect(page0).toHaveLength(2);
    expect(page0[0].name).toBe("Alpha");

    const page1 = await Q.server.orderBy("name", "asc").paginate(1, 2).all();
    expect(page1).toHaveLength(1);
    expect(page1[0].name).toBe("Gamma");
  });

  // ==========================================================================
  // SELECT (field projection)
  // ==========================================================================

  it("should project fields with select()", async () => {
    const results = await Q.server
      .where({ name: "Alpha" })
      .select(["name"])
      .all();
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty("name", "Alpha");
  });

  // ==========================================================================
  // FIRST / FIRST OR FAIL
  // ==========================================================================

  it("should return first result or null", async () => {
    const result = await Q.server.where({ name: "Alpha" }).first();
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Alpha");
  });

  it("should return null from first() when no match", async () => {
    const result = await Q.server.where({ name: "Nonexistent" }).first();
    expect(result).toBeNull();
  });

  it("should return first result from firstOrFail()", async () => {
    const result = await Q.server.where({ name: "Alpha" }).firstOrFail();
    expect(result.name).toBe("Alpha");
  });

  it("should throw from firstOrFail() when no match", async () => {
    await expect(
      Q.server.where({ name: "Nonexistent" }).firstOrFail(),
    ).rejects.toThrow("No results found");
  });

  // ==========================================================================
  // FULL PIPELINE CHAIN
  // ==========================================================================

  it("should chain where → orderBy → limit → offset → select → all", async () => {
    // Add more rows so pagination is meaningful
    await Q.server.create({ name: "Delta", identifier: "delta" });
    await Q.server.create({ name: "Epsilon", identifier: "epsilon" });

    const results = await Q.server
      .where({
        name: { $in: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"] } as any,
      })
      .orderBy("name", "asc")
      .limit(2)
      .offset(1)
      .select(["name", "identifier"])
      .all();

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("Beta");
    expect(results[1].name).toBe("Delta");
  });
});
