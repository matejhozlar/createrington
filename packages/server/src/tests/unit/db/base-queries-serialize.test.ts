import { describe, it, expect } from "vitest";
import type { Pool } from "pg";
import { BaseQueries } from "@/db/queries/base.queries";

interface TestEntity {
  id: number;
  categories: string[];
  screenshots: string[];
  name: string;
  [key: string]: unknown;
}

class CurseforgeProjectTestQueries extends BaseQueries<{
  Entity: TestEntity;
  DbEntity: TestEntity;
  Create: TestEntity;
  Update: Partial<TestEntity>;
}> {
  protected readonly table = "curseforge_project";

  mapCreate(data: TestEntity) {
    return this.getCreateMapping(data);
  }

  mapUpdate(data: Partial<TestEntity>) {
    return this.getUpdateMapping(data);
  }
}

class UnknownTableQueries extends BaseQueries<{
  Entity: TestEntity;
  DbEntity: TestEntity;
  Create: TestEntity;
  Update: Partial<TestEntity>;
}> {
  protected readonly table = "test_table";

  mapUpdate(data: Partial<TestEntity>) {
    return this.getUpdateMapping(data);
  }
}

const q = new CurseforgeProjectTestQueries({} as unknown as Pool);
const unknown = new UnknownTableQueries({} as unknown as Pool);

// Pins the write-serialization contract: array values are JSON.stringified
// only for columns the Drizzle schema declares as json/jsonb (node-postgres
// would otherwise send them as Postgres array literals, invalid for jsonb).
// Arrays headed to any other column pass through untouched, so a future
// native array column (e.g. text[]) keeps node-postgres serialization.
describe("BaseQueries write serialization", () => {
  it("JSON.stringifies array values for jsonb columns on create", () => {
    const mapping = q.mapCreate({
      id: 1,
      categories: ["a", "b"],
      screenshots: [],
      name: "x",
    });
    expect(mapping).toContainEqual({
      column: "categories",
      value: JSON.stringify(["a", "b"]),
    });
    expect(mapping).toContainEqual({ column: "screenshots", value: "[]" });
    expect(mapping).toContainEqual({ column: "id", value: 1 });
    expect(mapping).toContainEqual({ column: "name", value: "x" });
  });

  it("JSON.stringifies array values for jsonb columns on update", () => {
    const mapping = q.mapUpdate({ categories: [] });
    expect(mapping).toContainEqual({ column: "categories", value: "[]" });
  });

  it("passes arrays through untouched for non-json columns", () => {
    const tags = ["a", "b"];
    const mapping = q.mapUpdate({ name: tags as unknown as string });
    expect(mapping).toContainEqual({ column: "name", value: tags });
  });

  it("passes arrays through untouched for tables not in the schema", () => {
    const tags = ["a", "b"];
    const mapping = unknown.mapUpdate({ categories: tags });
    expect(mapping).toContainEqual({ column: "categories", value: tags });
  });

  it("leaves non-array values untouched", () => {
    const date = new Date();
    const mapping = q.mapUpdate({ name: "y", createdAt: date, deleted: null });
    expect(mapping).toContainEqual({ column: "name", value: "y" });
    expect(mapping).toContainEqual({ column: "created_at", value: date });
    expect(mapping).toContainEqual({ column: "deleted", value: null });
  });
});
