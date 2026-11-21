import { describe, it } from "vitest";
import type { QueryInstances } from "@/generated/db/queries";

declare const Q: QueryInstances;

const actor = { adminDiscordId: "1", adminUsername: "Admin" };

describe("audit writes only accept a known action type", () => {
  it("accepts a known action type on every write path", async () => {
    await Q.admin.log.action.logAction({
      ...actor,
      actionType: "unban_player",
    });
    await Q.admin.log.action.create({ ...actor, actionType: "unban_player" });
    await Q.admin.log.action.createAndReturn({
      ...actor,
      actionType: "delete_player",
    });
    await Q.admin.log.action.createMany([
      { ...actor, actionType: "workshop_mod_approve" },
    ]);
  });

  it("rejects a misspelled action type on every write path", async () => {
    await Q.admin.log.action.logAction({
      ...actor,
      // @ts-expect-error not a known action type
      actionType: "ban_player_temprary",
    });
    await Q.admin.log.action.create({
      ...actor,
      // @ts-expect-error not a known action type
      actionType: "ban_player_temprary",
    });
    await Q.admin.log.action.createAndReturn({
      ...actor,
      // @ts-expect-error not a known action type
      actionType: "ban_player_temprary",
    });
    await Q.admin.log.action.createManyAndReturn([
      // @ts-expect-error not a known action type
      { ...actor, actionType: "ban_player_temprary" },
    ]);
  });
});
