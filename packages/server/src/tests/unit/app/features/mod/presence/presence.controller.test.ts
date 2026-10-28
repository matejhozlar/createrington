import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/middleware", async () => ({
  ...(await vi.importActual("@/app/middleware/error-handler")),
  ...(await vi.importActual("@/app/middleware/validation.middleware")),
}));

const { getServiceMock, forwardHeartbeatMock } = vi.hoisted(() => ({
  getServiceMock: vi.fn(),
  forwardHeartbeatMock: vi.fn(),
}));
vi.mock("@/services", () => ({
  getService: getServiceMock,
  Services: { PLAYTIME_MANAGER_SERVICE: "PLAYTIME_MANAGER_SERVICE" },
}));

vi.mock("@/services/playtime/forwarder.service", () => ({
  getPlaytimeForwarder: () => ({ forwardHeartbeat: forwardHeartbeatMock }),
}));

vi.mock("@/app/features/mod/shared/resolve-server-id", () => ({
  resolveServerId: () => 1,
}));

import {
  BadRequestError,
  ForbiddenError,
} from "@/app/middleware/error-handler";
import { PresenceController } from "@/app/features/mod/presence/presence.controller";
import {
  HeartbeatBodySchema,
  PresenceBodySchema,
} from "@/app/features/mod/presence/presence.schemas";
import type { Request, Response } from "express";

const PLAYER_UUID = "11111111-2222-3333-4444-555555555555";
const OTHER_UUID = "99999999-8888-7777-6666-555555555555";

type TestRes = Response & { json: ReturnType<typeof vi.fn> };

function makeRes(body: unknown): TestRes {
  return {
    json: vi.fn(),
    locals: { validated: { body } },
  } as unknown as TestRes;
}

function presence(
  body: Record<string, unknown>,
  modAuth: Record<string, unknown> = {},
): [Request, TestRes] {
  return [
    { modAuth } as unknown as Request,
    makeRes(PresenceBodySchema.parse(body)),
  ];
}

function heartbeat(
  body: Record<string, unknown>,
  modAuth: Record<string, unknown> = {},
): [Request, TestRes] {
  return [
    { modAuth } as unknown as Request,
    makeRes(HeartbeatBodySchema.parse(body)),
  ];
}

function makePlaytimeManager() {
  const playtimeService = {
    handlePlayerJoinFromMod: vi.fn(),
    handlePlayerLeaveFromMod: vi.fn(),
    reconcileWithHeartbeat: vi.fn(),
  };
  getServiceMock.mockResolvedValue({
    getService: () => playtimeService,
  });
  return playtimeService;
}

beforeEach(() => {
  getServiceMock.mockReset();
  forwardHeartbeatMock.mockReset();
});

describe("PresenceController.updatePresence", () => {
  const joinBody = {
    minecraftUsername: "steve",
    uuid: PLAYER_UUID,
    state: "joined",
  };

  it("rejects a per-player token whose uuid does not match the reported player", async () => {
    const [req, res] = presence(joinBody, { uuid: OTHER_UUID });

    await expect(
      PresenceController.updatePresence(req, res),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(getServiceMock).not.toHaveBeenCalled();
  });

  it("accepts a per-player token matching the reported player regardless of case", async () => {
    const playtimeService = makePlaytimeManager();
    const [req, res] = presence(joinBody, { uuid: PLAYER_UUID.toUpperCase() });

    await PresenceController.updatePresence(req, res);

    expect(playtimeService.handlePlayerJoinFromMod).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: PLAYER_UUID }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("accepts a server-level token without a uuid claim", async () => {
    const playtimeService = makePlaytimeManager();
    const [req, res] = presence(joinBody);

    await PresenceController.updatePresence(req, res);

    expect(playtimeService.handlePlayerJoinFromMod).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("passes playTimeTicks through on join and leave", async () => {
    const playtimeService = makePlaytimeManager();

    await PresenceController.updatePresence(
      ...presence({ ...joinBody, playTimeTicks: 12345 }),
    );
    expect(playtimeService.handlePlayerJoinFromMod).toHaveBeenCalledWith(
      expect.objectContaining({ playTimeTicks: 12345 }),
    );

    await PresenceController.updatePresence(
      ...presence({ ...joinBody, state: "left", playTimeTicks: 12400 }),
    );
    expect(playtimeService.handlePlayerLeaveFromMod).toHaveBeenCalledWith(
      expect.objectContaining({ playTimeTicks: 12400 }),
    );
  });

  it("passes the logout position and dimension through on leave", async () => {
    const playtimeService = makePlaytimeManager();

    await PresenceController.updatePresence(
      ...presence({
        ...joinBody,
        state: "left",
        dimension: "minecraft:the_nether",
        position: { x: 1.5, y: 64, z: -3 },
      }),
    );

    expect(playtimeService.handlePlayerLeaveFromMod).toHaveBeenCalledWith(
      expect.objectContaining({
        dimension: "minecraft:the_nether",
        position: { x: 1.5, y: 64, z: -3 },
      }),
    );
  });

  it("drops a malformed playTimeTicks instead of rejecting the event", async () => {
    const playtimeService = makePlaytimeManager();

    await PresenceController.updatePresence(
      ...presence({ ...joinBody, playTimeTicks: "lots" }),
    );

    expect(playtimeService.handlePlayerJoinFromMod).toHaveBeenCalledWith(
      expect.objectContaining({ playTimeTicks: undefined }),
    );
  });

  it("rejects an unparseable timestamp before touching the tracker", async () => {
    await expect(
      PresenceController.updatePresence(
        ...presence({ ...joinBody, timestamp: "yesterday-ish" }),
      ),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(getServiceMock).not.toHaveBeenCalled();
  });
});

describe("PresenceController.heartbeat", () => {
  it("rejects a per-player token", async () => {
    await expect(
      PresenceController.heartbeat(
        ...heartbeat({ players: [] }, { uuid: PLAYER_UUID }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(getServiceMock).not.toHaveBeenCalled();
  });

  it("accepts a server-level token and reconciles sessions", async () => {
    const playtimeService = makePlaytimeManager();
    const [req, res] = heartbeat({
      players: [{ uuid: PLAYER_UUID, minecraftUsername: "steve" }],
    });

    await PresenceController.heartbeat(req, res);

    expect(playtimeService.reconcileWithHeartbeat).toHaveBeenCalledWith([
      { uuid: PLAYER_UUID, username: "steve", playTimeTicks: undefined },
    ]);
    expect(forwardHeartbeatMock).toHaveBeenCalledWith([
      { uuid: PLAYER_UUID, username: "steve", playTimeTicks: undefined },
    ]);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("carries playTimeTicks per player and drops malformed entries", async () => {
    const playtimeService = makePlaytimeManager();

    await PresenceController.heartbeat(
      ...heartbeat({
        players: [
          { uuid: PLAYER_UUID, minecraftUsername: "steve", playTimeTicks: 500 },
          { uuid: OTHER_UUID, minecraftUsername: "alex", playTimeTicks: -3 },
          { uuid: "not-a-uuid", minecraftUsername: "ghost" },
          { uuid: PLAYER_UUID, minecraftUsername: "x".repeat(300) },
        ],
      }),
    );

    expect(playtimeService.reconcileWithHeartbeat).toHaveBeenCalledWith([
      { uuid: PLAYER_UUID, username: "steve", playTimeTicks: 500 },
      { uuid: OTHER_UUID, username: "alex", playTimeTicks: undefined },
    ]);
  });
});
