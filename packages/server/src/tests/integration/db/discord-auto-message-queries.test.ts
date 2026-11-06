import { describe, it, expect, afterAll } from "vitest";
import { Q } from "@/db";

const CHANNEL = "779500000000000001";

afterAll(async () => {
  await Q.discord.auto.message.config.deleteAll({ channelId: CHANNEL });
});

describe("Q.discord.auto.message.reorder", () => {
  it("updates the matched rows in one statement and reports how many matched", async () => {
    const config = await Q.discord.auto.message.config.createAndReturn({
      channelId: CHANNEL,
      name: "vitest reorder",
    });
    const [first, second] = await Q.discord.auto.message.createManyAndReturn([
      { configId: config.id, content: "first", sortOrder: 0 },
      { configId: config.id, content: "second", sortOrder: 1 },
    ]);

    const matched = await Q.discord.auto.message.reorder([
      { id: first.id, sortOrder: 1 },
      { id: second.id, sortOrder: 0 },
      { id: 2_147_000_000, sortOrder: 2 },
    ]);

    expect(matched).toBe(2);
    expect((await Q.discord.auto.message.get({ id: first.id })).sortOrder).toBe(
      1,
    );
    expect(
      (await Q.discord.auto.message.get({ id: second.id })).sortOrder,
    ).toBe(0);
    expect(await Q.discord.auto.message.reorder([])).toBe(0);
  });
});
