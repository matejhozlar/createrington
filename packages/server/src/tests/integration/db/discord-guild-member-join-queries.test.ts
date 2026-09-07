import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Q } from "@/db";
import {
  getTestPool,
  truncateTable,
  cleanupTestPool,
} from "@/tests/helpers/db";

const ALICE = "100000000000000001";
const BOB = "100000000000000002";
const CAROL = "100000000000000003";

const join = () => Q.discord.guild.member.join;

beforeAll(async () => {
  await getTestPool().query("SELECT 1");
});

beforeEach(async () => {
  await truncateTable("discord_guild_member_join");
});

afterAll(async () => {
  await cleanupTestPool();
});

describe("Q.discord.guild.member.join.recordJoin", () => {
  it("assigns sequential join numbers to new members", async () => {
    expect(await join().recordJoin(ALICE, "alice")).toBe(1);
    expect(await join().recordJoin(BOB, "bob")).toBe(2);
    expect(await join().recordJoin(CAROL, "carol")).toBe(3);
  });

  it("returns the existing join number and keeps the original row for a known member", async () => {
    await join().recordJoin(ALICE, "alice");

    expect(await join().recordJoin(ALICE, "alice-renamed")).toBe(1);

    const row = await join().find({ userId: ALICE });
    expect(row?.username).toBe("alice");
    expect(await join().count()).toBe(1);
  });

  it("does not consume a sequence value when re-recording a known member", async () => {
    await join().recordJoin(ALICE, "alice");
    await join().recordJoin(ALICE, "alice");
    await join().recordJoin(ALICE, "alice");

    expect(await join().recordJoin(BOB, "bob")).toBe(2);

    await join().recordJoin(BOB, "bob");
    await join().recordJoin(ALICE, "alice");

    expect(await join().recordJoin(CAROL, "carol")).toBe(3);
  });
});
