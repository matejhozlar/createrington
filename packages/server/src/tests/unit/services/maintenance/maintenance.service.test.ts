import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { ServerMaintenanceSchedule } from "@createrington/shared/db/server_maintenance_schedule.types";

const SERVER_ID = 1;

interface FakePlayer {
  minecraftUuid: string;
  minecraftUsername: string;
  discordId: string;
}

let admins: Array<{ discordId: string }>;
let players: FakePlayer[];
let manualAllowed: Array<{ serverId: number; playerUuid: string }>;
let settingRow: { motd: string | null; message: string | null } | null;
let broadcasts: number[];
const playtimeEmitter = new EventEmitter();

vi.mock("@/config", () => ({
  default: {
    servers: {
      cogs: {
        id: 1,
        name: "Test Server",
        rcon: { host: "127.0.0.1", port: 25575, password: "test" },
      },
    },
  },
}));

vi.mock("@/db", () => ({
  Q: {
    admin: { findAll: async () => admins },
    player: {
      find: async ({ minecraftUuid }: { minecraftUuid: string }) =>
        players.find((p) => p.minecraftUuid === minecraftUuid) ?? null,
      findAll: async (filters: {
        discordId?: { $in: string[] };
        minecraftUuid?: { $in: string[] };
      }) =>
        players.filter((p) =>
          filters.discordId
            ? filters.discordId.$in.includes(p.discordId)
            : filters.minecraftUuid
              ? filters.minecraftUuid.$in.includes(p.minecraftUuid)
              : true,
        ),
    },
    server: {
      maintenance: {
        setting: {
          find: async () => settingRow,
          upsert: async (data: {
            motd: string | null;
            message: string | null;
          }) => {
            settingRow = { motd: data.motd, message: data.message };
            return data;
          },
        },
        allowed: {
          player: {
            findAll: async () => manualAllowed,
            exists: async ({ playerUuid }: { playerUuid: string }) =>
              manualAllowed.some((m) => m.playerUuid === playerUuid),
            create: async (data: { serverId: number; playerUuid: string }) => {
              manualAllowed.push(data);
            },
            delete: async ({ playerUuid }: { playerUuid: string }) => {
              manualAllowed = manualAllowed.filter(
                (m) => m.playerUuid !== playerUuid,
              );
            },
          },
        },
      },
    },
  },
}));

vi.mock("@/services", () => ({
  Services: {
    PLAYTIME_MANAGER_SERVICE: "minecraft.playtimeManagerService",
    WEBSOCKET_SERVICE: "http.webSocketService",
  },
  getService: async (key: string) => {
    if (key === "minecraft.playtimeManagerService") {
      return { getService: () => playtimeEmitter };
    }
    if (key === "http.webSocketService") {
      return {
        triggerServerStatusUpdate: async (serverId: number) => {
          broadcasts.push(serverId);
        },
      };
    }
    throw new Error(`Unexpected service ${key}`);
  },
}));

vi.mock("@/services/playtime/config", () => ({
  getServerById: () => ({ id: 1, name: "Test Server" }),
}));

import { MaintenanceService } from "@/services/maintenance/maintenance.service";
import type { MaintenanceModeClient } from "@/services/maintenance/mmode";
import type { MaintenanceScheduler } from "@/services/maintenance/scheduler";

interface FakeMod {
  reachable: boolean;
  enabled: boolean;
  allowed: string[];
  motd: string | null;
  message: string | null;
  calls: string[];
}

function createMod(overrides: Partial<FakeMod> = {}): {
  mod: FakeMod;
  client: MaintenanceModeClient;
} {
  const mod: FakeMod = {
    reachable: true,
    enabled: false,
    allowed: [],
    motd: null,
    message: null,
    calls: [],
    ...overrides,
  };
  const guard = (name: string) => {
    mod.calls.push(name);
    if (!mod.reachable) throw new Error("RCON unreachable");
  };
  const client = {
    status: async () => {
      guard("status");
      return mod.enabled;
    },
    enable: async () => {
      guard("enable");
      mod.enabled = true;
    },
    disable: async () => {
      guard("disable");
      mod.enabled = false;
    },
    setMotd: async (_: number, motd: string) => {
      guard("setMotd");
      mod.motd = motd;
    },
    setMessage: async (_: number, message: string) => {
      guard("setMessage");
      mod.message = message;
    },
    setBackups: async () => {
      guard("setBackups");
    },
    addAllowed: async (_: number, name: string) => {
      guard(`addAllowed ${name}`);
      if (!mod.allowed.includes(name)) mod.allowed.push(name);
    },
    removeAllowed: async (_: number, name: string) => {
      guard(`removeAllowed ${name}`);
      mod.allowed = mod.allowed.filter((n) => n !== name);
    },
    list: async () => {
      guard("list");
      return { players: [...mod.allowed], groups: [] };
    },
  } as unknown as MaintenanceModeClient;
  return { mod, client };
}

interface FakeScheduler {
  window: ServerMaintenanceSchedule | null;
  applied: number[];
  completed: number[];
  cancelled: number[];
  scheduler: MaintenanceScheduler;
}

function createScheduler(
  window: ServerMaintenanceSchedule | null = null,
): FakeScheduler {
  const state: FakeScheduler = {
    window,
    applied: [],
    completed: [],
    cancelled: [],
    scheduler: null as unknown as MaintenanceScheduler,
  };
  let nextId = 100;
  state.scheduler = {
    getSchedule: () => state.window,
    startNow: async (opts: {
      serverId: number;
      scheduledByDiscordId: string;
      untilRestart: boolean;
    }) => {
      state.window = makeWindow({
        id: nextId++,
        status: "active",
        untilRestart: opts.untilRestart,
        appliedAt: null,
      });
      return state.window;
    },
    cancel: async (serverId: number) => {
      state.cancelled.push(serverId);
      state.window = null;
    },
    markApplied: async (id: number) => {
      state.applied.push(id);
      if (state.window)
        state.window = { ...state.window, appliedAt: new Date() };
    },
    markCompleted: async (serverId: number) => {
      state.completed.push(serverId);
      state.window = null;
    },
    schedule: async () => {
      throw new Error("not used");
    },
    shutdown: () => undefined,
  } as unknown as MaintenanceScheduler;
  return state;
}

function makeWindow(
  overrides: Partial<ServerMaintenanceSchedule> = {},
): ServerMaintenanceSchedule {
  const now = new Date();
  return {
    id: 1,
    serverId: SERVER_ID,
    status: "active",
    scheduledAt: now,
    estimatedMinutes: 45,
    startedAt: now,
    endedAt: null,
    appliedAt: null,
    untilRestart: false,
    scheduledByDiscordId: "admin-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createService(
  mod: FakeMod,
  client: MaintenanceModeClient,
  fake: FakeScheduler,
) {
  const service = new MaintenanceService(client);
  service.setScheduler(fake.scheduler);
  return service;
}

beforeEach(() => {
  admins = [{ discordId: "admin-1" }];
  players = [
    {
      minecraftUuid: "11111111-1111-1111-1111-111111111111",
      minecraftUsername: "AdminOne",
      discordId: "admin-1",
    },
    {
      minecraftUuid: "22222222-2222-2222-2222-222222222222",
      minecraftUsername: "Helper",
      discordId: "user-2",
    },
    {
      minecraftUuid: "33333333-3333-3333-3333-333333333333",
      minecraftUsername: "Regular",
      discordId: "user-3",
    },
  ];
  manualAllowed = [];
  settingRow = null;
  broadcasts = [];
  playtimeEmitter.removeAllListeners();
});

describe("MaintenanceService.reconcile", () => {
  it("records an unreachable mod without inventing a maintenance state", async () => {
    const { mod, client } = createMod({ reachable: false });
    const service = createService(mod, client, createScheduler());

    await service.reconcile(SERVER_ID);

    const status = service.getStatus(SERVER_ID);
    expect(status.enabled).toBe(false);
    expect(status.modEnabled).toBeNull();
    expect(status.pendingApply).toBe(false);
  });

  it("reflects maintenance turned on in-game even without a window", async () => {
    const { mod, client } = createMod({ enabled: true });
    const service = createService(mod, client, createScheduler());

    await service.reconcile(SERVER_ID);

    expect(service.isInMaintenance(SERVER_ID)).toBe(true);
    expect(service.getStatus(SERVER_ID).schedule).toBeNull();
    expect(broadcasts).toEqual([SERVER_ID]);
  });

  it("pushes an active window the mod has not confirmed yet", async () => {
    const { mod, client } = createMod({ allowed: ["Stale"] });
    const fake = createScheduler(makeWindow({ appliedAt: null }));
    const service = createService(mod, client, fake);

    await service.reconcile(SERVER_ID);

    expect(mod.enabled).toBe(true);
    expect(fake.applied).toEqual([1]);
    expect(mod.allowed).toEqual(["AdminOne"]);
    expect(mod.motd).toContain("~45 min");
    expect(mod.message).toContain("Test Server");
    expect(mod.calls).toContain("setBackups");
    expect(service.getStatus(SERVER_ID).pendingApply).toBe(false);
  });

  it("completes a window that was turned off outside the app", async () => {
    const { mod, client } = createMod({ enabled: false });
    const fake = createScheduler(makeWindow({ appliedAt: new Date() }));
    const service = createService(mod, client, fake);

    await service.reconcile(SERVER_ID);

    expect(fake.completed).toEqual([SERVER_ID]);
    expect(service.isInMaintenance(SERVER_ID)).toBe(false);
    expect(mod.calls).not.toContain("enable");
  });

  it("marks a window applied when the mod is already on", async () => {
    const { mod, client } = createMod({ enabled: true });
    const fake = createScheduler(makeWindow({ appliedAt: null }));
    const service = createService(mod, client, fake);

    await service.reconcile(SERVER_ID);

    expect(fake.applied).toEqual([1]);
    expect(mod.calls).not.toContain("enable");
  });
});

describe("MaintenanceService.enable / disable", () => {
  it("starts a window and applies it", async () => {
    const { mod, client } = createMod();
    const fake = createScheduler();
    const service = createService(mod, client, fake);

    const result = await service.enable(SERVER_ID, {
      byDiscordId: "admin-1",
      untilRestart: true,
    });

    expect(result.applied).toBe(true);
    expect(mod.enabled).toBe(true);
    expect(fake.window?.untilRestart).toBe(true);
    expect(fake.applied).toEqual([100]);
    expect(service.getStatus(SERVER_ID)).toMatchObject({
      enabled: true,
      modEnabled: true,
      pendingApply: false,
    });
  });

  it("cancels a pending schedule before starting instantly", async () => {
    const { mod, client } = createMod();
    const fake = createScheduler(
      makeWindow({ status: "scheduled", startedAt: null }),
    );
    const service = createService(mod, client, fake);

    await service.enable(SERVER_ID, { byDiscordId: "admin-1" });

    expect(fake.cancelled).toEqual([SERVER_ID]);
    expect(fake.window?.status).toBe("active");
  });

  it("keeps the window pending when the server is unreachable", async () => {
    const { mod, client } = createMod({ reachable: false });
    const fake = createScheduler();
    const service = createService(mod, client, fake);

    const result = await service.enable(SERVER_ID, { byDiscordId: "admin-1" });

    expect(result.applied).toBe(false);
    expect(fake.applied).toEqual([]);
    expect(service.getStatus(SERVER_ID)).toMatchObject({
      enabled: true,
      modEnabled: null,
      pendingApply: true,
    });

    mod.reachable = true;
    await service.reconcile(SERVER_ID);

    expect(mod.enabled).toBe(true);
    expect(fake.applied).toEqual([100]);
    expect(service.getStatus(SERVER_ID).pendingApply).toBe(false);
  });

  it("refuses to enable twice", async () => {
    const { mod, client } = createMod({ enabled: true });
    const service = createService(mod, client, createScheduler());
    await service.reconcile(SERVER_ID);

    await expect(
      service.enable(SERVER_ID, { byDiscordId: "admin-1" }),
    ).rejects.toThrow(/already in maintenance/);
  });

  it("turns the mod off and completes the window", async () => {
    const { mod, client } = createMod({ enabled: true });
    const fake = createScheduler(makeWindow({ appliedAt: new Date() }));
    const service = createService(mod, client, fake);
    await service.reconcile(SERVER_ID);

    await service.disable(SERVER_ID);

    expect(mod.enabled).toBe(false);
    expect(fake.completed).toEqual([SERVER_ID]);
    expect(service.isInMaintenance(SERVER_ID)).toBe(false);
  });

  it("closes a never-applied window even when the server is unreachable", async () => {
    const { mod, client } = createMod({ reachable: false });
    const fake = createScheduler(makeWindow({ appliedAt: null }));
    const service = createService(mod, client, fake);

    await service.disable(SERVER_ID);

    expect(fake.completed).toEqual([SERVER_ID]);
    expect(service.isInMaintenance(SERVER_ID)).toBe(false);
  });

  it("propagates the failure when an applied window cannot be turned off", async () => {
    const { mod, client } = createMod({ reachable: false });
    const fake = createScheduler(makeWindow({ appliedAt: new Date() }));
    const service = createService(mod, client, fake);

    await expect(service.disable(SERVER_ID)).rejects.toThrow(/unreachable/);
    expect(fake.completed).toEqual([]);
  });

  it("rejects disabling when nothing is on", async () => {
    const { mod, client } = createMod();
    const service = createService(mod, client, createScheduler());
    await service.reconcile(SERVER_ID);

    await expect(service.disable(SERVER_ID)).rejects.toThrow(
      /not in maintenance/,
    );
  });
});

describe("MaintenanceService allow list", () => {
  it("syncs admins plus manual players and drops strangers, case-insensitively", async () => {
    manualAllowed = [
      {
        serverId: SERVER_ID,
        playerUuid: "22222222-2222-2222-2222-222222222222",
      },
    ];
    const { mod, client } = createMod({ allowed: ["adminone", "Intruder"] });
    const service = createService(mod, client, createScheduler());

    const result = await service.syncAllowList(SERVER_ID);

    expect(result).toEqual({ added: ["Helper"], removed: ["Intruder"] });
    expect(mod.allowed.sort()).toEqual(["Helper", "adminone"]);
  });

  it("lists admins first-class and manual entries with their origin", async () => {
    manualAllowed = [
      {
        serverId: SERVER_ID,
        playerUuid: "22222222-2222-2222-2222-222222222222",
      },
    ];
    const { mod, client } = createMod();
    const service = createService(mod, client, createScheduler());

    const settings = await service.getSettings(SERVER_ID);

    expect(settings.allowedPlayers.map((p) => [p.username, p.source])).toEqual([
      ["AdminOne", "admin"],
      ["Helper", "manual"],
    ]);
    expect(settings.motd).toBeNull();
    expect(settings.presets.motd).toContain("{eta}");
  });

  it("adds and removes manual players and pushes to the mod", async () => {
    const { mod, client } = createMod();
    const service = createService(mod, client, createScheduler());

    const added = await service.addAllowedPlayer(
      SERVER_ID,
      "22222222-2222-2222-2222-222222222222",
      "admin-1",
    );
    expect(added).toEqual({ username: "Helper", pushed: true });
    expect(mod.allowed).toEqual(["Helper"]);

    const removed = await service.removeAllowedPlayer(
      SERVER_ID,
      "22222222-2222-2222-2222-222222222222",
    );
    expect(removed).toEqual({ username: "Helper", pushed: true });
    expect(mod.allowed).toEqual([]);
    expect(manualAllowed).toEqual([]);
  });

  it("never removes an admin", async () => {
    const { mod, client } = createMod();
    const service = createService(mod, client, createScheduler());

    await expect(
      service.removeAllowedPlayer(
        SERVER_ID,
        "11111111-1111-1111-1111-111111111111",
      ),
    ).rejects.toThrow(/Admins are always allowed/);
  });

  it("rejects unregistered players", async () => {
    const { mod, client } = createMod();
    const service = createService(mod, client, createScheduler());

    await expect(
      service.addAllowedPlayer(
        SERVER_ID,
        "99999999-9999-9999-9999-999999999999",
        "admin-1",
      ),
    ).rejects.toThrow(/not registered/);
  });
});

describe("MaintenanceService settings", () => {
  it("stores overrides and pushes the rendered presentation", async () => {
    const { mod, client } = createMod();
    const fake = createScheduler(makeWindow({ appliedAt: new Date() }));
    const service = createService(mod, client, fake);

    const result = await service.updateSettings(
      SERVER_ID,
      { motd: "<red>{server} down for {eta}</red>", message: null },
      "admin-1",
    );

    expect(result.pushed).toBe(true);
    expect(mod.motd).toBe("<red>Test Server down for ~45 min</red>");
    expect(mod.message).toContain("Expected downtime: ~45 min");
    expect(settingRow).toEqual({
      motd: "<red>{server} down for {eta}</red>",
      message: null,
    });
  });

  it("reports when the push did not reach the server", async () => {
    const { mod, client } = createMod({ reachable: false });
    const service = createService(mod, client, createScheduler());

    const result = await service.updateSettings(
      SERVER_ID,
      { motd: "x", message: "y" },
      "admin-1",
    );

    expect(result.pushed).toBe(false);
    expect(settingRow).toEqual({ motd: "x", message: "y" });
  });

  it("syncs everything and reconciles when the server comes online", async () => {
    const { mod, client } = createMod({ allowed: [] });
    const fake = createScheduler(makeWindow({ appliedAt: null }));
    const service = createService(mod, client, fake);
    await service.initialize([SERVER_ID]);
    service.shutdown();

    expect(mod.enabled).toBe(true);
    mod.enabled = false;
    mod.allowed = [];

    playtimeEmitter.emit("serverOnline");
    await vi.waitFor(() =>
      expect(mod.calls.filter((c) => c === "status")).toHaveLength(2),
    );

    expect(mod.allowed).toEqual(["AdminOne"]);
  });
});
