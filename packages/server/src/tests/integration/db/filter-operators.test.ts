import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { QueryInstances } from "@/generated/db/queries";
import {
  getTestPool,
  getTestQueries,
  truncateTable,
  cleanupTestPool,
} from "@/tests/helpers/db";

describe("Filter operators (server table)", () => {
  let Q: QueryInstances;

  beforeAll(async () => {
    const pool = getTestPool();
    await pool.query("SELECT 1");
    Q = getTestQueries();
  });

  beforeEach(async () => {
    await truncateTable("server");

    // Seed rows with predictable IDs (RESTART IDENTITY ensures id starts at 1)
    await Q.server.create({ name: "Alpha", identifier: "alpha" }); // id=1
    await Q.server.create({ name: "Beta", identifier: "beta" }); // id=2
    await Q.server.create({ name: "Gamma", identifier: "gamma" }); // id=3
    await Q.server.create({ name: "Delta", identifier: "delta" }); // id=4
  });

  afterAll(async () => {
    await cleanupTestPool();
  });

  // ==========================================================================
  // EQUALITY OPERATORS
  // ==========================================================================

  it("$eq should match exact value", async () => {
    const results = await Q.server.findAll({ name: { $eq: "Alpha" } as any });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Alpha");
  });

  it("$ne should exclude matching value", async () => {
    const results = await Q.server.findAll({ name: { $ne: "Alpha" } as any });
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.name !== "Alpha")).toBe(true);
  });

  // ==========================================================================
  // COMPARISON OPERATORS
  // ==========================================================================

  it("$gt should match greater than", async () => {
    const results = await Q.server.findAll({ id: { $gt: 2 } as any });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.id > 2)).toBe(true);
  });

  it("$gte should match greater than or equal", async () => {
    const results = await Q.server.findAll({ id: { $gte: 2 } as any });
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.id >= 2)).toBe(true);
  });

  it("$lt should match less than", async () => {
    const results = await Q.server.findAll({ id: { $lt: 3 } as any });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.id < 3)).toBe(true);
  });

  it("$lte should match less than or equal", async () => {
    const results = await Q.server.findAll({ id: { $lte: 3 } as any });
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.id <= 3)).toBe(true);
  });

  // ==========================================================================
  // ARRAY OPERATORS
  // ==========================================================================

  it("$in should match any value in array", async () => {
    const results = await Q.server.findAll({
      name: { $in: ["Alpha", "Gamma"] } as any,
    });
    expect(results).toHaveLength(2);
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(["Alpha", "Gamma"]);
  });

  it("$in with empty array should return no results", async () => {
    const results = await Q.server.findAll({ name: { $in: [] } as any });
    expect(results).toHaveLength(0);
  });

  it("$nin should exclude values in array", async () => {
    const results = await Q.server.findAll({
      name: { $nin: ["Alpha", "Beta"] } as any,
    });
    expect(results).toHaveLength(2);
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(["Delta", "Gamma"]);
  });

  it("$nin with empty array should return all results", async () => {
    const results = await Q.server.findAll({ name: { $nin: [] } as any });
    expect(results).toHaveLength(4);
  });

  // ==========================================================================
  // PATTERN MATCHING
  // ==========================================================================

  it("$like should match with case-sensitive pattern", async () => {
    const results = await Q.server.findAll({
      name: { $like: "Al%" } as any,
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Alpha");
  });

  it("$ilike should match with case-insensitive pattern", async () => {
    const results = await Q.server.findAll({
      name: { $ilike: "al%" } as any,
    });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Alpha");
  });

  // ==========================================================================
  // NULL CHECKING
  // ==========================================================================

  it("$exists: true should find non-null values", async () => {
    const results = await Q.server.findAll({
      name: { $exists: true } as any,
    });
    expect(results).toHaveLength(4);
  });

  it("$exists: false should find null values", async () => {
    // All server rows have non-null names, so this should return nothing
    const results = await Q.server.findAll({
      name: { $exists: false } as any,
    });
    expect(results).toHaveLength(0);
  });

  it("null filter value should produce IS NULL", async () => {
    // All rows have non-null names so we expect 0
    const results = await Q.server.findAll({ name: null as any });
    expect(results).toHaveLength(0);
  });

  // ==========================================================================
  // RANGE
  // ==========================================================================

  it("$between should match range inclusive", async () => {
    const results = await Q.server.findAll({
      id: { $between: [2, 3] } as any,
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.id >= 2 && r.id <= 3)).toBe(true);
  });

  it("$between should throw for invalid input", async () => {
    await expect(
      Q.server.findAll({ id: { $between: [1] } as any }),
    ).rejects.toThrow("$between requires an array of exactly 2 values");
  });

  // ==========================================================================
  // COMBINED OPERATORS
  // ==========================================================================

  it("should combine multiple operators on the same field", async () => {
    const results = await Q.server.findAll({
      id: { $gte: 2, $lte: 3 } as any,
    });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.id >= 2 && r.id <= 3)).toBe(true);
  });

  it("should combine operators across different fields", async () => {
    const results = await Q.server.findAll({
      id: { $gte: 2 } as any,
      name: { $like: "%a%" } as any,
    });
    // id >= 2: Beta(2), Gamma(3), Delta(4)
    // name contains 'a': Beta, Gamma, Delta all contain 'a'
    expect(results).toHaveLength(3);
  });
});
