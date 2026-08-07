import { describe, it, expect } from "vitest";
import type { Pool } from "pg";
import { BaseQueries } from "@/db/queries/base.queries";

interface TestEntity {
  id: number;
  tags: string[];
  name: string;
  [key: string]: unknown;
}

class TestQueries extends BaseQueries<{
  Entity: TestEntity;
  DbEntity: TestEntity;
  Create: TestEntity;
  Update: Partial<TestEntity>;
}> {
  protected readonly table = "test_table";

  mapCreate(data: TestEntity) {
    return this.getCreateMapping(data);
  }

  mapUpdate(data: Partial<TestEntity>) {
    return this.getUpdateMapping(data);
  }
}

const q = new TestQueries({} as unknown as Pool);

// Pins the write-serialization contract: every array value is JSON.stringified,
// which is only correct while arrays are exclusively written to jsonb columns.
// If a native array column (e.g. text[]) is ever added, serializeWriteValue
// must be scoped per column and this test updated.
describe("BaseQueries write serialization", () => {
  it("JSON.stringifies array values on create", () => {
    const mapping = q.mapCreate({ id: 1, tags: ["a", "b"], name: "x" });
    expect(mapping).toContainEqual({
      column: "tags",
      value: JSON.stringify(["a", "b"]),
    });
    expect(mapping).toContainEqual({ column: "id", value: 1 });
    expect(mapping).toContainEqual({ column: "name", value: "x" });
  });

  it("JSON.stringifies array values on update", () => {
    const mapping = q.mapUpdate({ tags: [] });
    expect(mapping).toContainEqual({ column: "tags", value: "[]" });
  });

  it("leaves non-array values untouched", () => {
    const date = new Date();
    const mapping = q.mapUpdate({ name: "y", createdAt: date, deleted: null });
    expect(mapping).toContainEqual({ column: "name", value: "y" });
    expect(mapping).toContainEqual({ column: "created_at", value: date });
    expect(mapping).toContainEqual({ column: "deleted", value: null });
  });
});
