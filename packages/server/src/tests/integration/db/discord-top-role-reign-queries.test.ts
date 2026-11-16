import { describe, it, expect, afterEach } from "vitest";
import { Q } from "@/db";
import { UniqueViolationError } from "@/db/utils/errors";

const ROLE_A = "reign_test_role_a";
const ROLE_B = "reign_test_role_b";
const ALICE = "eeeeeeee-0000-4000-8000-000000000001";
const BOB = "eeeeeeee-0000-4000-8000-000000000002";
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

const reigns = Q.discord.top.role.reign;

function daysAgo(days: number): Date {
  return new Date(NOW - days * DAY_MS);
}

function reign(
  roleKey: string,
  minecraftUuid: string,
  startedAt: Date,
  endedAt: Date | null,
) {
  return reigns.create({
    roleKey,
    discordId:
      minecraftUuid === ALICE ? "778000000000000001" : "778000000000000002",
    minecraftUuid,
    startedAt,
    endedAt,
    startValue: "1.000",
    lastValue: "2.000",
  });
}

afterEach(async () => {
  await reigns.deleteAll({ roleKey: { $in: [ROLE_A, ROLE_B] } });
});

describe("DiscordTopRoleReignQueries (integration)", () => {
  it("allows only one open reign per role", async () => {
    await reign(ROLE_A, ALICE, daysAgo(3), null);

    await expect(reign(ROLE_A, BOB, daysAgo(1), null)).rejects.toBeInstanceOf(
      UniqueViolationError,
    );
    await expect(reign(ROLE_B, BOB, daysAgo(1), null)).resolves.toBeUndefined();
    await expect(
      reign(ROLE_A, BOB, daysAgo(10), daysAgo(3)),
    ).resolves.toBeUndefined();
  });
});
