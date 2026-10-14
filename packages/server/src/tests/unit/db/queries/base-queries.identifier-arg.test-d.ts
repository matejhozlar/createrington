import { describe, expectTypeOf, it } from "vitest";
import type { QueryInstances } from "@/generated/db/queries";
import type {
  Player,
  PlayerIdentifier,
} from "@createrington/shared/db/player.types";
import type { PlayerBalance } from "@createrington/shared/db/player_balance.types";

declare const Q: QueryInstances;
declare const player: Player;
declare const balance: PlayerBalance;
declare const parsed: PlayerIdentifier;
declare const uuid: string;

describe("single-row methods accept identifiers and same-table entities", () => {
  it("accepts an identifier literal and the identifier union", async () => {
    expectTypeOf(
      await Q.player.find({ minecraftUuid: uuid }),
    ).toEqualTypeOf<Player | null>();
    expectTypeOf(await Q.player.get(parsed)).toEqualTypeOf<Player>();
    expectTypeOf(
      await Q.player.exists({ discordId: "1" }),
    ).toEqualTypeOf<boolean>();
  });

  it("accepts a full entity of the same table", async () => {
    expectTypeOf(await Q.player.find(player)).toEqualTypeOf<Player | null>();
    await Q.player.update(player, { online: true });
    await Q.player.delete(player);
    expectTypeOf(
      await Q.player.balance.get(balance),
    ).toEqualTypeOf<PlayerBalance>();
  });

  it("accepts a projection made of identifier fields only", async () => {
    const projected: Pick<Player, "id" | "minecraftUsername"> = player;
    expectTypeOf(await Q.player.find(projected)).toEqualTypeOf<Player | null>();
  });

  it("keeps select narrowing with the identifier generic", async () => {
    const found = await Q.player.find(player, { select: ["minecraftUuid"] });
    expectTypeOf(found).toEqualTypeOf<Pick<Player, "minecraftUuid"> | null>();
  });
});

describe("single-row methods reject stray keys", () => {
  it("rejects an object literal with a non-identifier key", async () => {
    // @ts-expect-error online is not an identifier field
    await Q.player.find({ minecraftUuid: uuid, online: true });
  });

  it("rejects a variable with a non-identifier key", async () => {
    const filter = { minecraftUuid: uuid, online: true };
    // @ts-expect-error online is not an identifier field
    await Q.player.find(filter);
    // @ts-expect-error online is not an identifier field
    await Q.player.update(filter, { online: false });
  });

  it("rejects a union whose members do not all consist of identifier fields", async () => {
    const byUuid = uuid.length > 0;
    const id = byUuid
      ? { minecraftUuid: uuid }
      : { discordId: "1", online: true };
    // @ts-expect-error online is not an identifier field in the second member
    await Q.player.find(id);
  });

  it("accepts a union whose members each consist of identifier fields", async () => {
    const byUuid = uuid.length > 0;
    const id = byUuid ? { minecraftUuid: uuid } : { discordId: "1" };
    expectTypeOf(await Q.player.find(id)).toEqualTypeOf<Player | null>();
    const withRow = byUuid ? { minecraftUuid: uuid } : player;
    expectTypeOf(await Q.player.get(withRow)).toEqualTypeOf<Player>();
  });

  it("rejects a row of another table", async () => {
    // @ts-expect-error a player row is not a player_balance entity
    await Q.player.balance.get(player);
    // @ts-expect-error a player row is not a player_balance entity
    await Q.player.balance.select.balance(player);
  });

  it("rejects a projection that carries a non-identifier column", async () => {
    const projected: Pick<Player, "id" | "online"> = player;
    // @ts-expect-error online is not an identifier field
    await Q.player.delete(projected);
  });
});
