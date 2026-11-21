import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import { BaseQueries } from "@/db/queries/base.queries";
import type { Granularity } from "@/db/utils";

type TestConfig = {
  Entity: { id: number; joinedAt: Date };
  DbEntity: { id: number; joined_at: Date };
  Update: Record<string, unknown>;
  Create: Record<string, unknown>;
};

class JoinQueries extends BaseQueries<TestConfig> {
  protected readonly table = "discord_guild_member_join";

  joinsByPeriod<T extends object>(
    aggregates: { [K in keyof T]: string },
    granularity: Granularity,
    where?: string,
  ) {
    return this.aggregateByPeriod<T>(
      "get joins by period",
      "joinedAt",
      aggregates,
      START,
      END,
      granularity,
      where,
    );
  }
}

const START = new Date("2026-11-01T00:00:00Z");
const END = new Date("2026-11-08T00:00:00Z");

function queriesReturning(rows: unknown[]) {
  const query = vi.fn().mockResolvedValue({ rows, rowCount: rows.length });
  return { queries: new JoinQueries({ query } as unknown as Pool), query };
}

describe("aggregateByPeriod", () => {
  it("buckets the resolved column and binds start, end and granularity as $1..$3", async () => {
    const { queries, query } = queriesReturning([]);

    await queries.joinsByPeriod<{ count: number }>(
      { count: "COUNT(*)::int" },
      "week",
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain(
      "SELECT DATE_TRUNC($3, joined_at)::text AS period, COUNT(*)::int AS count",
    );
    expect(sql).toContain("FROM discord_guild_member_join");
    expect(sql).toContain("WHERE joined_at >= $1 AND joined_at < $2 AND TRUE");
    expect(params).toEqual([START, END, "week"]);
  });

  it("appends the extra predicate to the range filter", async () => {
    const { queries, query } = queriesReturning([]);

    await queries.joinsByPeriod<{ count: number }>(
      { count: "COUNT(*)::int" },
      "day",
      "deleted_at IS NULL",
    );

    expect(query.mock.calls[0][0]).toContain(
      "WHERE joined_at >= $1 AND joined_at < $2 AND deleted_at IS NULL",
    );
  });

  it("selects every aggregate under its name and maps the rows to camelCase", async () => {
    const { queries, query } = queriesReturning([
      { period: "2026-11-02 00:00:00+00", unique_players: 4, total: 9 },
    ]);

    const rows = await queries.joinsByPeriod<{
      unique_players: number;
      total: number;
    }>(
      {
        unique_players: "COUNT(DISTINCT user_id)::int",
        total: "COUNT(*)::int",
      },
      "day",
    );

    expect(query.mock.calls[0][0]).toContain(
      "COUNT(DISTINCT user_id)::int AS unique_players, COUNT(*)::int AS total",
    );
    expect(rows).toEqual([
      { period: "2026-11-02 00:00:00+00", uniquePlayers: 4, total: 9 },
    ]);
  });

  it("rejects an aggregate name that is not a snake_case alias", async () => {
    const { queries } = queriesReturning([]);

    await expect(
      queries.joinsByPeriod<{ uniquePlayers: number }>(
        { uniquePlayers: "COUNT(DISTINCT user_id)::int" },
        "day",
      ),
    ).rejects.toThrow(/Invalid aggregate name "uniquePlayers"/);
  });
});
