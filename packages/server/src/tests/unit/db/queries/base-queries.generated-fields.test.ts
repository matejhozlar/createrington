import { describe, it, expect, vi } from "vitest";
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

function fakeDb() {
  const query = vi.fn().mockResolvedValue({ rows: [{}], rowCount: 1 });
  return { db: { query } as unknown as Pool, query };
}

const summary = new SummaryQueries({} as Pool);
const plain = new PlainQueries({} as Pool);

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

  it("rejects a create that only sets generated fields", () => {
    expect(() => summary.createMapping({ avgSessionSeconds: 5n })).toThrow(
      /requires at least one field/,
    );
  });

  it("keeps generated fields out of the upsert update clause", async () => {
    const { db, query } = fakeDb();

    await new SummaryQueries(db).upsert(
      { playerMinecraftUuid: "uuid-1", totalSeconds: 10n },
      "playerMinecraftUuid",
      ["totalSeconds", "avgSessionSeconds"],
    );

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toMatch(
      /DO UPDATE SET total_seconds = EXCLUDED\.total_seconds\s+RETURNING \*/,
    );
  });

  it("rejects upsert update fields that are all generated", async () => {
    const { db } = fakeDb();

    await expect(
      new SummaryQueries(db).upsert(
        { playerMinecraftUuid: "uuid-1" },
        "playerMinecraftUuid",
        ["avgSessionSeconds"],
      ),
    ).rejects.toThrow(/requires at least one field in updateFields/);
  });

  it("leaves payloads untouched when the table declares no generated fields", () => {
    expect(plain.updateMapping({ avgSessionSeconds: 5n })).toEqual([
      { column: "avg_session_seconds", value: 5n },
    ]);
  });
});
