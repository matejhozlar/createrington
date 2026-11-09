import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getForMember: vi.fn(),
  getDeparted: vi.fn(),
  createAudit: vi.fn(),
  waitForPartySync: vi.fn(),
}));

vi.mock("@/config", () => ({
  default: {
    envMode: { isProductionDeployment: true },
    redis: { url: null },
  },
}));

vi.mock("@/db", () => ({
  Q: {
    server: {
      party: {
        getForMember: mocks.getForMember,
        member: { getDeparted: mocks.getDeparted },
      },
    },
    admin: { log: { action: { create: mocks.createAudit } } },
  },
}));

vi.mock("@/generated/db", () => ({
  DatabaseTable: { SERVER_PARTY_MEMBER: { TABLE: "server_party_member" } },
}));

vi.mock("@/app/features/mod/parties/parties.service", () => ({
  waitForPartySync: mocks.waitForPartySync,
}));

vi.mock("@/utils/rcon", () => ({
  minecraftRcon: { getServerIds: () => [1] },
  defaultRconSend: vi.fn(),
  isUnknownCommand: vi.fn(),
  stripFormatting: vi.fn(),
}));

import type { PartyMembersClient } from "@/services/mc-server/party-members";
import { PartyPurgeService } from "@/services/party/party-purge.service";

const STEVE = "0f8fad5b-d9cb-469f-a165-70867728950e";
const ALEX = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

function fakeClient() {
  return {
    sync: vi.fn(async () => undefined),
    remove: vi.fn(async (_serverId: number, uuid: string) => ({
      outcome: "removed" as const,
      playerName: uuid === STEVE ? "Steve" : "Alex",
      partyName: "Crew",
    })),
  };
}

function serviceWith(client: ReturnType<typeof fakeClient>) {
  return new PartyPurgeService(client as unknown as PartyMembersClient);
}

const deleted = {
  minecraftUuid: STEVE,
  discordId: "1",
  minecraftUsername: "Steve",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.waitForPartySync.mockResolvedValue(true);
});

describe("PartyPurgeService.purge", () => {
  it("syncs first, then removes every departed member and audits each removal", async () => {
    const client = fakeClient();
    const order: string[] = [];
    client.sync.mockImplementation(async () => {
      order.push("sync");
    });
    mocks.getDeparted.mockImplementation(async () => {
      order.push("departed");
      return [
        { minecraftUuid: STEVE, partyName: "Crew" },
        { minecraftUuid: ALEX, partyName: "Crew" },
      ];
    });

    const result = await serviceWith(client).purge(1, {
      discordId: "42",
      username: "Admin",
    });

    expect(order).toEqual(["sync", "departed"]);
    expect(mocks.waitForPartySync).toHaveBeenCalledBefore(client.sync);
    expect(client.remove.mock.calls).toEqual([
      [1, STEVE],
      [1, ALEX],
    ]);
    expect(result).toMatchObject({ checked: 2, skipped: 0, failed: 0 });
    expect(result.removed.map((r) => r.playerName)).toEqual(["Steve", "Alex"]);
    expect(mocks.createAudit).toHaveBeenCalledTimes(2);
    expect(mocks.createAudit.mock.calls[0][0]).toMatchObject({
      adminDiscordId: "42",
      actionType: "remove_party_member",
      targetPlayerUuid: STEVE,
      oldValue: "Crew",
      metadata: { trigger: "purge" },
    });
  });

  it("removes nothing when the server does not send its parties in time", async () => {
    const client = fakeClient();
    mocks.waitForPartySync.mockResolvedValue(false);

    await expect(serviceWith(client).purge(1, null)).rejects.toThrow(
      "did not send its parties",
    );
    expect(mocks.getDeparted).not.toHaveBeenCalled();
    expect(client.remove).not.toHaveBeenCalled();
  });

  it("counts an owner or an already-gone member as skipped without an audit row", async () => {
    const client = fakeClient();
    client.remove
      .mockResolvedValueOnce({
        outcome: "owner",
        playerName: "Steve",
        partyName: "Crew",
      } as never)
      .mockResolvedValueOnce({
        outcome: "not_in_party",
        playerName: "Alex",
      } as never);
    mocks.getDeparted.mockResolvedValue([
      { minecraftUuid: STEVE, partyName: "Crew" },
      { minecraftUuid: ALEX, partyName: "Crew" },
    ]);

    const result = await serviceWith(client).purge(1, null);

    expect(result).toMatchObject({ removed: [], skipped: 2, failed: 0 });
    expect(mocks.createAudit).not.toHaveBeenCalled();
  });

  it("keeps going past a member whose removal fails", async () => {
    const client = fakeClient();
    client.remove.mockRejectedValueOnce(new Error("rcon down"));
    mocks.getDeparted.mockResolvedValue([
      { minecraftUuid: STEVE, partyName: "Crew" },
      { minecraftUuid: ALEX, partyName: "Crew" },
    ]);

    const result = await serviceWith(client).purge(1, null);

    expect(result.failed).toBe(1);
    expect(result.removed.map((r) => r.minecraftUuid)).toEqual([ALEX]);
  });

  it("refuses a second purge while one is running", async () => {
    const client = fakeClient();
    let release: () => void = () => undefined;
    client.sync.mockImplementation(
      () =>
        new Promise<undefined>(
          (resolve) => (release = () => resolve(undefined)),
        ),
    );
    mocks.getDeparted.mockResolvedValue([]);
    const service = serviceWith(client);

    const first = service.purge(1, null);
    await expect(service.purge(1, null)).rejects.toThrow("already running");
    release();
    await expect(first).resolves.toMatchObject({ checked: 0 });
  });
});

describe("PartyPurgeService.removePlayer", () => {
  it("removes a deleted non-owner member and audits it as a deletion", async () => {
    const client = fakeClient();
    mocks.getForMember.mockResolvedValue({ name: "Crew", rank: "member" });

    await serviceWith(client).removePlayer(deleted);

    expect(client.remove).toHaveBeenCalledWith(1, STEVE);
    expect(mocks.createAudit.mock.calls[0][0]).toMatchObject({
      adminDiscordId: "system",
      metadata: { trigger: "deletion" },
    });
  });

  it("leaves a deleted owner in their party", async () => {
    const client = fakeClient();
    mocks.getForMember.mockResolvedValue({ name: "Crew", rank: "owner" });

    await serviceWith(client).removePlayer(deleted);

    expect(client.remove).not.toHaveBeenCalled();
  });

  it("does nothing for a player in no party", async () => {
    const client = fakeClient();
    mocks.getForMember.mockResolvedValue(null);

    await serviceWith(client).removePlayer(deleted);

    expect(client.remove).not.toHaveBeenCalled();
  });

  it("never throws when the removal fails", async () => {
    const client = fakeClient();
    mocks.getForMember.mockResolvedValue({ name: "Crew", rank: "member" });
    client.remove.mockRejectedValue(new Error("rcon down"));

    await expect(
      serviceWith(client).removePlayer(deleted),
    ).resolves.toBeUndefined();
  });
});
