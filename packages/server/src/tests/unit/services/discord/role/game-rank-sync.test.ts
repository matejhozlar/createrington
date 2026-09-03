import { describe, it, expect, vi, beforeEach } from "vitest";

let players: Array<{ discordId: string; minecraftUsername: string }>;

vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: true, isDevDeployment: false },
    servers: {
      rails: {
        id: 1,
        name: "Test Server",
        rcon: { host: "127.0.0.1", port: 25575, password: "test" },
      },
    },
  },
}));

vi.mock("@/db", () => ({
  Q: {
    player: {
      find: async ({ discordId }: { discordId: string }) =>
        players.find((p) => p.discordId === discordId) ?? null,
    },
  },
}));

import {
  GameRankSync,
  isGameRankSyncAllowed,
} from "@/services/discord/role/game-rank-sync";
import { FtbRanksClient } from "@/services/mc-server/ftb-ranks";
import {
  RoleCheckInterval,
  RoleConditionType,
  type TopPlaytimeRoleRule,
} from "@/services/discord/role/types";

const SERVER_ID = 1;

const RULE: TopPlaytimeRoleRule = {
  roleId: "role-1",
  gameRankId: "the_sleepless",
  label: "The Sleepless",
  checkInterval: RoleCheckInterval.DAILY,
  conditionType: RoleConditionType.TOP_PLAYTIME,
};

function syncWith(
  respond: (command: string) => string,
  options: { allowed?: boolean } = {},
) {
  const sent: string[] = [];
  const client = new FtbRanksClient(async (serverId, command) => {
    expect(serverId).toBe(SERVER_ID);
    sent.push(command);
    return respond(command);
  });
  const sync = new GameRankSync(
    client,
    SERVER_ID,
    () => options.allowed ?? true,
  );
  return { sync, sent };
}

const confirm = (command: string) =>
  command.startsWith("ftbranks add")
    ? "Player X added to rank 'The Sleepless'!"
    : "Player X removed from rank 'The Sleepless'!";

describe("GameRankSync", () => {
  beforeEach(() => {
    players = [
      { discordId: "old", minecraftUsername: "OldTop" },
      { discordId: "older", minecraftUsername: "OlderTop" },
    ];
  });

  it("revokes every former holder before granting the current holder", async () => {
    const { sync, sent } = syncWith(confirm);
    await sync.sync(RULE, "NewTop", ["old", "older"]);
    expect(sent).toEqual([
      "ftbranks remove OldTop the_sleepless",
      "ftbranks remove OlderTop the_sleepless",
      "ftbranks add NewTop the_sleepless",
    ]);
  });

  it("grants on every run even without former holders", async () => {
    const { sync, sent } = syncWith(() => "");
    await sync.sync(RULE, "NewTop", []);
    expect(sent).toEqual(["ftbranks add NewTop the_sleepless"]);
  });

  it("skips former holders without a registered player", async () => {
    const { sync, sent } = syncWith(confirm);
    await sync.sync(RULE, "NewTop", ["ghost"]);
    expect(sent).toEqual(["ftbranks add NewTop the_sleepless"]);
  });

  it("still grants when a revoke fails", async () => {
    const { sync, sent } = syncWith((command) => {
      if (command.startsWith("ftbranks remove")) throw new Error("offline");
      return confirm(command);
    });
    await expect(sync.sync(RULE, "NewTop", ["old"])).resolves.toBeUndefined();
    expect(sent).toEqual([
      "ftbranks remove OldTop the_sleepless",
      "ftbranks add NewTop the_sleepless",
    ]);
  });

  it("swallows a failing grant", async () => {
    const { sync } = syncWith(() => {
      throw new Error("offline");
    });
    await expect(sync.sync(RULE, "NewTop", [])).resolves.toBeUndefined();
  });

  it("does nothing outside production", async () => {
    const { sync, sent } = syncWith(confirm, { allowed: false });
    await sync.sync(RULE, "NewTop", ["old"]);
    expect(sent).toEqual([]);
  });

  it("does nothing for a rule without an in-game rank", async () => {
    const { sync, sent } = syncWith(confirm);
    await sync.sync({ ...RULE, gameRankId: undefined }, "NewTop", ["old"]);
    expect(sent).toEqual([]);
  });

  it("is allowed only on the production deployment", () => {
    expect(isGameRankSyncAllowed()).toBe(true);
  });
});
