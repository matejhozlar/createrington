import { describe, it, expect } from "vitest";
import type { Pool } from "pg";
import { BaseQueries } from "@/db/queries/base.queries";

type TestConfig = {
  Entity: Record<string, unknown>;
  DbEntity: Record<string, unknown>;
  Update: Record<string, unknown>;
  Create: Record<string, unknown>;
};

class SummaryQueries extends BaseQueries<TestConfig> {
  protected readonly table = "player_playtime_summary";
  protected readonly GENERATED_FIELDS = ["avgSessionSeconds"];

  updateMapping(updates: Record<string, unknown>) {
    return this.getUpdateMapping(updates);
  }

  createMapping(data: Record<string, unknown>) {
    return this.getCreateMapping(data);
  }
}

class PlainQueries extends BaseQueries<TestConfig> {
  protected readonly table = "player";

  updateMapping(updates: Record<string, unknown>) {
    return this.getUpdateMapping(updates);
  }
}

const db = {} as Pool;
const summary = new SummaryQueries(db);
const plain = new PlainQueries(db);

describe("GENERATED_FIELDS", () => {
  it("drops generated fields from update payloads", () => {
    expect(
      summary.updateMapping({ totalSeconds: 10n, avgSessionSeconds: 5n }),
    ).toEqual([{ column: "total_seconds", value: 10n }]);
  });

  it("drops generated fields from create payloads", () => {
    expect(
      summary.createMapping({
        playerMinecraftUuid: "uuid-1",
        avgSessionSeconds: 5n,
      }),
    ).toEqual([{ column: "player_minecraft_uuid", value: "uuid-1" }]);
  });

  it("rejects an update that only sets generated fields", () => {
    expect(() => summary.updateMapping({ avgSessionSeconds: 5n })).toThrow(
      /requires at least one field/,
    );
  });

  it("leaves payloads untouched when the table declares no generated fields", () => {
    expect(plain.updateMapping({ avgSessionSeconds: 5n })).toEqual([
      { column: "avg_session_seconds", value: 5n },
    ]);
  });
});
