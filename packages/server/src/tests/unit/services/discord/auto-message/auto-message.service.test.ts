import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type TransactionWork = (tx: unknown) => Promise<unknown>;

const { Q, tx, db } = vi.hoisted(() => {
  const tx = {
    discord: {
      auto: {
        message: {
          createAndReturn: vi.fn(),
          update: vi.fn(),
          followup: { createMany: vi.fn(), deleteAll: vi.fn() },
        },
      },
    },
  };
  return {
    tx,
    db: { inTransaction: vi.fn() },
    Q: {
      discord: {
        auto: {
          message: {
            find: vi.fn(),
            config: {
              find: vi.fn(),
              createAndReturn: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
          },
        },
      },
      admin: { log: { action: { logAction: vi.fn() } } },
    },
  };
});

vi.mock("@/db", () => ({ Q, db }));

import { AutoMessageService } from "@/services/discord/auto-message/auto-message.service";
import type { DiscordMessageService } from "@/services/discord/message/message.service";

const ACTOR = { discordId: "100000000000000009", minecraftUsername: "admin" };

const CONFIG = {
  id: 3,
  name: "Tips",
  channelId: "200000000000000001",
  enabled: true,
  intervalMinutes: 60,
  rotationMode: "sequential" as const,
  currentIndex: 0,
};

const FOLLOWUPS = [
  { content: "first", delaySeconds: 5, enabled: true },
  { content: "second", delaySeconds: 10, enabled: false },
];

let service: AutoMessageService;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  service = new AutoMessageService({} as DiscordMessageService);
  Q.discord.auto.message.config.find.mockResolvedValue(CONFIG);
  Q.discord.auto.message.config.createAndReturn.mockResolvedValue(CONFIG);
  Q.discord.auto.message.find.mockResolvedValue({ id: 8, configId: 3 });
  tx.discord.auto.message.createAndReturn.mockResolvedValue({ id: 8 });
  db.inTransaction.mockImplementation((work: TransactionWork) => work(tx));
});

afterEach(() => {
  service.shutdown();
  vi.useRealTimers();
});

describe("AutoMessageService configs", () => {
  it("starts the timer of a config created enabled, and audits it", async () => {
    const startConfig = vi.spyOn(service, "startConfig");

    await service.createConfig(CONFIG, ACTOR);

    expect(startConfig).toHaveBeenCalledWith(CONFIG.id);
    expect(Q.admin.log.action.logAction).toHaveBeenCalledWith({
      adminDiscordId: ACTOR.discordId,
      adminUsername: ACTOR.minecraftUsername,
      actionType: "auto_message_config_create",
      description: 'Created auto-message config "Tips"',
    });
  });

  it("leaves a config created disabled without a timer", async () => {
    Q.discord.auto.message.config.createAndReturn.mockResolvedValue({
      ...CONFIG,
      enabled: false,
    });
    const startConfig = vi.spyOn(service, "startConfig");

    await service.createConfig({ ...CONFIG, enabled: false }, ACTOR);

    expect(startConfig).not.toHaveBeenCalled();
  });

  it("restarts the timer after an update so the change applies", async () => {
    const restartConfig = vi.spyOn(service, "restartConfig");

    await service.updateConfig(CONFIG.id, { intervalMinutes: 5 }, ACTOR);

    expect(Q.discord.auto.message.config.update).toHaveBeenCalledWith(
      { id: CONFIG.id },
      { intervalMinutes: 5 },
    );
    expect(
      Q.discord.auto.message.config.update.mock.invocationCallOrder[0],
    ).toBeLessThan(restartConfig.mock.invocationCallOrder[0]);
    expect(Q.admin.log.action.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "auto_message_config_update" }),
    );
  });

  it("stops the timer before deleting the config", async () => {
    const stopConfig = vi.spyOn(service, "stopConfig");

    await service.deleteConfig(CONFIG.id, ACTOR);

    expect(stopConfig.mock.invocationCallOrder[0]).toBeLessThan(
      Q.discord.auto.message.config.delete.mock.invocationCallOrder[0],
    );
    expect(Q.admin.log.action.logAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "auto_message_config_delete" }),
    );
  });

  it.each([
    ["update", () => service.updateConfig(CONFIG.id, { name: "x" }, ACTOR)],
    ["delete", () => service.deleteConfig(CONFIG.id, ACTOR)],
  ])("refuses to %s a missing config", async (_label, call) => {
    Q.discord.auto.message.config.find.mockResolvedValue(null);

    await expect(call()).rejects.toThrow("Config not found");
    expect(Q.discord.auto.message.config.update).not.toHaveBeenCalled();
    expect(Q.discord.auto.message.config.delete).not.toHaveBeenCalled();
    expect(Q.admin.log.action.logAction).not.toHaveBeenCalled();
  });
});

describe("AutoMessageService timers", () => {
  const intervalMs = CONFIG.intervalMinutes * 60 * 1000;

  it("does nothing when asked to start a missing config", async () => {
    Q.discord.auto.message.config.find.mockResolvedValue(null);

    await service.startConfig(CONFIG.id);

    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops the timer on the first tick after its config is deleted", async () => {
    await service.startConfig(CONFIG.id);
    expect(vi.getTimerCount()).toBe(1);

    Q.discord.auto.message.config.find.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(intervalMs);

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("AutoMessageService messages", () => {
  const fields = { content: "hello", sortOrder: 0, enabled: true };

  it("creates a message with its follow-ups numbered in order", async () => {
    const created = await service.createMessage(CONFIG.id, fields, FOLLOWUPS);

    expect(created).toEqual({ id: 8 });
    expect(tx.discord.auto.message.createAndReturn).toHaveBeenCalledWith({
      configId: CONFIG.id,
      ...fields,
    });
    expect(tx.discord.auto.message.followup.createMany).toHaveBeenCalledWith([
      { messageId: 8, ...FOLLOWUPS[0], sortOrder: 0 },
      { messageId: 8, ...FOLLOWUPS[1], sortOrder: 1 },
    ]);
  });

  it("refuses a message for a missing config", async () => {
    Q.discord.auto.message.config.find.mockResolvedValue(null);

    await expect(
      service.createMessage(CONFIG.id, fields, FOLLOWUPS),
    ).rejects.toThrow("Config not found");
    expect(db.inTransaction).not.toHaveBeenCalled();
  });

  it("replaces the follow-ups when an update brings them", async () => {
    await service.updateMessage(8, { content: "edited" }, [FOLLOWUPS[1]]);

    expect(tx.discord.auto.message.update).toHaveBeenCalledWith(
      { id: 8 },
      { content: "edited" },
    );
    expect(tx.discord.auto.message.followup.deleteAll).toHaveBeenCalledWith({
      messageId: 8,
    });
    expect(tx.discord.auto.message.followup.createMany).toHaveBeenCalledWith([
      { messageId: 8, ...FOLLOWUPS[1], sortOrder: 0 },
    ]);
  });

  it("keeps the follow-ups when an update leaves them out", async () => {
    await service.updateMessage(8, { enabled: false });

    expect(tx.discord.auto.message.update).toHaveBeenCalled();
    expect(tx.discord.auto.message.followup.deleteAll).not.toHaveBeenCalled();
    expect(tx.discord.auto.message.followup.createMany).not.toHaveBeenCalled();
  });

  it("refuses to update a missing message", async () => {
    Q.discord.auto.message.find.mockResolvedValue(null);

    await expect(service.updateMessage(8, { enabled: false })).rejects.toThrow(
      "Message not found",
    );
    expect(db.inTransaction).not.toHaveBeenCalled();
  });
});
