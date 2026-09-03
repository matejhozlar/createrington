import { describe, it, expect, vi, beforeEach } from "vitest";

const env = vi.hoisted(() => ({ isProd: true, isDevDeployment: false }));
let players: Array<{ discordId: string; minecraftUsername: string }>;

vi.mock("@/config", () => ({
  default: {
    envMode: env,
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
  GameRankSyncService,
  isGameRankSyncAllowed,
} from "@/services/discord/role/game-rank-sync.service";
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

function serviceWith(
  respond: (command: string) => string,
  options: { allowed?: boolean } = {},
) {
  const sent: Array<{ serverId: number; command: string }> = [];
  const client = new FtbRanksClient(async (serverId, command) => {
    sent.push({ serverId, command });
    return respond(command);
  });
  const service = new GameRankSyncService(
    client,
    SERVER_ID,
    () => options.allowed ?? true,
  );
  return { service, sent, commands: () => sent.map((s) => s.command) };
}

const confirm = (command: string) =>
  command.startsWith("ftbranks add")
    ? "Player X added to rank 'The Sleepless'!"
    : "Player X removed from rank 'The Sleepless'!";

const offline = () => {
  throw new Error("offline");
};

describe("GameRankSyncService", () => {
  beforeEach(() => {
    players = [
      { discordId: "old", minecraftUsername: "OldTop" },
      { discordId: "older", minecraftUsername: "OlderTop" },
    ];
    env.isProd = true;
    env.isDevDeployment = false;
  });

  describe("revoke", () => {
    it("revokes every former holder on the configured server", async () => {
      const { service, sent } = serviceWith(confirm);
      const pending = await service.revoke(RULE, ["old", "older"]);
      expect(pending.size).toBe(0);
      expect(sent).toEqual([
        {
          serverId: SERVER_ID,
          command: "ftbranks remove OldTop the_sleepless",
        },
        {
          serverId: SERVER_ID,
          command: "ftbranks remove OlderTop the_sleepless",
        },
      ]);
    });

    it("reports holders whose revoke failed as still ranked", async () => {
      const { service } = serviceWith(offline);
      const pending = await service.revoke(RULE, ["old", "older"]);
      expect([...pending]).toEqual(["old", "older"]);
    });

    it("keeps going after one failed revoke", async () => {
      const { service, commands } = serviceWith((command) =>
        command.includes("OldTop") ? offline() : confirm(command),
      );
      const pending = await service.revoke(RULE, ["old", "older"]);
      expect([...pending]).toEqual(["old"]);
      expect(commands()).toEqual([
        "ftbranks remove OldTop the_sleepless",
        "ftbranks remove OlderTop the_sleepless",
      ]);
    });

    it("treats an unknown rank or player as nothing left to revoke", async () => {
      const { service } = serviceWith((command) =>
        command.includes("OldTop")
          ? "Unknown rank: the_sleepless"
          : "That player does not exist",
      );
      const pending = await service.revoke(RULE, ["old", "older"]);
      expect(pending.size).toBe(0);
    });

    it("skips former holders without a registered player", async () => {
      const { service, commands } = serviceWith(confirm);
      const pending = await service.revoke(RULE, ["ghost"]);
      expect(pending.size).toBe(0);
      expect(commands()).toEqual([]);
    });

    it("sends nothing outside production", async () => {
      const { service, commands } = serviceWith(confirm, { allowed: false });
      const pending = await service.revoke(RULE, ["old"]);
      expect(pending.size).toBe(0);
      expect(commands()).toEqual([]);
    });
  });

  describe("grant", () => {
    it("grants on the configured server", async () => {
      const { service, sent } = serviceWith(confirm);
      await service.grant(RULE, "NewTop");
      expect(sent).toEqual([
        { serverId: SERVER_ID, command: "ftbranks add NewTop the_sleepless" },
      ]);
    });

    it("is safe to repeat when the rank is already held", async () => {
      const { service, commands } = serviceWith(() => "");
      await service.grant(RULE, "NewTop");
      await service.grant(RULE, "NewTop");
      expect(commands()).toEqual([
        "ftbranks add NewTop the_sleepless",
        "ftbranks add NewTop the_sleepless",
      ]);
    });

    it("swallows a failing grant", async () => {
      const { service } = serviceWith(offline);
      await expect(service.grant(RULE, "NewTop")).resolves.toBeUndefined();
    });

    it("does not throw while the rank is not declared on the server yet", async () => {
      const { service } = serviceWith(() => "Unknown rank: the_sleepless");
      await expect(service.grant(RULE, "NewTop")).resolves.toBeUndefined();
    });

    it("sends nothing outside production", async () => {
      const { service, commands } = serviceWith(confirm, { allowed: false });
      await service.grant(RULE, "NewTop");
      expect(commands()).toEqual([]);
    });
  });

  describe("isGameRankSyncAllowed", () => {
    it("allows the production deployment", () => {
      expect(isGameRankSyncAllowed()).toBe(true);
    });

    it("blocks local development", () => {
      env.isProd = false;
      expect(isGameRankSyncAllowed()).toBe(false);
    });

    it("blocks the dev deployment", () => {
      env.isDevDeployment = true;
      expect(isGameRankSyncAllowed()).toBe(false);
    });
  });
});
