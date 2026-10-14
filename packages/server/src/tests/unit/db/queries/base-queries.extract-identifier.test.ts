import { describe, it, expect } from "vitest";
import type { Pool } from "pg";
import { BaseQueries } from "@/db/queries/base.queries";

type TestConfig = {
  Entity: Record<string, unknown>;
  DbEntity: Record<string, unknown>;
  Identifier: Record<string, unknown>;
};

class CompositeQueries extends BaseQueries<TestConfig> {
  protected readonly table = "reward_claim";
  protected readonly IDENTIFIER_GROUPS = [
    ["id"],
    ["playerMinecraftUuid", "rewardType", "claimPeriodKey"],
  ];
  protected readonly COLUMNS = [
    "id",
    "playerMinecraftUuid",
    "rewardType",
    "claimPeriodKey",
    "amount",
    "claimedAt",
  ];

  extract(obj: Record<string, unknown>) {
    return this.extractIdentifier(obj);
  }
}

class NoColumnsQueries extends BaseQueries<TestConfig> {
  protected readonly table = "legacy_grouped_table";
  protected readonly IDENTIFIER_GROUPS = [["id"]];

  extract(obj: Record<string, unknown>) {
    return this.extractIdentifier(obj);
  }
}

class NoMetadataQueries extends BaseQueries<TestConfig> {
  protected readonly table = "legacy_table";

  extract(obj: Record<string, unknown>) {
    return this.extractIdentifier(obj);
  }
}

const db = {} as Pool;
const composite = new CompositeQueries(db);
const noColumns = new NoColumnsQueries(db);
const noMetadata = new NoMetadataQueries(db);

describe("extractIdentifier with identifier groups", () => {
  it("accepts a single-field group", () => {
    expect(composite.extract({ id: 1 })).toEqual({ id: 1 });
  });

  it("keeps all fields of a complete composite group", () => {
    expect(
      composite.extract({
        playerMinecraftUuid: "uuid-1",
        rewardType: "daily",
        claimPeriodKey: "2026-07-19",
      }),
    ).toEqual({
      playerMinecraftUuid: "uuid-1",
      rewardType: "daily",
      claimPeriodKey: "2026-07-19",
    });
  });

  it("rejects a single column of a composite group", () => {
    expect(() => composite.extract({ rewardType: "daily" })).toThrow(
      /do not form a complete identifier/,
    );
  });

  it("rejects a partial composite group", () => {
    expect(() =>
      composite.extract({ playerMinecraftUuid: "uuid-1", rewardType: "daily" }),
    ).toThrow(/do not form a complete identifier/);
  });

  it("lists composite groups in the error message", () => {
    expect(() => composite.extract({ rewardType: "daily" })).toThrow(
      /\(playerMinecraftUuid \+ rewardType \+ claimPeriodKey\)/,
    );
  });

  it("keeps all identifier fields and drops the rest from a full entity", () => {
    expect(
      composite.extract({
        id: 7,
        playerMinecraftUuid: "uuid-1",
        rewardType: "daily",
        claimPeriodKey: "2026-07-19",
        amount: 100n,
        claimedAt: new Date(0),
      }),
    ).toEqual({
      id: 7,
      playerMinecraftUuid: "uuid-1",
      rewardType: "daily",
      claimPeriodKey: "2026-07-19",
    });
  });

  it("ignores identifier fields with null or undefined values", () => {
    expect(
      composite.extract({
        id: null,
        playerMinecraftUuid: "uuid-1",
        rewardType: "daily",
        claimPeriodKey: "2026-07-19",
      }),
    ).toEqual({
      playerMinecraftUuid: "uuid-1",
      rewardType: "daily",
      claimPeriodKey: "2026-07-19",
    });
  });

  it("throws when nulls leave no complete group", () => {
    expect(() =>
      composite.extract({
        id: null,
        playerMinecraftUuid: "uuid-1",
        rewardType: "daily",
        claimPeriodKey: undefined,
      }),
    ).toThrow(/do not form a complete identifier/);
  });

  it("throws when only unknown fields are provided", () => {
    expect(() => composite.extract({ amount: 100n })).toThrow(
      /No valid identifier field found/,
    );
  });

  it("throws on an empty object", () => {
    expect(() => composite.extract({})).toThrow(
      /No valid identifier field found/,
    );
  });
});

describe("extractIdentifier with stray non-identifier keys", () => {
  it("rejects an identifier carrying a condition on another column", () => {
    expect(() => composite.extract({ id: 7, amount: 100n })).toThrow(
      /non-identifier field\(s\) \(amount\)/,
    );
  });

  it("names every stray key and the accepted identifiers", () => {
    const stray = () =>
      composite.extract({ id: 7, amount: 100n, claimedAt: new Date(0) });
    expect(stray).toThrow(/\(amount, claimedAt\)/);
    expect(stray).toThrow(
      /pass only: id, \(playerMinecraftUuid \+ rewardType \+ claimPeriodKey\)/,
    );
  });

  it("rejects an identifier carrying a key that is not a column at all", () => {
    expect(() => composite.extract({ id: 7, enabled: true })).toThrow(
      /non-identifier field\(s\) \(enabled\)/,
    );
  });

  it("ignores stray keys whose value is null or undefined", () => {
    expect(
      composite.extract({ id: 7, amount: undefined, claimedAt: null }),
    ).toEqual({ id: 7 });
  });

  it("still narrows a full entity whose non-identifier columns are null", () => {
    expect(
      composite.extract({
        id: 7,
        playerMinecraftUuid: "uuid-1",
        rewardType: "daily",
        claimPeriodKey: "2026-07-19",
        amount: null,
        claimedAt: new Date(0),
      }),
    ).toEqual({
      id: 7,
      playerMinecraftUuid: "uuid-1",
      rewardType: "daily",
      claimPeriodKey: "2026-07-19",
    });
  });

  it("rejects a projected row that lacks some columns but carries a stray one", () => {
    expect(() =>
      composite.extract({ id: 7, playerMinecraftUuid: "uuid-1", amount: 100n }),
    ).toThrow(/non-identifier field\(s\) \(amount\)/);
  });

  it("rejects stray keys when the class declares no column list", () => {
    expect(() => noColumns.extract({ id: 1, name: "x" })).toThrow(
      /non-identifier field\(s\) \(name\)/,
    );
    expect(noColumns.extract({ id: 1 })).toEqual({ id: 1 });
  });
});

describe("extractIdentifier without identifier groups", () => {
  it("keeps all provided non-null fields", () => {
    expect(noMetadata.extract({ a: 1, b: "x", c: null })).toEqual({
      a: 1,
      b: "x",
    });
  });

  it("throws when no non-null fields are provided", () => {
    expect(() => noMetadata.extract({ a: null })).toThrow(
      /No valid identifier field found/,
    );
  });
});
