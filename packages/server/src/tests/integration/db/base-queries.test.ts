import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { QueryInstances } from "@/generated/db/queries";
import {
  NotFoundError,
  ConstraintViolationError,
  UniqueViolationError,
  NotNullViolationError,
  ForeignKeyViolationError,
} from "@/db/utils/errors";
import {
  getTestPool,
  getTestQueries,
  truncateTable,
  cleanupTestPool,
} from "@/tests/helpers/db";

describe("BaseQueries (server table)", () => {
  let Q: QueryInstances;

  beforeAll(async () => {
    const pool = getTestPool();
    await pool.query("SELECT 1"); // verify connectivity
    Q = getTestQueries();
  });

  beforeEach(async () => {
    await truncateTable("server");
  });

  afterAll(async () => {
    await cleanupTestPool();
  });

  // ==========================================================================
  // CREATE
  // ==========================================================================

  describe("create / createAndReturn", () => {
    it("should create a record", async () => {
      await Q.server.create({ name: "Survival", identifier: "survival" });

      const count = await Q.server.count();
      expect(count).toBe(1);
    });

    it("should create and return the record with generated fields", async () => {
      const server = await Q.server.createAndReturn({
        name: "Survival",
        identifier: "survival",
      });

      expect(server.id).toBeTypeOf("number");
      expect(server.name).toBe("Survival");
      expect(server.identifier).toBe("survival");
      expect(server.createdAt).toBeInstanceOf(Date);
    });

    it("should reject NOT NULL violation as NotNullViolationError", async () => {
      const error = await Q.server
        .create({ name: null as any, identifier: "test" })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotNullViolationError);
      expect(error).toBeInstanceOf(ConstraintViolationError);
      expect((error as NotNullViolationError).column).toBe("name");
    });

    it("should reject UNIQUE constraint violation as UniqueViolationError", async () => {
      await Q.server.create({ name: "Survival", identifier: "survival" });

      const error = await Q.server
        .create({ name: "Other", identifier: "survival" })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(UniqueViolationError);
      expect((error as UniqueViolationError).code).toBe("23505");
    });
  });

  // ==========================================================================
  // FIND / GET / EXISTS
  // ==========================================================================

  describe("find / get / exists", () => {
    it("should find by id", async () => {
      const created = await Q.server.createAndReturn({
        name: "Survival",
        identifier: "survival",
      });

      const found = await Q.server.find({ id: created.id });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Survival");
    });

    it("should find by name", async () => {
      await Q.server.create({ name: "Creative", identifier: "creative" });

      const found = await Q.server.find({ name: "Creative" });
      expect(found).not.toBeNull();
      expect(found!.identifier).toBe("creative");
    });

    it("should find by identifier", async () => {
      await Q.server.create({ name: "Creative", identifier: "creative" });

      const found = await Q.server.find({ identifier: "creative" });
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Creative");
    });

    it("should return null for missing record", async () => {
      const found = await Q.server.find({ id: 99999 });
      expect(found).toBeNull();
    });

    it("should throw NotFoundError from get() for missing record", async () => {
      await expect(Q.server.get({ id: 99999 })).rejects.toThrow(NotFoundError);
    });

    it("should return true from exists() for existing record", async () => {
      const created = await Q.server.createAndReturn({
        name: "Survival",
        identifier: "survival",
      });

      expect(await Q.server.exists({ id: created.id })).toBe(true);
    });

    it("should return false from exists() for missing record", async () => {
      expect(await Q.server.exists({ id: 99999 })).toBe(false);
    });

    it("should support select projection in find()", async () => {
      const created = await Q.server.createAndReturn({
        name: "Survival",
        identifier: "survival",
      });

      const found = await Q.server.find(
        { id: created.id },
        { select: ["id", "name"] },
      );
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe("Survival");
    });

    it("should fall back to all columns for an empty select in find()", async () => {
      const created = await Q.server.createAndReturn({
        name: "Survival",
        identifier: "survival",
      });

      const found = await Q.server.find({ id: created.id }, { select: [] });
      expect(found).toEqual(created);
    });
  });

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  describe("update / updateAndReturn", () => {
    it("should update an existing record", async () => {
      const created = await Q.server.createAndReturn({
        name: "Survival",
        identifier: "survival",
      });

      await Q.server.update({ id: created.id }, { name: "SMP" });

      const updated = await Q.server.get({ id: created.id });
      expect(updated.name).toBe("SMP");
    });

    it("should throw NotFoundError when updating missing record", async () => {
      await expect(
        Q.server.update({ id: 99999 }, { name: "nope" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject an empty updates object", async () => {
      const created = await Q.server.createAndReturn({
        name: "Survival",
        identifier: "survival",
      });

      await expect(Q.server.update({ id: created.id }, {})).rejects.toThrow(
        "requires at least one field",
      );
      await expect(
        Q.server.updateAndReturn({ id: created.id }, {}),
      ).rejects.toThrow("requires at least one field");
    });

    it("should updateAndReturn the modified entity", async () => {
      const created = await Q.server.createAndReturn({
        name: "Survival",
        identifier: "survival",
      });

      const updated = await Q.server.updateAndReturn(
        { id: created.id },
        { name: "SMP" },
      );

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("SMP");
    });
  });

  // ==========================================================================
  // DELETE
  // ==========================================================================

  describe("delete", () => {
    it("should delete an existing record", async () => {
      const created = await Q.server.createAndReturn({
        name: "Survival",
        identifier: "survival",
      });

      await Q.server.delete({ id: created.id });

      expect(await Q.server.exists({ id: created.id })).toBe(false);
    });

    it("should throw NotFoundError when deleting missing record", async () => {
      await expect(Q.server.delete({ id: 99999 })).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should surface a referenced row as ForeignKeyViolationError", async () => {
      const created = await Q.server.createAndReturn({
        name: "Survival",
        identifier: "survival",
      });
      await Q.modpack.create({
        name: "Pack",
        createdBy: "1",
        serverId: created.id,
      });

      const error = await Q.server
        .delete({ id: created.id })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ForeignKeyViolationError);
      expect((error as ForeignKeyViolationError).code).toBe("23503");

      const bulk = await Q.server
        .deleteAll({ id: created.id })
        .catch((e: unknown) => e);
      expect(bulk).toBeInstanceOf(ForeignKeyViolationError);
    });
  });

  // ==========================================================================
  // FIND ALL / GET ALL / COUNT
  // ==========================================================================

  describe("findAll / getAll / count", () => {
    beforeEach(async () => {
      await Q.server.create({ name: "Alpha", identifier: "alpha" });
      await Q.server.create({ name: "Beta", identifier: "beta" });
      await Q.server.create({ name: "Gamma", identifier: "gamma" });
    });

    it("should return all records with findAll()", async () => {
      const all = await Q.server.findAll();
      expect(all).toHaveLength(3);
    });

    it("should return all records with getAll()", async () => {
      const all = await Q.server.getAll();
      expect(all).toHaveLength(3);
    });

    it("should filter with findAll()", async () => {
      const results = await Q.server.findAll({ name: "Alpha" });
      expect(results).toHaveLength(1);
      expect(results[0].identifier).toBe("alpha");
    });

    it("should support orderBy", async () => {
      const results = await Q.server.findAll(undefined, {
        orderBy: "name",
        orderDirection: "desc",
      });

      expect(results[0].name).toBe("Gamma");
      expect(results[2].name).toBe("Alpha");
    });

    it("should support limit", async () => {
      const results = await Q.server.findAll(undefined, { limit: 2 });
      expect(results).toHaveLength(2);
    });

    it("should return no rows for limit: 0", async () => {
      expect(await Q.server.findAll(undefined, { limit: 0 })).toHaveLength(0);
      expect(await Q.server.paginate(0, 0).all()).toHaveLength(0);
    });

    it("should reject negative or non-integer limit and offset", async () => {
      await expect(Q.server.findAll(undefined, { limit: -1 })).rejects.toThrow(
        "limit must be a non-negative integer",
      );
      await expect(
        Q.server.findAll(undefined, { limit: Number.NaN }),
      ).rejects.toThrow("limit must be a non-negative integer");
      await expect(
        Q.server.findAll(undefined, { offset: 1.5 }),
      ).rejects.toThrow("offset must be a non-negative integer");
    });

    it("should accept offset: 0", async () => {
      expect(await Q.server.findAll(undefined, { offset: 0 })).toHaveLength(3);
    });

    it("should support offset", async () => {
      const results = await Q.server.findAll(undefined, {
        orderBy: "name",
        orderDirection: "asc",
        limit: 1,
        offset: 1,
      });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Beta");
    });

    it("should support select projection", async () => {
      const results = await Q.server.findAll(undefined, {
        select: ["name"],
      });
      expect(results).toHaveLength(3);
      // Only selected fields should be present after mapping
      results.forEach((r) => {
        expect(r).toHaveProperty("name");
      });
    });

    it("should fall back to all columns for an empty select in findAll()", async () => {
      const results = await Q.server.findAll(undefined, { select: [] });
      expect(results).toHaveLength(3);
      results.forEach((r) => {
        expect(r).toHaveProperty("id");
        expect(r).toHaveProperty("name");
        expect(r).toHaveProperty("identifier");
        expect(r).toHaveProperty("createdAt");
      });
    });

    it("should count all records", async () => {
      expect(await Q.server.count()).toBe(3);
    });

    it("should count with filters", async () => {
      expect(await Q.server.count({ name: "Alpha" })).toBe(1);
    });
  });

  // ==========================================================================
  // PLUCK
  // ==========================================================================

  describe("pluck", () => {
    it("should return a single field value", async () => {
      const created = await Q.server.createAndReturn({
        name: "Survival",
        identifier: "survival",
      });

      const name = await Q.server.pluck({ id: created.id }, "name");
      expect(name).toBe("Survival");
    });

    it("should throw NotFoundError for missing record", async () => {
      await expect(Q.server.pluck({ id: 99999 }, "name")).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  // ==========================================================================
  // UPSERT
  // ==========================================================================

  describe("upsert", () => {
    it("should insert when no conflict", async () => {
      const result = await Q.server.upsert(
        { name: "Survival", identifier: "survival" },
        "identifier",
      );

      expect(result.name).toBe("Survival");
      expect(await Q.server.count()).toBe(1);
    });

    it("should update on conflict", async () => {
      await Q.server.create({ name: "Survival", identifier: "survival" });

      const result = await Q.server.upsert(
        { name: "SMP", identifier: "survival" },
        "identifier",
        ["name"],
      );

      expect(result.name).toBe("SMP");
      expect(result.identifier).toBe("survival");
      expect(await Q.server.count()).toBe(1);
    });
  });

  // ==========================================================================
  // DELETE ALL / UPDATE ALL
  // ==========================================================================

  describe("deleteAll / updateAll", () => {
    beforeEach(async () => {
      await Q.server.create({ name: "Alpha", identifier: "alpha" });
      await Q.server.create({ name: "Beta", identifier: "beta" });
      await Q.server.create({ name: "Gamma", identifier: "gamma" });
    });

    it("should deleteAll matching a filter", async () => {
      const deleted = await Q.server.deleteAll({ name: "Alpha" });
      expect(deleted).toBe(1);
      expect(await Q.server.count()).toBe(2);
    });

    it("should throw when deleteAll called with empty filters", async () => {
      await expect(Q.server.deleteAll({})).rejects.toThrow();
    });

    it("should throw when every deleteAll filter value is undefined", async () => {
      await expect(
        Q.server.deleteAll({ name: undefined, identifier: undefined }),
      ).rejects.toThrow("requires at least one usable filter");
      expect(await Q.server.count()).toBe(3);
    });

    it("should throw when every updateAll filter value is undefined", async () => {
      await expect(
        Q.server.updateAll({ name: "Renamed" }, { name: undefined }),
      ).rejects.toThrow("no usable conditions");
      expect(await Q.server.count({ name: "Renamed" })).toBe(0);
    });

    it("should updateAll matching a filter", async () => {
      const updated = await Q.server.updateAll(
        { name: "Updated" },
        { name: "Alpha" },
      );
      expect(updated).toBe(1);

      const result = await Q.server.find({ identifier: "alpha" });
      expect(result!.name).toBe("Updated");
    });

    it("should updateAll without filter (all rows)", async () => {
      const date = new Date("2020-01-01T00:00:00Z");
      const updated = await Q.server.updateAll({ createdAt: date });
      expect(updated).toBe(3);
    });
  });

  // ==========================================================================
  // TRUNCATE / DROP
  // ==========================================================================

  describe("truncate / drop", () => {
    beforeEach(async () => {
      await Q.server.create({ name: "Alpha", identifier: "alpha" });
      await Q.server.create({ name: "Beta", identifier: "beta" });
    });

    it("should truncate all records", async () => {
      await Q.server.truncate({ restartIdentity: true, cascade: true });
      expect(await Q.server.count()).toBe(0);
    });

    it("should drop all records and return count", async () => {
      const dropped = await Q.server.drop();
      expect(dropped).toBe(2);
      expect(await Q.server.count()).toBe(0);
    });
  });
});
