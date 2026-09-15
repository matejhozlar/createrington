import { describe, expectTypeOf, it } from "vitest";
import type { QueryInstances } from "@/generated/db/queries";
import type { Player } from "@createrington/shared/db/player.types";

declare const Q: QueryInstances;

type Projected = Pick<Player, "minecraftUuid" | "minecraftUsername">;

describe("BaseQueries select projection types", () => {
  it("narrows find / get to the selected keys", async () => {
    const found = await Q.player.find(
      { id: 1 },
      { select: ["minecraftUuid", "minecraftUsername"] },
    );
    expectTypeOf(found).toEqualTypeOf<Projected | null>();
    // @ts-expect-error discordId was not selected
    found!.discordId;

    const got = await Q.player.get(
      { id: 1 },
      { select: ["minecraftUuid", "minecraftUsername"] },
    );
    expectTypeOf(got).toEqualTypeOf<Projected>();
    // @ts-expect-error discordId was not selected
    got.discordId;
  });

  it("narrows findAll / getAll to the selected keys", async () => {
    const filtered = await Q.player.findAll(
      { online: true },
      { select: ["minecraftUuid", "minecraftUsername"] },
    );
    expectTypeOf(filtered).toEqualTypeOf<Projected[]>();
    // @ts-expect-error discordId was not selected
    filtered[0]!.discordId;

    const unfiltered = await Q.player.findAll(undefined, {
      select: ["minecraftUuid", "minecraftUsername"],
      orderBy: "id",
      orderDirection: "desc",
      limit: 5,
    });
    expectTypeOf(unfiltered).toEqualTypeOf<Projected[]>();

    const all = await Q.player.getAll({
      select: ["minecraftUuid", "minecraftUsername"],
      orderBy: "id",
    });
    expectTypeOf(all).toEqualTypeOf<Projected[]>();
    // @ts-expect-error discordId was not selected
    all[0]!.discordId;
  });

  it("returns the full entity when select is omitted", async () => {
    expectTypeOf(await Q.player.find({ id: 1 })).toEqualTypeOf<Player | null>();
    expectTypeOf(await Q.player.get({ id: 1 })).toEqualTypeOf<Player>();
    expectTypeOf(await Q.player.findAll()).toEqualTypeOf<Player[]>();
    expectTypeOf(
      await Q.player.findAll({ online: true }, { limit: 1 }),
    ).toEqualTypeOf<Player[]>();
    expectTypeOf(await Q.player.getAll()).toEqualTypeOf<Player[]>();
    expectTypeOf(await Q.player.getAll({ orderBy: "id" })).toEqualTypeOf<
      Player[]
    >();
  });

  it("returns the full entity for a widened select array", async () => {
    const fields: Array<keyof Player> = ["minecraftUuid"];
    expectTypeOf(
      await Q.player.find({ id: 1 }, { select: fields }),
    ).toEqualTypeOf<Player | null>();
    expectTypeOf(
      await Q.player.get({ id: 1 }, { select: fields }),
    ).toEqualTypeOf<Player>();
    expectTypeOf(await Q.player.findAll({}, { select: fields })).toEqualTypeOf<
      Player[]
    >();
    expectTypeOf(await Q.player.getAll({ select: fields })).toEqualTypeOf<
      Player[]
    >();
    expectTypeOf(await Q.player.selectFields(fields).all()).toEqualTypeOf<
      Player[]
    >();
    expectTypeOf(
      await Q.player.where({}).select(fields).first(),
    ).toEqualTypeOf<Player | null>();
  });

  it("rejects keys that are not columns", () => {
    // @ts-expect-error notAColumn is not a Player key
    void Q.player.findAll({}, { select: ["notAColumn"] });
    // @ts-expect-error notAColumn is not a Player key
    void Q.player.getAll({ select: ["notAColumn"] });
    // @ts-expect-error notAColumn is not a Player key
    void Q.player.where({}).select(["notAColumn"]);
    // @ts-expect-error notAColumn is not a Player key
    void Q.player.selectFields(["notAColumn"]);
  });

  it("narrows the query builder through select()", async () => {
    const rows = await Q.player
      .where({ online: true })
      .select(["minecraftUuid", "minecraftUsername"])
      .orderBy("id", "desc")
      .limit(5)
      .all();
    expectTypeOf(rows).toEqualTypeOf<Projected[]>();
    // @ts-expect-error discordId was not selected
    rows[0]!.discordId;

    const first = await Q.player
      .selectFields(["minecraftUuid"])
      .where({ online: true })
      .first();
    expectTypeOf(first).toEqualTypeOf<Pick<Player, "minecraftUuid"> | null>();
    // @ts-expect-error discordId was not selected
    first!.discordId;

    const firstOrFail = await Q.player
      .orderBy("id")
      .select(["minecraftUuid"])
      .firstOrFail();
    expectTypeOf(firstOrFail).toEqualTypeOf<Pick<Player, "minecraftUuid">>();
  });

  it("keeps the full entity on builder chains without select()", async () => {
    expectTypeOf(
      await Q.player.where({ online: true }).limit(1).all(),
    ).toEqualTypeOf<Player[]>();
    expectTypeOf(
      await Q.player.orderBy("id").first(),
    ).toEqualTypeOf<Player | null>();
    expectTypeOf(await Q.player.limit(1).firstOrFail()).toEqualTypeOf<Player>();
    expectTypeOf(await Q.player.offset(1).all()).toEqualTypeOf<Player[]>();
    expectTypeOf(await Q.player.paginate(0, 10).all()).toEqualTypeOf<
      Player[]
    >();
  });
});
